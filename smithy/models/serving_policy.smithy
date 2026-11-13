$version: "2.0"
namespace io.airborne.server
structure ServingPolicy { @required strict: Boolean, @required deployment_override: Boolean, @required effective_strict: Boolean }
structure GetServingPolicyInput {
    @required
    @httpHeader("x-organisation")
    organisation: String
    @required
    @httpHeader("x-application")
    application: String
}
structure PutServingPolicyInput {
    @required
    @httpHeader("x-organisation")
    organisation: String
    @required
    @httpHeader("x-application")
    application: String
    @required
    strict: Boolean
}
map ServingPreviewContext { key: String, value: String }
structure PreviewServingPolicyInput {
    @required
    @httpHeader("x-organisation")
    organisation: String
    @required
    @httpHeader("x-application")
    application: String
    @required context: ServingPreviewContext
    @required toss: String
}
structure ServingPreviewOutput { @required serving_policy: ServingPolicy, @required context: ServingPreviewContext, @required toss: String, config_version: String, package_version: Document, @required targeted: Boolean, @required would_stop_serving: Boolean, @required strict_status: Integer, @required scope: String }
/// Read stored and effective strict serving policy.
@requiresauth
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/serving-policy", code: 200)
@readonly
operation GetServingPolicy { input: GetServingPolicyInput, output: ServingPolicy, errors: [BadRequestError, Unauthorized, ForbiddenError, ApprovalRequiredError, NotFoundError, ConflictError, InternalServerError] }
/// Change strict serving. Requires release update permission. Both directions require set_strict_serving approval when maker-checker is enabled. Payload body is {strict: boolean}, without release_id.
@requiresauth
@tags(["Control Center"])
@http(method: "PUT", uri: "/api/control-center/serving-policy", code: 200)
operation PutServingPolicy { input: PutServingPolicyInput, output: ServingPolicy, errors: [BadRequestError, Unauthorized, ForbiddenError, ApprovalRequiredError, NotFoundError, ConflictError, InternalServerError] }
/// Read-only evaluation of one context and toss. Returns whether enabling strict serving removes default fallback; this is not a population-wide impact count.
@requiresauth
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/serving-policy/preview", code: 200)
@readonly
operation PreviewServingPolicy { input: PreviewServingPolicyInput, output: ServingPreviewOutput, errors: [BadRequestError, Unauthorized, ForbiddenError, ApprovalRequiredError, NotFoundError, ConflictError, InternalServerError] }
