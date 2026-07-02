$version: "2.0"

namespace io.airborne.server

/// User credentials for login
structure UserCredentials {
    /// Gmail of the user
    @required
    client_id: String

    /// Password of the user
    @required
    client_secret: String
}

/// Tokens returned after a successful login.
structure UserToken {
    /// Bearer token to send in the Authorization header on authenticated requests.
    @required
    access_token: String

    /// Type of the token (e.g. "Bearer").
    @required
    token_type: String

    /// Lifetime of the access token, in seconds.
    @required
    expires_in: Long

    /// Token used to obtain a new access token once the current one expires.
    @required
    refresh_token: String

    /// Lifetime of the refresh token, in seconds.
    @required
    refresh_expires_in: Long
}

/// Information about the authenticated user.
structure User {
    /// Unique identifier of the user.
    @required
    user_id: String

    /// Organisations the user belongs to, with the user's access level in each.
    @required
    organisations: Organisations

    /// Tokens issued for the user, when available.
    user_token: UserToken
}

/// Get the authenticated user's profile, including the organisations they belong to and the caller's access level in each. Requires a bearer token.
@tags(["Users"])
@http(method: "GET", uri: "/api/users")
@readonly
@requiresauth
operation GetUser {
    output: User
    errors: [
        Unauthorized
    ]
}

/// Exchange user credentials (client_id and client_secret) for an access token and a refresh token. Public — no auth token required. Call this first, then send the returned access token as a bearer token on subsequent requests.
@tags(["Authentication"])
@http(method: "POST", uri: "/api/token/issue")
@auth([])
operation PostLogin {
    input: UserCredentials
    output: UserToken
    errors: [
        Unauthorized
    ]
}
