$version: "2.0"

namespace io.airborne.server

/// Kind of targeting dimension.
enum DimensionType {
    /// A standard dimension with independent values.
    STANDARD = "standard"

    /// A cohort dimension whose values depend on another dimension.
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

/// A created dimension.
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

/// Query parameters and headers for listing dimensions.
structure ListDimensionsRequest {
    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String

    /// Page number for pagination.
    @httpQuery("page")
    page: Integer

    /// Number of dimensions per page.
    @httpQuery("count")
    count: Integer
}

/// A targeting dimension.
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

    /// Whether a value for this dimension is required when targeting.
    mandatory: Boolean
}

/// List of dimensions.
list DimensionList {
    member: DimensionResponse
}

/// Map of dimension name to value.
map DimensionsMap {
    /// Dimension name
    key: String

    /// Dimension value
    value: Document
}

/// Paginated list of dimensions.
structure ListDimensionsResponse {
    /// Total number of pages.
    total_pages: Integer

    /// Total number of dimensions.
    total_items: Integer

    /// Dimensions on this page.
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

/// Create a targeting dimension (standard or cohort) that releases can be targeted against. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Dimensions"])
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

/// List the targeting dimensions defined for an application, in priority order, with pagination. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Dimensions"])
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

/// Update a dimension, identified by name in the path — for example to change its priority position. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Dimensions"])
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

/// Delete a dimension by name. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Dimensions"])
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
