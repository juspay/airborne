// smithy-typescript generated code
import { AirborneClientResolvedConfig } from "../AirborneClient";
import {
  doesIdentityRequireRefresh,
  isIdentityExpired,
  memoizeIdentityProvider,
} from "@smithy/core";
import {
  HandlerExecutionContext,
  HttpAuthOption,
  HttpAuthScheme,
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
  TokenIdentity,
  TokenIdentityProvider,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

/**
 * @internal
 */
export interface AirborneHttpAuthSchemeParameters extends HttpAuthSchemeParameters {
}

/**
 * @internal
 */
export interface AirborneHttpAuthSchemeParametersProvider extends HttpAuthSchemeParametersProvider<AirborneClientResolvedConfig, HandlerExecutionContext, AirborneHttpAuthSchemeParameters, object> {}

/**
 * @internal
 */
export const defaultAirborneHttpAuthSchemeParametersProvider = async (config: AirborneClientResolvedConfig, context: HandlerExecutionContext, input: object): Promise<AirborneHttpAuthSchemeParameters> => {
  return {
    operation: getSmithyContext(context).operation as string,
  };
};

function createSmithyApiHttpBearerAuthHttpAuthOption(authParameters: AirborneHttpAuthSchemeParameters): HttpAuthOption {
  return {
    schemeId: "smithy.api#httpBearerAuth",
  };
};

function createSmithyApiNoAuthHttpAuthOption(authParameters: AirborneHttpAuthSchemeParameters): HttpAuthOption {
  return {
    schemeId: "smithy.api#noAuth",
  };
};

/**
 * @internal
 */
export interface AirborneHttpAuthSchemeProvider extends HttpAuthSchemeProvider<AirborneHttpAuthSchemeParameters> {}

/**
 * @internal
 */
export const defaultAirborneHttpAuthSchemeProvider: AirborneHttpAuthSchemeProvider = (authParameters) => {
  const options: HttpAuthOption[] = [];
  switch (authParameters.operation) {
    case "PostLogin": {
      options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
      break;
    };
    default: {
      options.push(createSmithyApiHttpBearerAuthHttpAuthOption(authParameters));
    };
  };
  return options;
};

/**
 * @internal
 */
export interface HttpAuthSchemeInputConfig {
  /**
   * Configuration of HttpAuthSchemes for a client which provides default identity providers and signers per auth scheme.
   * @internal
   */
  httpAuthSchemes?: HttpAuthScheme[];

  /**
   * Configuration of an HttpAuthSchemeProvider for a client which resolves which HttpAuthScheme to use.
   * @internal
   */
  httpAuthSchemeProvider?: AirborneHttpAuthSchemeProvider;

  /**
   * The token used to authenticate requests.
   */
  token?: TokenIdentity | TokenIdentityProvider;
}

/**
 * @internal
 */
export interface HttpAuthSchemeResolvedConfig {
  /**
   * Configuration of HttpAuthSchemes for a client which provides default identity providers and signers per auth scheme.
   * @internal
   */
  readonly httpAuthSchemes: HttpAuthScheme[];

  /**
   * Configuration of an HttpAuthSchemeProvider for a client which resolves which HttpAuthScheme to use.
   * @internal
   */
  readonly httpAuthSchemeProvider: AirborneHttpAuthSchemeProvider;

  /**
   * The token used to authenticate requests.
   */
  readonly token?: TokenIdentityProvider;
}

/**
 * @internal
 */
export const resolveHttpAuthSchemeConfig = <T>(config: T & HttpAuthSchemeInputConfig): T & HttpAuthSchemeResolvedConfig => {
  const token = memoizeIdentityProvider(config.token, isIdentityExpired, doesIdentityRequireRefresh);
  return Object.assign(
    config, {
    token,
  }) as T & HttpAuthSchemeResolvedConfig;
};
