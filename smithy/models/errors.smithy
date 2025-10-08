$version: "2.0"

namespace io.airborne.server

/// Unauthorized error
@error("client")
@httpError(401)
structure Unauthorized {
    @required
    message: String
}

/// Bad request error
@error("client")
@httpError(400)
structure BadRequestError {
    @required
    message: String
}

/// Not found error
@error("client")
@httpError(404)
structure NotFoundError {
    @required
    message: String
}

/// Internal server error
@error("server")
@httpError(500)
structure InternalServerError {
    @required
    message: String
}

// Forbidden error
@error("client")
@httpError(403)
structure ForbiddenError {
    @required
    message: String
}
