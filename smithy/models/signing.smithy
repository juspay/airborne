$version: "2.0"

namespace io.airborne.server

/// Immutable, client-visible identifier for a signing key. It is unique within an
/// application and may contain lowercase letters, digits, and single dashes only.
@length(min: 1, max: 50)
@pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
string SigningKeyId

/// A signing key used to sign the release config an application serves to its SDKs.
///
/// The private key never leaves the server: it is not part of this shape and is not
/// returned by any endpoint. Only the public key is exposed, so that clients can verify
/// the x-airborne-signature header on a served release config.
structure SigningKey {
    /// Key ID chosen when the key is created. This is the value clients send in the
    /// x-signing-key-id header to have a release config signed with this key, and the
    /// value that appears in the keyid field of the x-airborne-signature response header.
    @required
    key_id: SigningKeyId

    /// Algorithm the key signs with. Always "ecdsa-p256" today.
    @required
    algorithm: String

    /// Public half of the keypair, PEM-encoded (SPKI). Use this to verify signatures
    /// produced with this key.
    @required
    public_key: String

    /// Whether this is the application's default key. Exactly one key per application is
    /// the default: it signs every release config served without an explicit
    /// x-signing-key-id header.
    @required
    is_default: Boolean

    /// Whether the key is disabled. A disabled key signs nothing and is rejected if it is
    /// named in x-signing-key-id. The default key cannot be disabled.
    @required
    disabled: Boolean

    /// Time the key was created.
    @required
    @timestampFormat("date-time")
    created_at: Timestamp
}

/// List of signing keys.
list SigningKeyList {
    member: SigningKey
}

/// Headers for listing an application's signing keys.
structure ListSigningKeysRequest {
    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// An application's signing keys, default first.
structure ListSigningKeysResponse {
    /// List of signing keys
    @required
    data: SigningKeyList
}

/// Request body and headers for creating a signing key.
structure CreateSigningKeyRequest {
    /// ID for the new key. Must be unique within the application. It may contain only
    /// lowercase letters (a-z), digits (0-9), and single dashes, and cannot start or end
    /// with a dash.
    @required
    key_id: SigningKeyId

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Path and headers for downloading a signing key's public key.
structure GetSigningKeyPublicKeyRequest {
    /// ID of the signing key.
    @required
    @httpLabel
    keyId: SigningKeyId

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// A PEM-encoded document.
@mediaType("application/x-pem-file")
string PemDocument

/// A signing key's public key, returned as a PEM document rather than as JSON.
structure GetSigningKeyPublicKeyResponse {
    /// The public half of the keypair, PEM-encoded (SPKI), as the raw response body.
    @required
    @httpPayload
    public_key: PemDocument
}

/// Path, body, and headers for updating a signing key.
structure UpdateSigningKeyRequest {
    /// ID of the signing key.
    @required
    @httpLabel
    keyId: SigningKeyId

    /// Whether the key should be disabled. The application's default key cannot be
    /// disabled — promote another key to default first.
    @required
    disabled: Boolean

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Path and headers for promoting a signing key to be the application's default.
structure SetDefaultSigningKeyRequest {
    /// ID of the signing key.
    @required
    @httpLabel
    keyId: SigningKeyId

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// List the signing keys of an application, with the default key first. Every application
/// is provisioned with a default key when it is created, so this is never empty. The
/// private key is never returned — only the public key, which is enough to verify a
/// signed release config. Pass the organisation and application in the x-organisation and
/// x-application headers. Requires a bearer token.
@tags(["Signing keys"])
@http(method: "GET", uri: "/api/signing-keys")
@requiresauth
@readonly
operation ListSigningKeys {
    input: ListSigningKeysRequest
    output: ListSigningKeysResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Create a signing key for an application. The server generates an ECDSA P-256 keypair
/// and keeps the private half; the response carries only the public key. The new key is
/// not used until it is made the default (see SetDefaultSigningKey) or named explicitly
/// in the x-signing-key-id header — except for the very first key an application has,
/// which becomes its default automatically. Key IDs must be unique within the
/// application; a duplicate ID is rejected with a 409. IDs may contain only lowercase
/// letters, digits, and single dashes; a dash cannot be first, last, or repeated. Pass
/// the organisation and application in the x-organisation and x-application headers.
/// Requires a bearer token.
@tags(["Signing keys"])
@http(method: "POST", uri: "/api/signing-keys", code: 201)
@requiresauth
operation CreateSigningKey {
    input: CreateSigningKeyRequest
    output: SigningKey
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
        ConflictError
    ]
}

/// Download a signing key's public key as a PEM document (SPKI, "application/x-pem-file",
/// served as an attachment). Distribute this to whatever verifies the x-airborne-signature
/// header on a served release config. The private key is never downloadable. Pass the
/// organisation and application in the x-organisation and x-application headers. Requires
/// a bearer token.
@tags(["Signing keys"])
@http(method: "GET", uri: "/api/signing-keys/{keyId}/public-key")
@requiresauth
@readonly
operation GetSigningKeyPublicKey {
    input: GetSigningKeyPublicKeyRequest
    output: GetSigningKeyPublicKeyResponse
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// Enable or disable a signing key. A disabled key signs nothing, and naming it in
/// x-signing-key-id is rejected. The application's default key cannot be disabled — it is
/// what signs every release config served without an explicit key — so promote another key
/// to default first (see SetDefaultSigningKey). Pass the organisation and application in
/// the x-organisation and x-application headers. Requires a bearer token.
@tags(["Signing keys"])
@http(method: "PATCH", uri: "/api/signing-keys/{keyId}")
@requiresauth
operation UpdateSigningKey {
    input: UpdateSigningKeyRequest
    output: SigningKey
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// Make a signing key the application's default: from then on it signs every release
/// config served without an explicit x-signing-key-id header. Exactly one key per
/// application is the default, so the previous default is demoted in the same operation.
/// A disabled key cannot be made the default — enable it first. This is how a key is
/// rotated: create a new key, distribute its public key to your clients, then promote it.
/// Pass the organisation and application in the x-organisation and x-application headers.
/// Requires a bearer token.
@tags(["Signing keys"])
@http(method: "POST", uri: "/api/signing-keys/{keyId}/default")
@requiresauth
operation SetDefaultSigningKey {
    input: SetDefaultSigningKeyRequest
    output: SigningKey
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}
