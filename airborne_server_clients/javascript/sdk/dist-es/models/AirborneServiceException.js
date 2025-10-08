import { ServiceException as __ServiceException, } from "@smithy/smithy-client";
export { __ServiceException };
export class AirborneServiceException extends __ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, AirborneServiceException.prototype);
    }
}
