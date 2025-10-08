import { AirborneClientResolvedConfig } from "../AirborneClient";
import { HandlerExecutionContext, HttpAuthScheme, HttpAuthSchemeParameters, HttpAuthSchemeParametersProvider, HttpAuthSchemeProvider, TokenIdentity, TokenIdentityProvider } from "@smithy/types";
/**
 * @internal
 */
export interface AirborneHttpAuthSchemeParameters extends HttpAuthSchemeParameters {
}
/**
 * @internal
 */
export interface AirborneHttpAuthSchemeParametersProvider extends HttpAuthSchemeParametersProvider<AirborneClientResolvedConfig, HandlerExecutionContext, AirborneHttpAuthSchemeParameters, object> {
}
/**
 * @internal
 */
export declare const defaultAirborneHttpAuthSchemeParametersProvider: (config: AirborneClientResolvedConfig, context: HandlerExecutionContext, input: object) => Promise<AirborneHttpAuthSchemeParameters>;
/**
 * @internal
 */
export interface AirborneHttpAuthSchemeProvider extends HttpAuthSchemeProvider<AirborneHttpAuthSchemeParameters> {
}
/**
 * @internal
 */
export declare const defaultAirborneHttpAuthSchemeProvider: AirborneHttpAuthSchemeProvider;
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
export declare const resolveHttpAuthSchemeConfig: <T>(config: T & HttpAuthSchemeInputConfig) => T & HttpAuthSchemeResolvedConfig;
