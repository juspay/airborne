//
//  AJPReleaseConfigLiveVerificationTests.swift
//  AirborneTestAppTests
//

import XCTest
import CryptoKit
@testable import Airborne

final class AJPReleaseConfigLiveVerificationTests: XCTestCase {

    // MARK: - Real captured server data

    /// Release config body, signed by the "default" key. Base64 for byte-exactness — the
    /// signature covers these exact bytes.
    private let bodyDefaultB64 = "eyJ2ZXJzaW9uIjoiMiIsImNvbmZpZyI6eyJib290X3RpbWVvdXQiOjEsInJlbGVhc2VfY29uZmlnX3RpbWVvdXQiOjgwMDAsInZlcnNpb24iOiIzZmY0ZjE2ZC02Y2M3LTRmNjktOWZiMi1hYzhmNDcxMDdhODIiLCJwcm9wZXJ0aWVzIjp7fX0sInBhY2thZ2UiOnsibmFtZSI6InJucmF3LWlvcyIsInZlcnNpb24iOiIxNCIsImluZGV4Ijp7ImZpbGVfcGF0aCI6Im1haW4uanNidW5kbGUiLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg4OTkvbWFpbi5qc2J1bmRsZSIsImNoZWNrc3VtIjoiNDYxOGMyY2UwMzIyZjAzMThlMTViZTFiNTFkNTNkMTIyMTRiNWY2ZTJkNzQzN2RiZWIxYTFlNjk2MDE3MDZhZCIsInNpemUiOjEyNDgyNzV9LCJwcm9wZXJ0aWVzIjp7fSwiaW1wb3J0YW50IjpbeyJmaWxlX3BhdGgiOiJvdGEtcGF5bG9hZC0xLmJpbiIsInVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODg5OS9vdGEtcGF5bG9hZC0xLmJpbiIsImNoZWNrc3VtIjoiODZmYTgzNDIyMmVlYzI2ODk0YTg5YWEyNGY4YWViNWE0OWQ3MzUyNWVlZmIzZTA2N2ZjNGM4NTBhYTc4YTFmMyIsInNpemUiOjgzODg2MDh9LHsiZmlsZV9wYXRoIjoib3RhLXBheWxvYWQtMi5iaW4iLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg4OTkvb3RhLXBheWxvYWQtMi5iaW4iLCJjaGVja3N1bSI6ImM4OWM2YjcwOGYwMGZlOTAxOTQwOWNhYTgxN2ZiODZjYjEzZjhmYzQzYmMwOTU0OWE0MDlhYTE1ZmYyYTg5MjkiLCJzaXplIjo4Mzg4NjA4fSx7ImZpbGVfcGF0aCI6Im90YS1wYXlsb2FkLTMuYmluIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo4ODk5L290YS1wYXlsb2FkLTMuYmluIiwiY2hlY2tzdW0iOiJmOTM5OTE0M2E0OGYyOTEyODMwNzliOThjYWQ5YmM0OTYwODJlMzU3NWEwNThkYzc5NDI0ZTI5NjJmOGYxYzkyIiwic2l6ZSI6ODM4ODYwOH0seyJmaWxlX3BhdGgiOiJvdGEtcGF5bG9hZC00LmJpbiIsInVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODg5OS9vdGEtcGF5bG9hZC00LmJpbiIsImNoZWNrc3VtIjoiZWI0Yjk2NTRiMWEyNWMxZjcxY2Q2ZTgxZjkzZWRjN2ZkMzIzYjMyNGY5ZWZhNzhkYjQxNjcwZjJjODZjNDcwYiIsInNpemUiOjgzODg2MDh9XSwibGF6eSI6W119LCJyZXNvdXJjZXMiOltdfQ=="

