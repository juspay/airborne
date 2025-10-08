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

/// User token response
structure UserToken {
    @required
    access_token: String

    @required
    token_type: String

    @required
    expires_in: Long

    @required
    refresh_token: String

    @required
    refresh_expires_in: Long
}

/// User information
structure User {
    @required
    user_id: String

    @required
    organisations: Organisations

    user_token: UserToken
}

/// Get user request operation
@http(method: "GET", uri: "/api/users")
@readonly
@requiresauth
operation GetUser {
    output: User
    errors: [
        Unauthorized
    ]
}

/// Login request operation
@http(method: "POST", uri: "/api/token/issue")
@auth([])
operation PostLogin {
    input: UserCredentials
    output: User
    errors: [
        Unauthorized
    ]
}
