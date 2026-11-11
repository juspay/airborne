$version: "2.0"

namespace io.airborne.server

/// Unauthorized error
@error("client")
@httpError(401)
structure Unauthorized {
    /// Airborne error code (for example, AB_004).
    @required
    code: String

    @required
    message: String
}

/// Bad request error
@error("client")
@httpError(400)
structure BadRequestError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Airborne error code (AB_005).
    @required
    code: String

    @required
    message: String
}

/// Not found error
@error("client")
@httpError(404)
structure NotFoundError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Airborne error code (AB_001).
    @required
    code: String

    @required
    message: String
}

/// Internal server error
@error("server")
@httpError(500)
structure InternalServerError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Airborne error code (AB_003).
    @required
    code: String

    @required
    message: String
}

// Forbidden error
@error("client")
@httpError(403)
structure ForbiddenError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Airborne error code (AB_006).
    @required
    code: String

    @required
    message: String
}

/// A direct release write was refused because this application requires an approved deployment request.
@error("client")
@httpError(403)
structure ApprovalRequiredError {
    @required
    code: String

    @required
    application: String

    @required
    message: String
}

/// Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
@error("client")
@httpError(409)
structure ConflictError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Airborne error code (AB_007).
    @required
    code: String

    @required
    message: String
}

/// Returned by rollback when the release is a concluded release that is no longer the latest live release for its dimensions. Nothing is changed.
@error("client")
@httpError(409)
structure ReleaseSupersededError {
    /// Rollback block code (`superseded`).
    @required
    code: String

    @required
    message: String

    /// Identifier of the release that is currently live for the same dimensions, or JSON null when no live release exists.
    @required
    current_live_release_id: Document
}

/// Returned by rollback when no earlier live release exists or the historical package and config cannot be reconciled. Nothing is created.
@error("client")
@httpError(422)
structure RollbackUnprocessableError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Rollback block code: `no_predecessor` or `incompatible`.
    @required
    code: String

    /// Actionable explanation of why the rollback cannot proceed.
    @required
    message: String

    /// The live release for this dimensions context, or JSON null.
    @required
    current_live_release_id: Document
}

/// Stage of a rollback re-release at which a failure occurred after the replacement release was created.
enum RollbackFailureStage {
    /// The server is creating or recovering the replacement before recording its identifier.
    CREATE = "create"
    RAMP = "ramp"
    CONCLUDE = "conclude"
}

/// Returned when the durable replacement create, ramp, or conclude step needs recovery. Repeat the same rollback after reviewing upstream state.
@error("server")
@httpError(502)
structure RollbackPartialFailureError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String
    /// Airborne error code (AB_003).
    @required
    code: String

    @required
    message: String

    /// Identifier of the replacement release, or JSON null when no replacement was created.
    @required
    replacement_release_id: Document

    /// Durable rollback operation identifier.
    @required
    rollback_operation_id: String

    /// Step that failed.
    @required
    stage: RollbackFailureStage
}

/// A write has an unknown upstream outcome. Inspect its real state and change history before resolving it; elapsed time alone does not establish rejection. An upstream 4xx is not proof that nothing was written, because the upstream handler can return it after configuration effects. While the operation is unresolved, writes for the application stay paused. When the 409 comes from a recovery attempt it can name the config keys or contexts that changed and must be restored, or finished and resolved as applied.
@error("client")
@httpError(409)
structure UnresolvedOperationError {
    @required
    code: String

    @required
    message: String

    @required
    operation_id: String

    /// The exact state expected after the upstream write.
    @required
    expected: Document

    /// The state observed before dispatch.
    @required
    before: Document

    @required
    upstream_workspace: Document

    @required
    upstream_org: Document

    /// True when this request itself may have changed upstream state; absent when an earlier write is blocking this request.
    own_attempt: Boolean
}

/// The rollback replacement was changed outside the durable rollback operation. Human inspection is required; do not resume automatically.
@error("client")
@httpError(409)
structure RollbackReplacementChangedError {
    @required
    code: String

    @required
    message: String

    @required
    operation_id: String

    @required
    replacement_release_id: Document
}

@error("client")
@httpError(429)
structure TooManyRequestsError { @required code: String, @required message: String }
@error("server")
@httpError(503)
structure ServiceUnavailableError {
    /// Present when an approved action failed and its failed status was saved.
    request_id: String
    request_status: String @required code: String, @required message: String }
