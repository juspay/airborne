"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFileRequestFilterSensitiveLog = exports.DimensionType = exports.Unauthorized = exports.NotFoundError = exports.InternalServerError = exports.ForbiddenError = exports.BadRequestError = void 0;
const AirborneServiceException_1 = require("./AirborneServiceException");
class BadRequestError extends AirborneServiceException_1.AirborneServiceException {
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
exports.BadRequestError = BadRequestError;
class ForbiddenError extends AirborneServiceException_1.AirborneServiceException {
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
exports.ForbiddenError = ForbiddenError;
class InternalServerError extends AirborneServiceException_1.AirborneServiceException {
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
exports.InternalServerError = InternalServerError;
class NotFoundError extends AirborneServiceException_1.AirborneServiceException {
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
exports.NotFoundError = NotFoundError;
class Unauthorized extends AirborneServiceException_1.AirborneServiceException {
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
exports.Unauthorized = Unauthorized;
exports.DimensionType = {
    COHORT: "cohort",
    STANDARD: "standard",
};
const UploadFileRequestFilterSensitiveLog = (obj) => ({
    ...obj,
});
exports.UploadFileRequestFilterSensitiveLog = UploadFileRequestFilterSensitiveLog;
