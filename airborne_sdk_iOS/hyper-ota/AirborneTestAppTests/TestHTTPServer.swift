//
//  TestHTTPServer.swift
//  AirborneTestAppTests
//
//  A minimal loopback HTTP server so download tests can exercise real URLSession byte
//  counters without depending on a third-party service being reachable.
//

import Foundation
import Network

final class TestHTTPServer {

    enum ServerError: Error {
        case failedToStart(String)
        case timedOutStarting
    }

    /// The body served to every request.
    private let body: Data
    /// Bytes per write. Small chunks force URLSession to report progress more than once.
    private let chunkSize: Int
    /// Pause between chunks, so the whole body doesn't coalesce into a single read.
    private let chunkDelay: TimeInterval
    /// Extra response headers, e.g. `Content-Encoding`.
    private let extraHeaders: [String: String]

    private let queue = DispatchQueue(label: "in.juspay.airborne.tests.httpserver")
    private var listener: NWListener?

    private(set) var port: UInt16 = 0

    var baseURL: String { "http://127.0.0.1:\(port)" }

    init(body: Data, chunkSize: Int = 32 * 1024, chunkDelay: TimeInterval = 0.004, extraHeaders: [String: String] = [:]) {
        self.body = body
        self.chunkSize = chunkSize
        self.chunkDelay = chunkDelay
        self.extraHeaders = extraHeaders
    }

    func start() throws {
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true

        let listener = try NWListener(using: parameters, on: .any)
        self.listener = listener

        let ready = DispatchSemaphore(value: 0)
        var startError: String?

        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                ready.signal()
            case .failed(let error):
                startError = "\(error)"
                ready.signal()
            case .cancelled:
                startError = "cancelled"
                ready.signal()
            default:
                break
            }
        }

        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }

        listener.start(queue: queue)

        guard ready.wait(timeout: .now() + 5) == .success else {
            throw ServerError.timedOutStarting
        }
        if let startError = startError {
            throw ServerError.failedToStart(startError)
        }
        guard let assigned = listener.port?.rawValue else {
            throw ServerError.failedToStart("no port assigned")
        }
        port = assigned
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    // MARK: - Connection handling

    private func handle(_ connection: NWConnection) {
        connection.start(queue: queue)
        // A GET has no body, so the first readable bytes are enough to know the request
        // arrived; we serve the same response regardless of path.
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] _, _, _, error in
            guard let self = self, error == nil else {
                connection.cancel()
                return
            }
            self.respond(on: connection)
        }
    }

    private func respond(on connection: NWConnection) {
        var head = "HTTP/1.1 200 OK\r\n"
        head += "Content-Length: \(body.count)\r\n"
        head += "Content-Type: application/octet-stream\r\n"
        head += "Connection: close\r\n"
        for (name, value) in extraHeaders {
            head += "\(name): \(value)\r\n"
        }
        head += "\r\n"

        connection.send(content: Data(head.utf8), completion: .contentProcessed { [weak self] error in
            guard let self = self, error == nil else {
                connection.cancel()
                return
            }
            self.sendBody(on: connection, from: 0)
        })
    }

    private func sendBody(on connection: NWConnection, from offset: Int) {
        guard offset < body.count else {
            connection.send(content: nil, isComplete: true, completion: .contentProcessed { _ in
                connection.cancel()
            })
            return
        }

        let end = min(offset + chunkSize, body.count)
        let chunk = body.subdata(in: offset..<end)

        connection.send(content: chunk, completion: .contentProcessed { [weak self] error in
            guard let self = self, error == nil else {
                connection.cancel()
                return
            }
            self.queue.asyncAfter(deadline: .now() + self.chunkDelay) {
                self.sendBody(on: connection, from: end)
            }
        })
    }
}
