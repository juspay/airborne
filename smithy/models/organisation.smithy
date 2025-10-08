$version: "2"

namespace io.airborne.server

/// Organisation information
structure Organisation {
    /// Name of the organisation
    @required
    name: String

    /// List of applications under the organisation
    @required
    applications: Applications

    /// Access levels of the user for the organisation
    @required
    access: StringList
}

/// List of organisations
list Organisations {
    member: Organisation
}

/// Organisation creation request
structure CreateOrganisationRequest {
    @required
    name: String
}

/// List organisations response
structure ListOrganisationsResponse {
    /// List of organisations
    @required
    organisations: Organisations
}

/// Request organisation request
structure RequestOrganisationRequest {
    /// Name of the organisation
    @required
    organisation_name: String

    /// Name of the requester
    @required
    name: String

    /// Email of the requester
    @required
    email: String

    /// Phone number of the requester
    @required
    phone: String

    /// App store link
    @required
    app_store_link: String

    /// Play store link
    @required
    play_store_link: String
}

/// Request organisation response
structure RequestOrganisationResponse {
    /// Name of the organisation
    @required
    organisation_name: String

    /// Message indicating the status of the request
    @required
    message: String
}

/// Create organisation request operation
@http(method: "POST", uri: "/api/organisations/create")
@requiresauth
operation CreateOrganisation {
    input: CreateOrganisationRequest
    output: Organisation
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Request organisation request operation
@http(method: "POST", uri: "/api/organisations/request")
@requiresauth
operation RequestOrganisation {
    input: RequestOrganisationRequest
    output: RequestOrganisationResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// List organisations request operation
@http(method: "GET", uri: "/api/organisations/")
@readonly
@requiresauth
operation ListOrganisations {
    output: ListOrganisationsResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}
