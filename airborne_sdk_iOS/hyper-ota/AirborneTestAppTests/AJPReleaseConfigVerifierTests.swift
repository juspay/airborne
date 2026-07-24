//
//  AJPReleaseConfigVerifierTests.swift
//  AirborneTestAppTests
//

import XCTest
import CryptoKit
@testable import Airborne

/// The SDK ships with an iOS 13 deployment target and so extracts the raw EC point from a PEM
/// by hand. This test target deploys to 15.6, which lets it use CryptoKit's own iOS 14+ PEM
/// parser as an oracle to check that hand-rolled path against.
final class AJPReleaseConfigVerifierTests: XCTestCase {

    /// A key exported by the server's `to_public_key_pem`. Pins the wire format.
    private let serverPEM = """
    -----BEGIN PUBLIC KEY-----
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAET18CGQj7v0eS9d/wQcIvy+0Agmj5
    7nzzz0zAeqmQToNpi4LPIbftTRceLY0HqSLeWscFhoWiCxSkvNwNhDnGXw==
    -----END PUBLIC KEY-----
    """

    private let keyID = "release-2026"
    private let body = Data(#"{"config":{"version":"1.0.0"}}"#.utf8)

    // MARK: - Helpers

    /// Builds a header exactly as the server formats it: no spaces after the commas.
    private func makeHeader(keyID: String? = nil, alg: String = "es256", sig: String) -> String {
        "keyid=\"\(keyID ?? self.keyID)\",alg=\"\(alg)\",sig=\"\(sig)\""
    }

    private func sign(_ data: Data, with key: P256.Signing.PrivateKey) throws -> String {
        try key.signature(for: data).derRepresentation.base64EncodedString()
    }

    // MARK: - Public key parsing

    func testParsesKeyExportedByServer() throws {
        let key = try AJPReleaseConfigVerifier.publicKey(fromPEM: serverPEM)

        // 0x04 marks an uncompressed point; 65 bytes = 0x04 || X(32) || Y(32).
        XCTAssertEqual(key.x963Representation.count, 65)
        XCTAssertEqual(key.x963Representation.first, 0x04)
    }

    /// Pins the hand-rolled extractor to Apple's parser: for any key CryptoKit accepts from a
    /// PEM, our iOS 13 path must produce the identical key.
    func testMatchesCryptoKitPEMParserForGeneratedKeys() throws {
        for _ in 0..<25 {
            let pem = P256.Signing.PrivateKey().publicKey.pemRepresentation

            let ours = try AJPReleaseConfigVerifier.publicKey(fromPEM: pem)
            let apple = try P256.Signing.PublicKey(pemRepresentation: pem)

            XCTAssertEqual(ours.x963Representation, apple.x963Representation)
        }
    }

    func testAcceptsBareBase64WithoutArmor() throws {
        let armored = P256.Signing.PrivateKey().publicKey.pemRepresentation
        let bare = armored
            .replacingOccurrences(of: "-----BEGIN PUBLIC KEY-----", with: "")
            .replacingOccurrences(of: "-----END PUBLIC KEY-----", with: "")

        XCTAssertEqual(
            try AJPReleaseConfigVerifier.publicKey(fromPEM: bare).x963Representation,
            try P256.Signing.PublicKey(pemRepresentation: armored).x963Representation
        )
    }

    func testRejectsWrongCurve() throws {
        // A P-384 key is a well-formed SPKI PEM, just not one we can verify with.
        let pem = P384.Signing.PrivateKey().publicKey.pemRepresentation

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.publicKey(fromPEM: pem)) { error in
            XCTAssertEqual(error as? AJPPublicKeyError, .notP256SPKI)
        }
    }

