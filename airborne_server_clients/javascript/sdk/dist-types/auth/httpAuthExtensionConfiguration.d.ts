import { AirborneHttpAuthSchemeProvider } from "./httpAuthSchemeProvider";
import { HttpAuthScheme, TokenIdentity, TokenIdentityProvider } from "@smithy/types";
/**
 * @internal
 */
export interface HttpAuthExtensionConfiguration {
    setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void;
    httpAuthSchemes(): HttpAuthScheme[];
    setHttpAuthSchemeProvider(httpAuthSchemeProvider: AirborneHttpAuthSchemeProvider): void;
    httpAuthSchemeProvider(): AirborneHttpAuthSchemeProvider;
    setToken(token: TokenIdentity | TokenIdentityProvider): void;
    token(): TokenIdentity | TokenIdentityProvider | undefined;
}
/**
 * @internal
 */
export type HttpAuthRuntimeConfig = Partial<{
    httpAuthSchemes: HttpAuthScheme[];
    httpAuthSchemeProvider: AirborneHttpAuthSchemeProvider;
    token: TokenIdentity | TokenIdentityProvider;
}>;
/**
 * @internal
 */
export declare const getHttpAuthExtensionConfiguration: (runtimeConfig: HttpAuthRuntimeConfig) => HttpAuthExtensionConfiguration;
/**
 * @internal
 */
export declare const resolveHttpAuthRuntimeConfig: (config: HttpAuthExtensionConfiguration) => HttpAuthRuntimeConfig;
