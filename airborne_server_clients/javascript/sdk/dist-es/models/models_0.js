import { AirborneServiceException as __BaseException } from "./AirborneServiceException";
export class BadRequestError extends __BaseException {
    name = "BadRequestError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BadRequestError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}
export class ForbiddenError extends __BaseException {
    name = "ForbiddenError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ForbiddenError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}
export class InternalServerError extends __BaseException {
    name = "InternalServerError";
    $fault = "server";
    constructor(opts) {
        super({
            name: "InternalServerError",
            $fault: "server",
            ...opts
        });
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}
export class NotFoundError extends __BaseException {
    name = "NotFoundError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NotFoundError",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
export class Unauthorized extends __BaseException {
    name = "Unauthorized";
    $fault = "client";
    constructor(opts) {
        super({
            name: "Unauthorized",
            $fault: "client",
            ...opts
        });
        Object.setPrototypeOf(this, Unauthorized.prototype);
    }
}
export const DimensionType = {
    COHORT: "cohort",
    STANDARD: "standard",
};
export const UploadFileRequestFilterSensitiveLog = (obj) => ({
    ...obj,
});
