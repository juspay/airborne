//
//  AJPReleaseConfigVerifier.swift
//  Airborne
//

import Foundation
import CryptoKit

// MARK: - Errors

/// The reason a release config body could not be trusted.
public enum AJPSignatureVerificationError: Error, Equatable {

    /// The response carried no signature header.
    case missingHeader

    /// The signature header was present but could not be parsed.
    case malformedHeader

    /// The header named an algorithm this SDK cannot verify.
    case unsupportedAlgorithm(String)

    /// The header named a key that is not in the configured trust store.
    case untrustedKeyID(String)

    /// Keys were configured, but none of them could be parsed.
    case noTrustedKeys

    /// The `sig` field was not base64, or not a DER ECDSA signature.
    case malformedSignature

    /// The signature did not match the body.
    case signatureMismatch

    /// A stable, low-cardinality code safe to use as an analytics value.
    ///
    /// Deliberately drops the associated values: those echo server- or
    /// attacker-supplied strings, which must never widen the event vocabulary.
    public var reasonCode: String {
        switch self {
        case .missingHeader:        return "missing_header"
        case .malformedHeader:      return "malformed_header"
        case .unsupportedAlgorithm: return "unsupported_alg"
        case .untrustedKeyID:       return "untrusted_key_id"
        case .noTrustedKeys:        return "no_trusted_keys"
        case .malformedSignature:   return "malformed_signature"
        case .signatureMismatch:    return "signature_mismatch"
        }
    }
}

/// The reason a configured public key could not be used.
public enum AJPPublicKeyError: Error, Equatable {

    /// The PEM armor or its base64 payload was malformed.
    case malformedPEM

    /// The key decoded, but is not a P-256 SPKI key with an uncompressed point.
    case notP256SPKI
}

// MARK: - Parsed header

/// The fields of an `X-Airborne-Signature` header.
public struct AJPSignatureHeader: Equatable {

    /// Identifies which key produced the signature. Selects the public key to verify against.
    public let keyID: String

    /// The signature algorithm label, e.g. `es256`.
    public let alg: String

    /// Base64 of the DER-encoded signature.
    public let signatureBase64: String

    public init(keyID: String, alg: String, signatureBase64: String) {
        self.keyID = keyID
        self.alg = alg
        self.signatureBase64 = signatureBase64
    }
}

// MARK: - Trust store

/// The public keys a release config may be verified against, parsed once up front.
///
/// Parsing eagerly means a malformed PEM surfaces at boot rather than silently at fetch time.
public struct AJPReleaseConfigTrustStore {

    /// Whether any keys were supplied at all.
    ///
    /// Tracked separately from `keys` on purpose: if callers inferred "verification is off"
    /// from an empty `keys`, then a single typo in a PEM would parse to zero keys and
    /// silently disable verification. A misconfiguration must never look like an opt-out.
    public let isConfigured: Bool

    /// The successfully parsed keys, by key ID.
    public let keys: [String: P256.Signing.PublicKey]

    /// The key IDs whose PEM failed to parse.
    public let invalidKeyIDs: [String]

    /// - Parameter pems: Public keys in SPKI PEM form, keyed by the key ID the server reports.
    public init(pems: [String: String]) {
        var parsed: [String: P256.Signing.PublicKey] = [:]
        var invalid: [String] = []

        for (keyID, pem) in pems {
            if let key = try? AJPReleaseConfigVerifier.publicKey(fromPEM: pem) {
                parsed[keyID] = key
            } else {
                invalid.append(keyID)
            }
        }

        self.isConfigured = !pems.isEmpty
        self.keys = parsed
        self.invalidKeyIDs = invalid
    }
}

// MARK: - Verifier

/// Verifies the ECDSA P-256 signature the server sends alongside a release config.
///
/// The signature covers the exact raw response body bytes, so callers must verify the
/// bytes as received and only parse them afterwards.
public enum AJPReleaseConfigVerifier {

    /// The response header carrying the signature.
    public static let signatureHeaderName = "X-Airborne-Signature"

    /// The only algorithm label this SDK verifies: ECDSA P-256 over a SHA-256 digest.
    public static let supportedAlgorithm = "es256"

    private static let pemBegin = "-----BEGIN PUBLIC KEY-----"
    private static let pemEnd = "-----END PUBLIC KEY-----"

    /// The DER prefix of an SPKI P-256 (prime256v1) public key holding an uncompressed point:
    ///
    ///     SEQUENCE (0x59) {
    ///         SEQUENCE (0x13) { OID id-ecPublicKey, OID prime256v1 },
    ///         BIT STRING (0x42 bytes, 0 unused bits)
    ///     }
    ///
    /// Matching these bytes asserts both OIDs, the structure, and every length in one step —
    /// strictly more than a hand-rolled DER walk would check, with no parser to get wrong.
    /// DER is canonical, so a usable key has exactly one legal encoding here.
    private static let p256SPKIPrefix: [UInt8] = [
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01,
        0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
    ]

    /// Total bytes of a P-256 SPKI key: the prefix above plus an uncompressed point.
    private static let spkiLength = 91

    /// Bytes of an uncompressed P-256 point: `0x04 || X(32) || Y(32)`.
    private static let pointLength = 65

    // MARK: Public keys

