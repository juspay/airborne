"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveHttpAuthSchemeConfig = exports.defaultAirborneHttpAuthSchemeProvider = exports.defaultAirborneHttpAuthSchemeParametersProvider = void 0;
const core_1 = require("@smithy/core");
const util_middleware_1 = require("@smithy/util-middleware");
const defaultAirborneHttpAuthSchemeParametersProvider = async (config, context, input) => {
    return {
        operation: (0, util_middleware_1.getSmithyContext)(context).operation,
    };
};
exports.defaultAirborneHttpAuthSchemeParametersProvider = defaultAirborneHttpAuthSchemeParametersProvider;
function createSmithyApiHttpBearerAuthHttpAuthOption(authParameters) {
    return {
        schemeId: "smithy.api#httpBearerAuth",
    };
}
;
function createSmithyApiNoAuthHttpAuthOption(authParameters) {
    return {
        schemeId: "smithy.api#noAuth",
    };
}
;
const defaultAirborneHttpAuthSchemeProvider = (authParameters) => {
    const options = [];
    switch (authParameters.operation) {
        case "PostLogin":
            {
                options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
                break;
            }
            ;
        default:
            {
                options.push(createSmithyApiHttpBearerAuthHttpAuthOption(authParameters));
            }
            ;
    }
    ;
    return options;
};
exports.defaultAirborneHttpAuthSchemeProvider = defaultAirborneHttpAuthSchemeProvider;
const resolveHttpAuthSchemeConfig = (config) => {
    const token = (0, core_1.memoizeIdentityProvider)(config.token, core_1.isIdentityExpired, core_1.doesIdentityRequireRefresh);
    return Object.assign(config, {
        token,
    });
};
exports.resolveHttpAuthSchemeConfig = resolveHttpAuthSchemeConfig;
