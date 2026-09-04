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

// ─── Validation Functions ───

/// The application's validation function
structure ValidationFunctionResponse {
    /// JavaScript source defining a synchronous `function main(args)`
    @required
    function_code: String
}

/// Update validation function request
structure UpdateValidationFunctionRequest {
    /// JavaScript source defining a synchronous `function main(args)`
    @required
    function_code: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Get validation function request
structure GetValidationFunctionRequest {
    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Test validation function request
structure TestValidationFunctionRequest {
    /// JavaScript source to test (need not be saved)
    @required
    function_code: String

    /// Arguments passed to main, mirroring the release validation context
    @required
    test_args: Document

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Test validation function response
structure TestValidationFunctionResponse {
    /// Whether the code loaded and executed successfully
    @required
    valid: Boolean

    /// The boolean returned by main, when execution succeeded
    result: Boolean

    /// Error message, when the code failed to load or execute
    error: String
}

/// Get the application's release validation function. Apps that never saved one get the default, which accepts every release. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Applications"])
@http(method: "GET", uri: "/api/organisations/applications/validation-functions")
@requiresauth
@readonly
operation GetValidationFunction {
    input: GetValidationFunctionRequest
    output: ValidationFunctionResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Save the application's release validation function. The code must define a synchronous `function main(args)` returning a boolean; it runs before every release create/update, and returning false rejects the release. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Applications"])
@http(method: "PUT", uri: "/api/organisations/applications/validation-functions")
@requiresauth
@idempotent
operation UpdateValidationFunction {
    input: UpdateValidationFunctionRequest
    output: ValidationFunctionResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Run validation code against test arguments without saving it, returning the boolean result or the execution error. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Applications"])
@http(method: "POST", uri: "/api/organisations/applications/validation-functions/test")
@requiresauth
operation TestValidationFunction {
    input: TestValidationFunctionRequest
    output: TestValidationFunctionResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}