    /// Same endpoint, signed by "release-2027" (requested via x-signing-key-id).
    private let body2027B64 = "eyJ2ZXJzaW9uIjoiMiIsImNvbmZpZyI6eyJib290X3RpbWVvdXQiOjEsInJlbGVhc2VfY29uZmlnX3RpbWVvdXQiOjgwMDAsInZlcnNpb24iOiIzZmY0ZjE2ZC02Y2M3LTRmNjktOWZiMi1hYzhmNDcxMDdhODIiLCJwcm9wZXJ0aWVzIjp7fX0sInBhY2thZ2UiOnsibmFtZSI6InJucmF3LWlvcyIsInZlcnNpb24iOiIxNCIsImluZGV4Ijp7ImZpbGVfcGF0aCI6Im1haW4uanNidW5kbGUiLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg4OTkvbWFpbi5qc2J1bmRsZSIsImNoZWNrc3VtIjoiNDYxOGMyY2UwMzIyZjAzMThlMTViZTFiNTFkNTNkMTIyMTRiNWY2ZTJkNzQzN2RiZWIxYTFlNjk2MDE3MDZhZCIsInNpemUiOjEyNDgyNzV9LCJwcm9wZXJ0aWVzIjp7fSwiaW1wb3J0YW50IjpbeyJmaWxlX3BhdGgiOiJvdGEtcGF5bG9hZC0xLmJpbiIsInVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODg5OS9vdGEtcGF5bG9hZC0xLmJpbiIsImNoZWNrc3VtIjoiODZmYTgzNDIyMmVlYzI2ODk0YTg5YWEyNGY4YWViNWE0OWQ3MzUyNWVlZmIzZTA2N2ZjNGM4NTBhYTc4YTFmMyIsInNpemUiOjgzODg2MDh9LHsiZmlsZV9wYXRoIjoib3RhLXBheWxvYWQtMi5iaW4iLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg4OTkvb3RhLXBheWxvYWQtMi5iaW4iLCJjaGVja3N1bSI6ImM4OWM2YjcwOGYwMGZlOTAxOTQwOWNhYTgxN2ZiODZjYjEzZjhmYzQzYmMwOTU0OWE0MDlhYTE1ZmYyYTg5MjkiLCJzaXplIjo4Mzg4NjA4fSx7ImZpbGVfcGF0aCI6Im90YS1wYXlsb2FkLTMuYmluIiwidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo4ODk5L290YS1wYXlsb2FkLTMuYmluIiwiY2hlY2tzdW0iOiJmOTM5OTE0M2E0OGYyOTEyODMwNzliOThjYWQ5YmM0OTYwODJlMzU3NWEwNThkYzc5NDI0ZTI5NjJmOGYxYzkyIiwic2l6ZSI6ODM4ODYwOH0seyJmaWxlX3BhdGgiOiJvdGEtcGF5bG9hZC00LmJpbiIsInVybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODg5OS9vdGEtcGF5bG9hZC00LmJpbiIsImNoZWNrc3VtIjoiZWI0Yjk2NTRiMWEyNWMxZjcxY2Q2ZTgxZjkzZWRjN2ZkMzIzYjMyNGY5ZWZhNzhkYjQxNjcwZjJjODZjNDcwYiIsInNpemUiOjgzODg2MDh9XSwibGF6eSI6W119LCJyZXNvdXJjZXMiOltdfQ=="

    private let defaultHeader = "keyid=\"default\",alg=\"es256\",sig=\"MEYCIQCdXkQw+AmXeq+C4ANRzYwSjwgBTzV7wmIF5xWu24d0bgIhANAdkGKG7sIX5OiF9PODhaoRhvyQOLUNiPMa0gf2pjes\""
    private let key2027Header = "keyid=\"release-2027\",alg=\"es256\",sig=\"MEUCIHXzRswswmRhHWEeEVmwhbgYDU4/nv0dlM8bEdGJttBYAiEA22Oe1MdMJRkf228T47MiC09uJoOZL/q/VMHYTS5i6kc=\""

    private let pemDefault = """
    -----BEGIN PUBLIC KEY-----
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbFupAsrj7W1F3jfAtNKqJo78e1pB
    G0eaG/oE8QUkX5NwpAVcJGQ3l3rf8g8tm3WMe4DouWUmHn4BcgVes0AHDg==
    -----END PUBLIC KEY-----
    """
    private let pem2027 = """
    -----BEGIN PUBLIC KEY-----
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAECcwE3pKhT0x2CZdVcHXhD1Q5EXbA
    AZyyK6QUSDmmYK6z7LoK0TbtNyQty+sx/YxZDFGETyDaEhgWxVUuUD4fDg==
    -----END PUBLIC KEY-----
    """

    private func body(_ b64: String) -> Data { Data(base64Encoded: b64)! }

    // MARK: - Case 1: default key

