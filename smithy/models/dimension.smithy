$version: "2.0"

namespace io.airborne.server

enum DimensionType {
    STANDARD = "standard"
    COHORT = "cohort"
}

/// Create dimension request type
structure CreateDimensionRequest {
    /// Name of the dimension
    @required
    dimension: String

    /// Description of the dimension
    @required
    description: String

    /// Type of the dimension
    @required
    dimension_type: DimensionType

    /// Identifier of the dimension this depends on (required for cohort dimensions, ignored for standard dimensions)
    depends_on: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

structure CreateDimensionResponse {
    /// Name of the dimension
    @required
    dimension: String

    /// Description of the dimension
    @required
    description: Document

    /// Position of the dimension
    @required
    position: Integer

    /// Schema of the dimension
    schema: Document

    /// Reason for the change
    @required
    change_reason: String
}

structure ListDimensionsRequest {
    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String

    @httpQuery("page")
    page: Integer

    @httpQuery("count")
    count: Integer
}

structure DimensionResponse {
    /// Name of the dimension
    @required
    dimension: String

    /// Description of the dimension
    @required
    description: Document

    /// Position of the dimension
    @required
    position: Integer

    /// Schema of the dimension
    schema: Document

    /// Reason for the change
    @required
    change_reason: String

    mandatory: Boolean
}

list DimensionList {
    member: DimensionResponse
}

map DimensionsMap {
    /// Dimension name
    key: String

    /// Dimension value
    value: Document
}

structure ListDimensionsResponse {
    total_pages: Integer
    total_items: Integer
    data: DimensionList
}

structure UpdateDimensionRequest {
    /// Name of the dimension
    @required
    @httpLabel
    dimension: String

    /// Reason for the change
    @required
    change_reason: String

    /// New position of the dimension
    @required
    position: Integer

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

structure DeleteDimensionRequest {
    /// Name of the dimension
    @required
    @httpLabel
    dimension: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Create dimension request operation
@http(method: "POST", uri: "/api/organisations/applications/dimension/create")
@requiresauth
operation CreateDimension {
    input: CreateDimensionRequest
    output: CreateDimensionResponse
    errors: [
        BadRequestError
        Unauthorized
    ]
}

/// List dimensions request operation
@http(method: "GET", uri: "/api/organisations/applications/dimension/list")
@requiresauth
@readonly
operation ListDimensions {
    input: ListDimensionsRequest
    output: ListDimensionsResponse
    errors: [
        BadRequestError
        Unauthorized
    ]
}

/// Update dimension request operation
@http(method: "PUT", uri: "/api/organisations/applications/dimension/{dimension}")
@requiresauth
@idempotent
operation UpdateDimension {
    input: UpdateDimensionRequest
    output: DimensionResponse
    errors: [
        BadRequestError
        Unauthorized
        NotFoundError
    ]
}

/// Delete dimension request operation
@http(method: "DELETE", uri: "/api/organisations/applications/dimension/{dimension}")
@requiresauth
@idempotent
operation DeleteDimension {
    input: DeleteDimensionRequest
    output: Unit
    errors: [
        BadRequestError
        Unauthorized
        NotFoundError
    ]
}