    func testRejectsCorrectLengthKeyWithWrongOID() throws {
        // A genuine P-256 SPKI with one byte of the curve OID flipped: still 91 bytes, so it
        // passes the length check and can only be caught by the prefix comparison. Guards against
        // a future "just check the length" regression.
        var der = Array(P256.Signing.PrivateKey().publicKey.derRepresentation)
        der[22] ^= 0x01 // inside the prime256v1 OID (prefix bytes 0..25)
        let pem = Data(der).base64EncodedString()

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.publicKey(fromPEM: pem)) { error in
            XCTAssertEqual(error as? AJPPublicKeyError, .notP256SPKI)
        }
    }

    func testRejectsMalformedPEM() {
        // Inputs that never yield decodable base64: empty payloads, non-base64 characters,
        // or armor in the wrong order.
        let cases = [
            "",
            "-----BEGIN PUBLIC KEY-----\n-----END PUBLIC KEY-----",
            "-----BEGIN PUBLIC KEY-----\n!!!not base64!!!\n-----END PUBLIC KEY-----",
            // END before BEGIN.
            "-----END PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQ==\n-----BEGIN PUBLIC KEY-----",
        ]

        for pem in cases {
            XCTAssertThrowsError(try AJPReleaseConfigVerifier.publicKey(fromPEM: pem), "PEM: \(pem)") { error in
                XCTAssertEqual(error as? AJPPublicKeyError, .malformedPEM, "PEM: \(pem)")
            }
        }
    }

    func testRejectsArbitraryBytesThatHappenToBeBase64() {
        // "notakeyatall" is 12 base64 characters, so it decodes cleanly to 9 bytes — it is not a
        // malformed PEM, it just isn't a P-256 SPKI key.
        XCTAssertThrowsError(try AJPReleaseConfigVerifier.publicKey(fromPEM: "not a key at all")) { error in
            XCTAssertEqual(error as? AJPPublicKeyError, .notP256SPKI)
        }
    }

    func testRejectsTruncatedKey() throws {
        // A valid key with its last byte lopped off: decodes as base64, wrong SPKI length.
        let der = P256.Signing.PrivateKey().publicKey.derRepresentation
        let truncated = der.dropLast().base64EncodedString()

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.publicKey(fromPEM: truncated)) { error in
            XCTAssertEqual(error as? AJPPublicKeyError, .notP256SPKI)
        }
    }

    /// Guards the `.ignoreUnknownCharacters` trap: the armor's own letters are valid base64, so
    /// a lenient decode folds them into the key material instead of skipping them. Decoding must
    /// stay strict, and a key whose armor was left in the payload must not parse.
    func testDoesNotDecodeArmorTextIntoKeyMaterial() throws {
        let payload = P256.Signing.PrivateKey().publicKey.derRepresentation.base64EncodedString()
        let doubledArmor = "-----BEGIN PUBLIC KEY-----BEGINPUBLICKEY\(payload)-----END PUBLIC KEY-----"

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.publicKey(fromPEM: doubledArmor))
    }

    // MARK: - Header parsing

    func testParsesServerFormattedHeader() throws {
        let parsed = try AJPReleaseConfigVerifier.parseSignatureHeader(
            #"keyid="release-signing-2026",alg="es256",sig="c2ln""#
        )

        XCTAssertEqual(parsed, AJPSignatureHeader(
            keyID: "release-signing-2026", alg: "es256", signatureBase64: "c2ln"
        ))
    }

    func testIgnoresUnknownHeaderFields() throws {
        let parsed = try AJPReleaseConfigVerifier.parseSignatureHeader(
            #"keyid="k1",alg="es256",sig="c2ln",created="12345""#
        )

        XCTAssertEqual(parsed.keyID, "k1")
        XCTAssertEqual(parsed.signatureBase64, "c2ln")
    }

    func testPreservesBase64PaddingAndSymbolsInSignature() throws {
        // `+`, `/` and `=` must survive: the value class excludes only the quote.
        let sig = "MEQCIF+a/b8c=="
        let parsed = try AJPReleaseConfigVerifier.parseSignatureHeader(makeHeader(sig: sig))

        XCTAssertEqual(parsed.signatureBase64, sig)
    }

    func testTakesLastValueForDuplicateFields() throws {
        let parsed = try AJPReleaseConfigVerifier.parseSignatureHeader(
            #"keyid="first",alg="es256",sig="c2ln",keyid="second""#
        )

        XCTAssertEqual(parsed.keyID, "second")
    }

    func testRejectsMalformedHeaders() {
        let cases = [
            "",
            "garbage",
            #"alg="es256",sig="c2ln""#,                 // no keyid
            #"keyid="k1",sig="c2ln""#,                  // no alg
            #"keyid="k1",alg="es256""#,                 // no sig
            #"keyid="",alg="es256",sig="c2ln""#,        // empty keyid
            #"keyid="k1",alg="es256",sig="""#,          // empty sig
        ]

        for value in cases {
            XCTAssertThrowsError(try AJPReleaseConfigVerifier.parseSignatureHeader(value), "header: \(value)") { error in
                XCTAssertEqual(error as? AJPSignatureVerificationError, .malformedHeader, "header: \(value)")
            }
        }
    }

    // MARK: - Verification

    func testVerifiesGenuineSignature() throws {
        let privateKey = P256.Signing.PrivateKey()
        let trusted = [keyID: privateKey.publicKey]
        let header = makeHeader(sig: try sign(body, with: privateKey))

        let verifiedKeyID = try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: trusted
        )

        XCTAssertEqual(verifiedKeyID, keyID)
    }

    func testSelectsKeyByKeyIDWhenSeveralAreTrusted() throws {
        // The rotation case: several keys trusted, the header names which one signed.
        let old = P256.Signing.PrivateKey()
        let new = P256.Signing.PrivateKey()
        let trusted = ["old-key": old.publicKey, "new-key": new.publicKey]
        let header = makeHeader(keyID: "new-key", sig: try sign(body, with: new))

        XCTAssertEqual(
            try AJPReleaseConfigVerifier.verify(body: body, headerValue: header, trustedKeys: trusted),
            "new-key"
        )
    }

    func testRejectsTamperedBody() throws {
        let privateKey = P256.Signing.PrivateKey()
        let header = makeHeader(sig: try sign(body, with: privateKey))

        var tampered = body
        tampered[tampered.startIndex] ^= 0x01

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: tampered, headerValue: header, trustedKeys: [keyID: privateKey.publicKey]
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .signatureMismatch)
        }
    }

    func testRejectsSignatureFromAnotherKey() throws {
        let attacker = P256.Signing.PrivateKey()
        let header = makeHeader(sig: try sign(body, with: attacker))

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: [keyID: P256.Signing.PrivateKey().publicKey]
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .signatureMismatch)
        }
    }

    /// A signature is only meaningful for the key ID it was issued under: re-labelling a genuine
    /// signature as another trusted key must not verify.
    func testRejectsGenuineSignatureRelabelledAsAnotherKeyID() throws {
        let old = P256.Signing.PrivateKey()
        let new = P256.Signing.PrivateKey()
        let trusted = ["old-key": old.publicKey, "new-key": new.publicKey]
        let header = makeHeader(keyID: "new-key", sig: try sign(body, with: old))

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: trusted
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .signatureMismatch)
        }
    }

    func testRejectsUnknownKeyID() throws {
        let privateKey = P256.Signing.PrivateKey()
        let header = makeHeader(keyID: "rotated-away", sig: try sign(body, with: privateKey))

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: [keyID: privateKey.publicKey]
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .untrustedKeyID("rotated-away"))
        }
    }

    func testRejectsWhenNoKeysParsed() throws {
        let privateKey = P256.Signing.PrivateKey()
        let header = makeHeader(sig: try sign(body, with: privateKey))

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: [:]
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .noTrustedKeys)
        }
    }

    func testRejectsUnsupportedAlgorithm() throws {
        let privateKey = P256.Signing.PrivateKey()
        let header = makeHeader(alg: "rs256", sig: try sign(body, with: privateKey))

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: [keyID: privateKey.publicKey]
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .unsupportedAlgorithm("rs256"))
        }
    }

    func testAcceptsAlgorithmLabelCaseInsensitively() throws {
        let privateKey = P256.Signing.PrivateKey()
        let header = makeHeader(alg: "ES256", sig: try sign(body, with: privateKey))

        XCTAssertNoThrow(try AJPReleaseConfigVerifier.verify(
            body: body, headerValue: header, trustedKeys: [keyID: privateKey.publicKey]
        ))
    }

    func testRejectsMalformedSignature() throws {
        let privateKey = P256.Signing.PrivateKey()
        let trusted = [keyID: privateKey.publicKey]

        let cases = [
            "!!!not base64!!!",                                  // undecodable
            Data("not a DER signature".utf8).base64EncodedString(), // decodes, not DER
            // Raw r||s instead of DER — the format the server does *not* send.
            try P256.Signing.PrivateKey().signature(for: body).rawRepresentation.base64EncodedString(),
        ]

        for sig in cases {
            XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
                body: body, headerValue: makeHeader(sig: sig), trustedKeys: trusted
            ), "sig: \(sig)") { error in
                XCTAssertEqual(error as? AJPSignatureVerificationError, .malformedSignature, "sig: \(sig)")
            }
        }
    }

    func testVerifiesByteForByteNotByJSONEquivalence() throws {
        // The signature covers raw bytes, so a semantically identical body with different
        // whitespace must still fail. This is what makes "verify before parsing" load-bearing.
        let privateKey = P256.Signing.PrivateKey()
        let header = makeHeader(sig: try sign(body, with: privateKey))
        let reformatted = Data(#"{"config": {"version": "1.0.0"}}"#.utf8)

        XCTAssertThrowsError(try AJPReleaseConfigVerifier.verify(
            body: reformatted, headerValue: header, trustedKeys: [keyID: privateKey.publicKey]
        )) { error in
            XCTAssertEqual(error as? AJPSignatureVerificationError, .signatureMismatch)
        }
    }

    // MARK: - Trust store

    func testTrustStoreParsesConfiguredKeys() throws {
        let store = AJPReleaseConfigTrustStore(pems: [keyID: serverPEM])

        XCTAssertTrue(store.isConfigured)
        XCTAssertEqual(store.keys.count, 1)
        XCTAssertTrue(store.invalidKeyIDs.isEmpty)
    }

    func testTrustStoreIsUnconfiguredWhenNoKeysSupplied() {
        let store = AJPReleaseConfigTrustStore(pems: [:])

        XCTAssertFalse(store.isConfigured)
        XCTAssertTrue(store.keys.isEmpty)
        XCTAssertTrue(store.invalidKeyIDs.isEmpty)
    }

    /// The silent-disable hole: a typo'd PEM parses to zero keys. If that were indistinguishable
    /// from "no keys supplied", verification would quietly switch itself off.
    func testTrustStoreDistinguishesInvalidKeysFromNoKeys() {
        let store = AJPReleaseConfigTrustStore(pems: ["typo-key": "-----BEGIN PUBLIC KEY-----\noops\n-----END PUBLIC KEY-----"])

        XCTAssertTrue(store.isConfigured, "a bad PEM must not look like an opt-out")
        XCTAssertTrue(store.keys.isEmpty)
        XCTAssertEqual(store.invalidKeyIDs, ["typo-key"])
    }

    func testTrustStoreKeepsGoodKeysAlongsideBadOnes() throws {
        let store = AJPReleaseConfigTrustStore(pems: [
            "good-key": serverPEM,
            "bad-key": "garbage",
        ])

        XCTAssertTrue(store.isConfigured)
        XCTAssertEqual(Array(store.keys.keys), ["good-key"])
        XCTAssertEqual(store.invalidKeyIDs, ["bad-key"])
    }

    // MARK: - Reason codes

    func testReasonCodesAreStableAndDropAttackerInput() {
        XCTAssertEqual(AJPSignatureVerificationError.missingHeader.reasonCode, "missing_header")
        XCTAssertEqual(AJPSignatureVerificationError.malformedHeader.reasonCode, "malformed_header")
        XCTAssertEqual(AJPSignatureVerificationError.noTrustedKeys.reasonCode, "no_trusted_keys")
        XCTAssertEqual(AJPSignatureVerificationError.malformedSignature.reasonCode, "malformed_signature")
        XCTAssertEqual(AJPSignatureVerificationError.signatureMismatch.reasonCode, "signature_mismatch")

        // Associated values must not leak into the analytics vocabulary.
        XCTAssertEqual(AJPSignatureVerificationError.untrustedKeyID("../../etc").reasonCode, "untrusted_key_id")
        XCTAssertEqual(AJPSignatureVerificationError.unsupportedAlgorithm("<script>").reasonCode, "unsupported_alg")
    }
}
