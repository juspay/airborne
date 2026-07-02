$version: "2.0"

namespace io.airborne.server

/// Application information
structure Application {
    /// Name of the application
    @required
    application: String

    /// Name of the organisation
    @required
    organisation: String

    /// Access levels of the user for the organisation
    @required
    access: StringList
}

/// List of applications
list Applications {
    member: Application
}

/// Create application request
structure CreateApplicationRequest {
    /// Name of the application
    @required
    application: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String
}

/// Create a new application inside an organisation. Pass the target organisation in the x-organisation header. Returns the created application and the caller's access levels. Requires a bearer token.
@tags(["Applications"])
@http(method: "POST", uri: "/api/organisations/applications/create")
@requiresauth
operation CreateApplication {
    input: CreateApplicationRequest
    output: Application
    errors: [
        Unauthorized
        BadRequestError
    ]
}