    func test01_defaultKey_realSignatureVerifies() throws {
        let keyID = try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64),
            headerValue: defaultHeader,
            trustedKeys: AJPReleaseConfigTrustStore(pems: ["default": pemDefault]).keys
        )
        XCTAssertEqual(keyID, "default")
    }

    // MARK: - Case 2: multiple keys, correct selection by keyid

    func test02a_multipleKeys_selectsDefaultByKeyID() throws {
        let decoy = P256.Signing.PrivateKey().publicKey.pemRepresentation // unrelated valid P-256 key
        let store = AJPReleaseConfigTrustStore(pems: [
            "default": pemDefault, "release-2027": pem2027, "decoy": decoy,
        ])
        XCTAssertEqual(store.keys.count, 3)

        let keyID = try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64), headerValue: defaultHeader, trustedKeys: store.keys
        )
        XCTAssertEqual(keyID, "default", "must pick the key the header names, out of three")
    }

    func test02b_multipleKeys_selectsRelease2027ByKeyID() throws {
        // Same trust store, but this response was signed by release-2027 — selection must follow
        // the header, not the default.
        let store = AJPReleaseConfigTrustStore(pems: ["default": pemDefault, "release-2027": pem2027])
        let keyID = try AJPReleaseConfigVerifier.verify(
            body: body(body2027B64), headerValue: key2027Header, trustedKeys: store.keys
        )
        XCTAssertEqual(keyID, "release-2027")
    }

    // MARK: - Case 3: wrong keys

    func test03a_wrongKey_correctKeyIDButWrongPEM_mismatch() {
        // The map has the right key id ("default") pointing at the WRONG public key.
        let store = AJPReleaseConfigTrustStore(pems: ["default": pem2027])
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64), headerValue: defaultHeader, trustedKeys: store.keys
        )) { XCTAssertEqual($0 as? AJPSignatureVerificationError, .signatureMismatch) }
    }

    func test03b_wrongKey_keyIDNotConfigured_untrusted() {
        // Server signed with "default", but the app only trusts "release-2027".
        let store = AJPReleaseConfigTrustStore(pems: ["release-2027": pem2027])
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64), headerValue: defaultHeader, trustedKeys: store.keys
        )) { XCTAssertEqual($0 as? AJPSignatureVerificationError, .untrustedKeyID("default")) }
    }

    // MARK: - Case 4: no keys (manager skips verification)

    func test04_noKeys_trustStoreNotConfigured() {
        // This is the exact signal AJPApplicationManager.verifyReleaseConfigSignature guards on
        // (`guard trustStore.isConfigured else { return nil }`) to skip verification and stay
        // backward compatible.
        let store = AJPReleaseConfigTrustStore(pems: [:])
        XCTAssertFalse(store.isConfigured)
        XCTAssertTrue(store.keys.isEmpty)
    }

    // MARK: - Case 5: bytes modified in transit

    func test05_bytesModified_mismatch() {
        var tampered = body(bodyDefaultB64)
        // Flip one byte deep inside the JSON (a checksum digit) — a hostile proxy rewriting the
        // bundle URL/checksum is exactly the attack signing defends against.
        tampered[600] ^= 0x01
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: tampered, headerValue: defaultHeader,
            trustedKeys: AJPReleaseConfigTrustStore(pems: ["default": pemDefault]).keys
        )) { XCTAssertEqual($0 as? AJPSignatureVerificationError, .signatureMismatch) }
    }

    // MARK: - Case 6: additional cases

    func test06a_rotation_appHasOnlyOldKey_rejectsConfigSignedByNewDefault() {
        // Rotation footgun: the server promotes release-2027 to default and signs with it, but a
        // client still shipping only the old "default" key rejects it (untrusted key id).
        let store = AJPReleaseConfigTrustStore(pems: ["default": pemDefault])
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body(body2027B64), headerValue: key2027Header, trustedKeys: store.keys
        )) { XCTAssertEqual($0 as? AJPSignatureVerificationError, .untrustedKeyID("release-2027")) }
    }

    func test06b_algorithmTampered_unsupported() {
        // Downgrade the algorithm label on a real header; the real signature is left intact.
        let tamperedHeader = defaultHeader.replacingOccurrences(of: "alg=\"es256\"", with: "alg=\"rs256\"")
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64), headerValue: tamperedHeader,
            trustedKeys: AJPReleaseConfigTrustStore(pems: ["default": pemDefault]).keys
        )) { XCTAssertEqual($0 as? AJPSignatureVerificationError, .unsupportedAlgorithm("rs256")) }
    }

    func test06c_signatureCorrupted_malformed() {
        // Corrupt the base64 signature so it is no longer valid DER.
        let tamperedHeader = defaultHeader.replacingOccurrences(of: "sig=\"ME", with: "sig=\"XX")
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64), headerValue: tamperedHeader,
            trustedKeys: AJPReleaseConfigTrustStore(pems: ["default": pemDefault]).keys
        )) {
            let e = $0 as? AJPSignatureVerificationError
            XCTAssertTrue(e == .malformedSignature || e == .signatureMismatch, "got \(String(describing: e))")
        }
    }

    func test06d_headerStripped_verifierRejects_managerTolerates() {
        // Component level: an empty header is malformed. (The manager's own policy is to TOLERATE
        // an absent header and accept the config — verified end-to-end by the app run, not here.)
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body(bodyDefaultB64), headerValue: "",
            trustedKeys: AJPReleaseConfigTrustStore(pems: ["default": pemDefault]).keys
        )) { XCTAssertEqual($0 as? AJPSignatureVerificationError, .malformedHeader) }
    }

    // MARK: - Trust store parses the real server PEMs

    func test07_trustStoreParsesRealServerPEMs() {
        let store = AJPReleaseConfigTrustStore(pems: ["default": pemDefault, "release-2027": pem2027])
        XCTAssertTrue(store.isConfigured)
        XCTAssertEqual(store.keys.count, 2)
        XCTAssertTrue(store.invalidKeyIDs.isEmpty)
    }
}
