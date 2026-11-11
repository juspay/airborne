"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFileRequestFilterSensitiveLog = exports.RollbackReplacementChangedError = exports.RollbackReleaseAction = exports.ReleaseSupersededError = exports.ResolvedOperationState = exports.OperationRecoveryFinding = exports.TooManyRequestsError = exports.ServiceUnavailableError = exports.ControlCenterReleaseOutcome = exports.ControlCenterReleaseEventAction = exports.DeploymentAction = exports.RollbackSensitiveReason = exports.DimensionType = exports.ControlCenterPlatform = exports.ApprovalRequiredError = exports.UnresolvedOperationError = exports.RollbackUnprocessableError = exports.RollbackPartialFailureError = exports.RollbackFailureStage = exports.DeploymentRequestStatus = exports.DeploymentRequestAction = exports.Unauthorized = exports.NotFoundError = exports.InternalServerError = exports.ForbiddenError = exports.ConflictError = exports.BadRequestError = void 0;
const AirborneServiceException_1 = require("./AirborneServiceException");
class BadRequestError extends AirborneServiceException_1.AirborneServiceException {
    name = "BadRequestError";
    $fault = "client";
    request_id;
    request_status;
    code;
    constructor(opts) {
        super({
            name: "BadRequestError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, BadRequestError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
    }
}
exports.BadRequestError = BadRequestError;
class ConflictError extends AirborneServiceException_1.AirborneServiceException {
    name = "ConflictError";
    $fault = "client";
    request_id;
    request_status;
    code;
    constructor(opts) {
        super({
            name: "ConflictError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ConflictError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
    }
}
exports.ConflictError = ConflictError;
class ForbiddenError extends AirborneServiceException_1.AirborneServiceException {
    name = "ForbiddenError";
    $fault = "client";
    request_id;
    request_status;
    code;
    constructor(opts) {
        super({
            name: "ForbiddenError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ForbiddenError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
    }
}
exports.ForbiddenError = ForbiddenError;
class InternalServerError extends AirborneServiceException_1.AirborneServiceException {
    name = "InternalServerError";
    $fault = "server";
    request_id;
    request_status;
    code;
    constructor(opts) {
        super({
            name: "InternalServerError",
            $fault: "server",
            ...opts
        });
        Object.setPrototypeOf(this, InternalServerError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
    }
}
exports.InternalServerError = InternalServerError;
class NotFoundError extends AirborneServiceException_1.AirborneServiceException {
    name = "NotFoundError";
    $fault = "client";
    request_id;
    request_status;
    code;
    constructor(opts) {
        super({
            name: "NotFoundError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, NotFoundError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
    }
}
exports.NotFoundError = NotFoundError;
class Unauthorized extends AirborneServiceException_1.AirborneServiceException {
    name = "Unauthorized";
    $fault = "client";
    code;
    constructor(opts) {
        super({
            name: "Unauthorized",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, Unauthorized.prototype);
        this.code = opts.code;
    }
}
exports.Unauthorized = Unauthorized;
exports.DeploymentRequestAction = {
    CONCLUDE: "conclude",
    CREATE: "create",
    DISCARD: "discard",
    RAMP: "ramp",
    ROLLBACK: "rollback",
    SET_ROLLBACK_SENSITIVE: "set_rollback_sensitive",
    SET_STRICT_SERVING: "set_strict_serving",
    UPDATE: "update",
};
exports.DeploymentRequestStatus = {
    CANCELLED: "cancelled",
    EXECUTED: "executed",
    EXECUTING: "executing",
    EXPIRED: "expired",
    FAILED: "failed",
    PENDING: "pending",
    REJECTED: "rejected",
    STALE: "stale",
};
exports.RollbackFailureStage = {
    CONCLUDE: "conclude",
    CREATE: "create",
    RAMP: "ramp",
};
class RollbackPartialFailureError extends AirborneServiceException_1.AirborneServiceException {
    name = "RollbackPartialFailureError";
    $fault = "server";
    request_id;
    request_status;
    code;
    replacement_release_id;
    rollback_operation_id;
    stage;
    constructor(opts) {
        super({
            name: "RollbackPartialFailureError",
            $fault: "server",
            ...opts
        });
        Object.setPrototypeOf(this, RollbackPartialFailureError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
        this.replacement_release_id = opts.replacement_release_id;
        this.rollback_operation_id = opts.rollback_operation_id;
        this.stage = opts.stage;
    }
}
exports.RollbackPartialFailureError = RollbackPartialFailureError;
class RollbackUnprocessableError extends AirborneServiceException_1.AirborneServiceException {
    name = "RollbackUnprocessableError";
    $fault = "client";
    request_id;
    request_status;
    code;
    current_live_release_id;
    constructor(opts) {
        super({
            name: "RollbackUnprocessableError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, RollbackUnprocessableError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
        this.current_live_release_id = opts.current_live_release_id;
    }
}
exports.RollbackUnprocessableError = RollbackUnprocessableError;
class UnresolvedOperationError extends AirborneServiceException_1.AirborneServiceException {
    name = "UnresolvedOperationError";
    $fault = "client";
    code;
    operation_id;
    expected;
    before;
    upstream_workspace;
    upstream_org;
    own_attempt;
    constructor(opts) {
        super({
            name: "UnresolvedOperationError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, UnresolvedOperationError.prototype);
        this.code = opts.code;
        this.operation_id = opts.operation_id;
        this.expected = opts.expected;
        this.before = opts.before;
        this.upstream_workspace = opts.upstream_workspace;
        this.upstream_org = opts.upstream_org;
        this.own_attempt = opts.own_attempt;
    }
}
exports.UnresolvedOperationError = UnresolvedOperationError;
class ApprovalRequiredError extends AirborneServiceException_1.AirborneServiceException {
    name = "ApprovalRequiredError";
    $fault = "client";
    code;
    application;
    constructor(opts) {
        super({
            name: "ApprovalRequiredError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ApprovalRequiredError.prototype);
        this.code = opts.code;
        this.application = opts.application;
    }
}
exports.ApprovalRequiredError = ApprovalRequiredError;
exports.ControlCenterPlatform = {
    ANDROID: "android",
    IOS: "ios",
    OTHER: "other",
    WEB: "web",
};
exports.DimensionType = {
    COHORT: "cohort",
    STANDARD: "standard",
};
exports.RollbackSensitiveReason = {
    ONE_WAY_MIGRATION: "one_way_migration",
    SECURITY: "security",
};
exports.DeploymentAction = {
    APPROVED: "approved",
    CACHE_FAILED: "cache_failed",
    CACHE_RETRIED: "cache_retried",
    CANCELLED: "cancelled",
    CONCLUDED: "concluded",
    CREATED: "created",
    DISCARDED: "discarded",
    EMERGENCY_ACKNOWLEDGED: "emergency_acknowledged",
    EMERGENCY_ROLLBACK: "emergency_rollback",
    EXECUTED: "executed",
    EXPIRED: "expired",
    FAILED: "failed",
    POLICY_CHANGED: "policy_changed",
    RAMPED: "ramped",
    REJECTED: "rejected",
    REQUESTED: "requested",
    ROLLBACK_ABANDONED: "rollback_abandoned",
    ROLLED_BACK: "rolled_back",
    STALE: "stale",
};
exports.ControlCenterReleaseEventAction = {
    APPROVED: "approved",
    CANCELLED: "cancelled",
    CONCLUDED: "concluded",
    CREATED: "created",
    DISCARDED: "discarded",
    EMERGENCY_ACKNOWLEDGED: "emergency_acknowledged",
    EMERGENCY_ROLLBACK: "emergency_rollback",
    EXECUTED: "executed",
    EXPIRED: "expired",
    FAILED: "failed",
    OPERATION_RESOLVED: "operation_resolved",
    POLICY_CHANGED: "policy_changed",
    RAMPED: "ramped",
    REJECTED: "rejected",
    REQUESTED: "requested",
    ROLLED_BACK: "rolled_back",
    STALE: "stale",
};
exports.ControlCenterReleaseOutcome = {
    ACTIVE: "active",
    CONCLUDED_ON_CONTROL: "concluded_on_control",
    DISCARDED: "discarded",
    LIVE: "live",
    SUPERSEDED: "superseded",
};
class ServiceUnavailableError extends AirborneServiceException_1.AirborneServiceException {
    name = "ServiceUnavailableError";
    $fault = "server";
    request_id;
    request_status;
    code;
    constructor(opts) {
        super({
            name: "ServiceUnavailableError",
            $fault: "server",
            ...opts
        });
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
        this.request_id = opts.request_id;
        this.request_status = opts.request_status;
        this.code = opts.code;
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class TooManyRequestsError extends AirborneServiceException_1.AirborneServiceException {
    name = "TooManyRequestsError";
    $fault = "client";
    code;
    constructor(opts) {
        super({
            name: "TooManyRequestsError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, TooManyRequestsError.prototype);
        this.code = opts.code;
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
exports.OperationRecoveryFinding = {
    APPLIED: "applied",
    DID_NOT_APPLY: "did_not_apply",
};
exports.ResolvedOperationState = {
    CONFIRMED: "confirmed",
    REJECTED: "rejected",
};
class ReleaseSupersededError extends AirborneServiceException_1.AirborneServiceException {
    name = "ReleaseSupersededError";
    $fault = "client";
    code;
    current_live_release_id;
    constructor(opts) {
        super({
            name: "ReleaseSupersededError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ReleaseSupersededError.prototype);
        this.code = opts.code;
        this.current_live_release_id = opts.current_live_release_id;
    }
}
exports.ReleaseSupersededError = ReleaseSupersededError;
exports.RollbackReleaseAction = {
    CONCLUDED_CONTROL: "concluded_control",
    DISCARDED: "discarded",
    RERELEASED: "rereleased",
};
class RollbackReplacementChangedError extends AirborneServiceException_1.AirborneServiceException {
    name = "RollbackReplacementChangedError";
    $fault = "client";
    code;
    operation_id;
    replacement_release_id;
    constructor(opts) {
        super({
            name: "RollbackReplacementChangedError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, RollbackReplacementChangedError.prototype);
        this.code = opts.code;
        this.operation_id = opts.operation_id;
        this.replacement_release_id = opts.replacement_release_id;
    }
}
exports.RollbackReplacementChangedError = RollbackReplacementChangedError;
const UploadFileRequestFilterSensitiveLog = (obj) => ({
    ...obj,
});
exports.UploadFileRequestFilterSensitiveLog = UploadFileRequestFilterSensitiveLog;