    /// Reads an SPKI PEM public key.
    ///
    /// CryptoKit's `pemRepresentation` and `derRepresentation` initialisers are iOS 14+, so the
    /// raw point is extracted by hand to keep one code path on the SDK's iOS 13 deployment floor.
    ///
    /// - Parameter pem: An SPKI PEM, with or without armor.
    /// - Returns: The parsed key.
    /// - Throws: `AJPPublicKeyError`.
    public static func publicKey(fromPEM pem: String) throws -> P256.Signing.PublicKey {
        let base64 = try base64Payload(fromPEM: pem)

        // Strict decoding: `.ignoreUnknownCharacters` would silently decode any leftover armor
        // text into the key material, since BEGIN/PUBLIC/KEY are themselves base64 characters.
        guard let der = Data(base64Encoded: base64) else {
            throw AJPPublicKeyError.malformedPEM
        }

        guard der.count == spkiLength,
              der.prefix(p256SPKIPrefix.count).elementsEqual(p256SPKIPrefix) else {
            throw AJPPublicKeyError.notP256SPKI
        }

        do {
            // Re-base the slice: `suffix` keeps the parent's indices, which x963Representation
            // reads through to the underlying buffer.
            return try P256.Signing.PublicKey(x963Representation: Data(der.suffix(pointLength)))
        } catch {
            // The point is off the curve or otherwise unusable.
            throw AJPPublicKeyError.notP256SPKI
        }
    }

    /// Strips PEM armor and whitespace, leaving the base64 payload.
    ///
    /// A bare base64 blob is accepted; the SPKI check in `publicKey(fromPEM:)` is the real gate.
    private static func base64Payload(fromPEM pem: String) throws -> String {
        var body = pem

        if let begin = body.range(of: pemBegin) {
            guard let end = body.range(of: pemEnd),
                  end.lowerBound >= begin.upperBound else {
                throw AJPPublicKeyError.malformedPEM
            }
            body = String(body[begin.upperBound..<end.lowerBound])
        } else if body.contains(pemEnd) {
            throw AJPPublicKeyError.malformedPEM
        }

        body.removeAll { $0.isWhitespace }

        guard !body.isEmpty else {
            throw AJPPublicKeyError.malformedPEM
        }
        return body
    }

    // MARK: Header

    /// Parses an `X-Airborne-Signature` header value.
    ///
    /// The header looks like `keyid="release-2026",alg="es256",sig="<base64>"`. Unknown fields
    /// are ignored so the server can add more later.
    ///
    /// - Throws: `AJPSignatureVerificationError.malformedHeader`.
    public static func parseSignatureHeader(_ value: String) throws -> AJPSignatureHeader {
        let text = value as NSString
        let matches = headerFieldPattern.matches(
            in: value,
            range: NSRange(location: 0, length: text.length)
        )

        var fields: [String: String] = [:]
        for match in matches where match.numberOfRanges == 3 {
            let name = text.substring(with: match.range(at: 1)).lowercased()
            fields[name] = text.substring(with: match.range(at: 2))
        }

        guard let keyID = fields["keyid"], !keyID.isEmpty,
              let alg = fields["alg"], !alg.isEmpty,
              let sig = fields["sig"], !sig.isEmpty else {
            throw AJPSignatureVerificationError.malformedHeader
        }

        return AJPSignatureHeader(keyID: keyID, alg: alg, signatureBase64: sig)
    }

    /// Matches each `name="value"` field. The value class excludes only `"`, which keeps
    /// base64's `+`, `/` and `=` intact.
    private static let headerFieldPattern: NSRegularExpression = {
        // The pattern is a literal, so it cannot fail to compile.
        // swiftlint:disable:next force_try
        try! NSRegularExpression(pattern: "(\\w+)=\"([^\"]*)\"")
    }()

    // MARK: Verification

    /// Verifies a signature header against the body it covers.
    ///
    /// - Parameters:
    ///   - body: The exact response bytes as received, before any parsing.
    ///   - headerValue: The raw `X-Airborne-Signature` value.
    ///   - trustedKeys: Public keys by key ID.
    /// - Returns: The key ID that verified, for logging.
    /// - Throws: `AJPSignatureVerificationError`.
    @discardableResult
    public static func verify(
        body: Data,
        headerValue: String,
        trustedKeys: [String: P256.Signing.PublicKey]
    ) throws -> String {
        let header = try parseSignatureHeader(headerValue)

        // Reject an unknown algorithm before touching any crypto.
        guard header.alg.lowercased() == supportedAlgorithm else {
            throw AJPSignatureVerificationError.unsupportedAlgorithm(header.alg)
        }

        guard !trustedKeys.isEmpty else {
            throw AJPSignatureVerificationError.noTrustedKeys
        }

        guard let key = trustedKeys[header.keyID] else {
            throw AJPSignatureVerificationError.untrustedKeyID(header.keyID)
        }

        guard let signatureData = Data(base64Encoded: header.signatureBase64) else {
            throw AJPSignatureVerificationError.malformedSignature
        }

        let signature: P256.Signing.ECDSASignature
        do {
            signature = try P256.Signing.ECDSASignature(derRepresentation: signatureData)
        } catch {
            throw AJPSignatureVerificationError.malformedSignature
        }

        // isValidSignature computes the SHA-256 digest itself, which is what makes this ES256.
        guard key.isValidSignature(signature, for: body) else {
            throw AJPSignatureVerificationError.signatureMismatch
        }

        return header.keyID
    }
}
