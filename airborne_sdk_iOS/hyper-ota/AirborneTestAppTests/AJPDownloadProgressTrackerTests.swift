//
//  AJPDownloadProgressTrackerTests.swift
//  AirborneTestAppTests
//

import XCTest
@testable import Airborne

final class AJPDownloadProgressTrackerTests: XCTestCase {

    /// Collects every emission so tests can assert on the whole sequence, not just the last value.
    private final class Recorder {
        private let lock = NSLock()
        private var _events: [(bytes: Int64, total: Int64, percent: Int)] = []

        var events: [(bytes: Int64, total: Int64, percent: Int)] {
            lock.withLock { _events }
        }

        var last: (bytes: Int64, total: Int64, percent: Int)? { events.last }
        var count: Int { events.count }

        func record(_ bytes: Int64, _ total: Int64, _ percent: Int) {
            lock.withLock { _events.append((bytes, total, percent)) }
        }
    }

    private func makeTracker() -> (AJPDownloadProgressTracker, Recorder) {
        let recorder = Recorder()
        let tracker = AJPDownloadProgressTracker { bytes, total, percent in
            recorder.record(bytes, total, percent)
        }
        return (tracker, recorder)
    }

    // MARK: - Registration

    func testUnknownSizeProducesNoEmissions() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 0)
        tracker.update(fileID: "a", received: 500)
        tracker.complete(fileID: "a")

        XCTAssertEqual(recorder.count, 0, "A server that omits `size` must produce no progress at all")
    }

    func testNegativeSizeIsIgnored() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: -1)
        tracker.update(fileID: "a", received: 100)

        XCTAssertEqual(recorder.count, 0)
    }

    func testUnknownSizeFileExcludedFromBothSums() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "known", expectedBytes: 1000)
        tracker.register(fileID: "unknown", expectedBytes: 0)

        // Bytes for the unregistered file must not inflate the numerator.
        tracker.update(fileID: "unknown", received: 5000)
        tracker.complete(fileID: "known")

        XCTAssertEqual(recorder.last?.bytes, 1000)
        XCTAssertEqual(recorder.last?.total, 1000)
        XCTAssertEqual(recorder.last?.percent, 100)
    }

    // MARK: - Percent semantics

    func testPercentNeverExceeds100EvenWhenServerOverDelivers() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        tracker.update(fileID: "a", received: 99_999)

        XCTAssertEqual(recorder.last?.percent, 100)
        XCTAssertEqual(recorder.last?.bytes, 1000, "received is clamped to the declared size")
        for event in recorder.events {
            XCTAssertLessThanOrEqual(event.percent, 100)
            XCTAssertLessThanOrEqual(event.bytes, event.total)
        }
    }

    func testEmissionsStrictlyIncrease() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        for received in stride(from: Int64(0), through: 1000, by: 50) {
            tracker.update(fileID: "a", received: received)
        }

        let percents = recorder.events.map { $0.percent }
        XCTAssertFalse(percents.isEmpty)
        XCTAssertEqual(percents, percents.sorted(), "percent must never regress")
        XCTAssertEqual(Set(percents).count, percents.count, "the same percent must not be emitted twice")
        XCTAssertEqual(percents.last, 100)
    }

    func testGrowingDenominatorDoesNotRegressPercent() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        tracker.update(fileID: "a", received: 500) // 50%
        XCTAssertEqual(recorder.last?.percent, 50)
        let countAfterFirst = recorder.count

        // A second file joins the denominator: 500/2000 = 25%, which must be suppressed.
        tracker.register(fileID: "b", expectedBytes: 1000)
        XCTAssertEqual(recorder.count, countAfterFirst, "a drop caused by denominator growth must not emit")
        XCTAssertEqual(recorder.last?.percent, 50)

        // Only once it climbs back past the previous high does it emit again.
        tracker.update(fileID: "b", received: 600) // 1100/2000 = 55%
        XCTAssertEqual(recorder.last?.percent, 55)
        XCTAssertEqual(recorder.last?.total, 2000)
    }

    // MARK: - complete()

    func testCompleteClampsPartiallyReceivedFileToFullSize() {
        let (tracker, recorder) = makeTracker()

        // Simulates a declared `size` larger than the bytes URLSession reported.
        tracker.register(fileID: "a", expectedBytes: 1000)
        tracker.update(fileID: "a", received: 650)
        XCTAssertEqual(recorder.last?.percent, 65)

        tracker.complete(fileID: "a")
        XCTAssertEqual(recorder.last?.percent, 100)
        XCTAssertEqual(recorder.last?.bytes, 1000)
    }

    func testCompleteOnUnregisteredFileIsNoOp() {
        let (tracker, recorder) = makeTracker()

        tracker.complete(fileID: "ghost")
        XCTAssertEqual(recorder.count, 0)
    }

    // MARK: - cancel()

    func testCancelShrinksDenominatorAndRaisesPercent() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        tracker.register(fileID: "b", expectedBytes: 1000)
        tracker.complete(fileID: "a") // 1000/2000 = 50%
        XCTAssertEqual(recorder.last?.percent, 50)

        // `b` is skipped after boot timeout and never downloads.
        tracker.cancel(fileID: "b")

        XCTAssertEqual(recorder.last?.percent, 100, "the bar must still converge once skipped files are dropped")
        XCTAssertEqual(recorder.last?.total, 1000)
        XCTAssertEqual(recorder.last?.bytes, 1000)
    }

    func testCancellingEveryFileStopsEmitting() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        tracker.update(fileID: "a", received: 100)
        let countBefore = recorder.count

        tracker.cancel(fileID: "a")
        XCTAssertEqual(recorder.count, countBefore, "an empty denominator emits nothing rather than dividing by zero")
    }

    // MARK: - Absolute counters, not deltas

    func testRegressedReceivedDoesNotInflateNumerator() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        tracker.update(fileID: "a", received: 800) // 80%
        XCTAssertEqual(recorder.last?.percent, 80)

        // URLSession resets countOfBytesReceived to 0 on a redirect/retry. If the tracker
        // accumulated deltas, the numerator would end up at 800 + 100 + 1000.
        tracker.update(fileID: "a", received: 0)
        tracker.update(fileID: "a", received: 100)
        XCTAssertEqual(recorder.last?.percent, 80, "the regression is absorbed, not emitted")

        tracker.update(fileID: "a", received: 1000)
        XCTAssertEqual(recorder.last?.bytes, 1000, "numerator reflects the absolute count, not a running sum")
        XCTAssertEqual(recorder.last?.percent, 100)
    }

    func testNegativeReceivedIsFloored() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)
        let countAfterRegister = recorder.count

        tracker.update(fileID: "a", received: -50)
        XCTAssertEqual(recorder.count, countAfterRegister, "a negative count cannot advance the percentage")
        XCTAssertEqual(recorder.last?.bytes, 0, "the numerator is floored at zero, never negative")

        // A subsequent valid reading still lands.
        tracker.update(fileID: "a", received: 500)
        XCTAssertEqual(recorder.last?.bytes, 500)
        XCTAssertEqual(recorder.last?.percent, 50)
    }

    func testRegisteringKnownSizeEmitsAnInitialZeroPercent() {
        let (tracker, recorder) = makeTracker()

        tracker.register(fileID: "a", expectedBytes: 1000)

        XCTAssertEqual(recorder.count, 1, "registering the first sized file establishes a 0% baseline")
        XCTAssertEqual(recorder.last?.bytes, 0)
        XCTAssertEqual(recorder.last?.total, 1000)
        XCTAssertEqual(recorder.last?.percent, 0)
    }

    // MARK: - Concurrency

    func testConcurrentUpdatesSettleAtOneHundredPercent() {
        let (tracker, recorder) = makeTracker()

        let fileCount = 8
        let sizePerFile: Int64 = 10_000
        let ids = (0..<fileCount).map { "file-\($0)" }
        for id in ids {
            tracker.register(fileID: id, expectedBytes: sizePerFile)
        }

        // Hammer the tracker from every file's "download thread" at once.
        DispatchQueue.concurrentPerform(iterations: fileCount) { index in
            let id = ids[index]
            for received in stride(from: Int64(0), through: sizePerFile, by: 500) {
                tracker.update(fileID: id, received: received)
            }
            tracker.complete(fileID: id)
        }

        let total = sizePerFile * Int64(fileCount)
        let percents = recorder.events.map { $0.percent }

        // The callback fires outside the lock, so adjacent percentages from two download
        // threads may be *delivered* out of order. What the tracker does guarantee is that
        // each percentage is generated exactly once and that the run terminates at 100.
        // (AirborneServices imposes the non-decreasing sequence on top of this.)
        XCTAssertEqual(Set(percents).count, percents.count, "each percent must be produced exactly once")
        XCTAssertEqual(percents.max(), 100)
        for event in recorder.events {
            XCTAssertGreaterThanOrEqual(event.percent, 0)
            XCTAssertLessThanOrEqual(event.percent, 100)
            XCTAssertLessThanOrEqual(event.bytes, event.total)
        }

        // Final state is exact regardless of delivery order.
        let hundred = recorder.events.first { $0.percent == 100 }
        XCTAssertEqual(hundred?.bytes, total)
        XCTAssertEqual(hundred?.total, total)
    }

    func testCallbackIsInvokedOutsideTheLock() {
        // A callback that re-enters the tracker must not deadlock.
        let recorder = Recorder()
        var tracker: AJPDownloadProgressTracker!
        let reentered = expectation(description: "callback re-entered the tracker")
        reentered.assertForOverFulfill = false

        tracker = AJPDownloadProgressTracker { bytes, total, percent in
            recorder.record(bytes, total, percent)
            // Re-entrancy: reading back through a public method from inside the callback.
            tracker.update(fileID: "a", received: bytes)
            reentered.fulfill()
        }

        tracker.register(fileID: "a", expectedBytes: 100)
        tracker.update(fileID: "a", received: 50)

        wait(for: [reentered], timeout: 2.0)
        XCTAssertEqual(recorder.last?.percent, 50)
    }
}
