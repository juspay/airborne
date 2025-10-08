import { doesIdentityRequireRefresh, isIdentityExpired, memoizeIdentityProvider, } from "@smithy/core";
import { getSmithyContext } from "@smithy/util-middleware";
export const defaultAirborneHttpAuthSchemeParametersProvider = async (config, context, input) => {
    return {
        operation: getSmithyContext(context).operation,
    };
};
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
export const defaultAirborneHttpAuthSchemeProvider = (authParameters) => {
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
export const resolveHttpAuthSchemeConfig = (config) => {
    const token = memoizeIdentityProvider(config.token, isIdentityExpired, doesIdentityRequireRefresh);
    return Object.assign(config, {
        token,
    });
};
