import { AirborneServiceException as __BaseException } from "./AirborneServiceException";
export class BadRequestError extends __BaseException {
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
export class ForbiddenError extends __BaseException {
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
export class InternalServerError extends __BaseException {
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
export class NotFoundError extends __BaseException {
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
export class Unauthorized extends __BaseException {
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
export const ControlCenterPlatform = {
    ANDROID: "android",
    IOS: "ios",
    OTHER: "other",
    WEB: "web",
};
export const DimensionType = {
    COHORT: "cohort",
    STANDARD: "standard",
};
export class ConflictError extends __BaseException {
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
export class UnresolvedOperationError extends __BaseException {
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
export const ControlCenterReleaseEventAction = {
    CONCLUDED: "concluded",
    CREATED: "created",
    DISCARDED: "discarded",
    OPERATION_RESOLVED: "operation_resolved",
    RAMPED: "ramped",
    ROLLED_BACK: "rolled_back",
};
export const ControlCenterReleaseOutcome = {
    ACTIVE: "active",
    CONCLUDED_ON_CONTROL: "concluded_on_control",
    DISCARDED: "discarded",
    LIVE: "live",
    SUPERSEDED: "superseded",
};
export const OperationRecoveryFinding = {
    APPLIED: "applied",
    DID_NOT_APPLY: "did_not_apply",
};
export const ResolvedOperationState = {
    CONFIRMED: "confirmed",
    REJECTED: "rejected",
};
export class ReleaseSupersededError extends __BaseException {
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
export const RollbackFailureStage = {
    CONCLUDE: "conclude",
    CREATE: "create",
    RAMP: "ramp",
};
export class RollbackPartialFailureError extends __BaseException {
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
export const RollbackReleaseAction = {
    CONCLUDED_CONTROL: "concluded_control",
    DISCARDED: "discarded",
    RERELEASED: "rereleased",
};
export class RollbackReplacementChangedError extends __BaseException {
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
export class RollbackUnprocessableError extends __BaseException {
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
export const UploadFileRequestFilterSensitiveLog = (obj) => ({
    ...obj,
});
