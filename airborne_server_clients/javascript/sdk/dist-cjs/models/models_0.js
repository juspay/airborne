"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFileRequestFilterSensitiveLog = exports.RollbackUnprocessableError = exports.RollbackReplacementChangedError = exports.RollbackReleaseAction = exports.RollbackPartialFailureError = exports.RollbackFailureStage = exports.ReleaseSupersededError = exports.ResolvedOperationState = exports.OperationRecoveryFinding = exports.ControlCenterReleaseOutcome = exports.ControlCenterReleaseEventAction = exports.UnresolvedOperationError = exports.ConflictError = exports.DimensionType = exports.ControlCenterPlatform = exports.Unauthorized = exports.NotFoundError = exports.InternalServerError = exports.ForbiddenError = exports.BadRequestError = void 0;
const AirborneServiceException_1 = require("./AirborneServiceException");
class BadRequestError extends AirborneServiceException_1.AirborneServiceException {
    name = "BadRequestError";
    $fault = "client";
    code;
    constructor(opts) {
        super({
            name: "BadRequestError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, BadRequestError.prototype);
        this.code = opts.code;
    }
}
exports.BadRequestError = BadRequestError;
class ForbiddenError extends AirborneServiceException_1.AirborneServiceException {
    name = "ForbiddenError";
    $fault = "client";
    code;
    constructor(opts) {
        super({
            name: "ForbiddenError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ForbiddenError.prototype);
        this.code = opts.code;
    }
}
exports.ForbiddenError = ForbiddenError;
class InternalServerError extends AirborneServiceException_1.AirborneServiceException {
    name = "InternalServerError";
    $fault = "server";
    code;
    constructor(opts) {
        super({
            name: "InternalServerError",
            $fault: "server",
            ...opts
        });
        Object.setPrototypeOf(this, InternalServerError.prototype);
        this.code = opts.code;
    }
}
exports.InternalServerError = InternalServerError;
class NotFoundError extends AirborneServiceException_1.AirborneServiceException {
    name = "NotFoundError";
    $fault = "client";
    code;
    constructor(opts) {
        super({
            name: "NotFoundError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, NotFoundError.prototype);
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
class ConflictError extends AirborneServiceException_1.AirborneServiceException {
    name = "ConflictError";
    $fault = "client";
    code;
    constructor(opts) {
        super({
            name: "ConflictError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ConflictError.prototype);
        this.code = opts.code;
    }
}
exports.ConflictError = ConflictError;
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
exports.ControlCenterReleaseEventAction = {
    CONCLUDED: "concluded",
    CREATED: "created",
    DISCARDED: "discarded",
    OPERATION_RESOLVED: "operation_resolved",
    RAMPED: "ramped",
    ROLLED_BACK: "rolled_back",
};
exports.ControlCenterReleaseOutcome = {
    ACTIVE: "active",
    CONCLUDED_ON_CONTROL: "concluded_on_control",
    DISCARDED: "discarded",
    LIVE: "live",
    SUPERSEDED: "superseded",
};
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
exports.RollbackFailureStage = {
    CONCLUDE: "conclude",
    CREATE: "create",
    RAMP: "ramp",
};
class RollbackPartialFailureError extends AirborneServiceException_1.AirborneServiceException {
    name = "RollbackPartialFailureError";
    $fault = "server";
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
        this.code = opts.code;
        this.replacement_release_id = opts.replacement_release_id;
        this.rollback_operation_id = opts.rollback_operation_id;
        this.stage = opts.stage;
    }
}
exports.RollbackPartialFailureError = RollbackPartialFailureError;
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
class RollbackUnprocessableError extends AirborneServiceException_1.AirborneServiceException {
    name = "RollbackUnprocessableError";
    $fault = "client";
    code;
    current_live_release_id;
    constructor(opts) {
        super({
            name: "RollbackUnprocessableError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, RollbackUnprocessableError.prototype);
        this.code = opts.code;
        this.current_live_release_id = opts.current_live_release_id;
    }
}
exports.RollbackUnprocessableError = RollbackUnprocessableError;
const UploadFileRequestFilterSensitiveLog = (obj) => ({
    ...obj,
});
exports.UploadFileRequestFilterSensitiveLog = UploadFileRequestFilterSensitiveLog;
