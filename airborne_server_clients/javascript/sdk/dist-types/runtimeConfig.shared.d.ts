import { HttpBearerAuthSigner, NoAuthSigner } from "@smithy/core";
import { IdentityProviderConfig } from "@smithy/types";
import { AirborneClientConfig } from "./AirborneClient";
/**
 * @internal
 */
export declare const getRuntimeConfig: (config: AirborneClientConfig) => {
    apiVersion: string;
    base64Decoder: import("@smithy/types").Decoder;
    base64Encoder: (_input: string | Uint8Array) => string;
    disableHostPrefix: boolean;
    extensions: import("./runtimeExtensions").RuntimeExtension[];
    httpAuthSchemeProvider: import("./auth/httpAuthSchemeProvider").AirborneHttpAuthSchemeProvider;
    httpAuthSchemes: ({
        schemeId: string;
        identityProvider: (ipc: IdentityProviderConfig) => import("@smithy/types").IdentityProvider<import("@smithy/types").Identity> | undefined;
        signer: HttpBearerAuthSigner;
    } | {
        schemeId: string;
        identityProvider: (ipc: IdentityProviderConfig) => import("@smithy/types").IdentityProvider<import("@smithy/types").Identity> | (() => Promise<{}>);
        signer: NoAuthSigner;
    })[];
    logger: import("@smithy/types").Logger;
    urlParser: import("@smithy/types").UrlParser;
    utf8Decoder: import("@smithy/types").Decoder;
    utf8Encoder: (input: string | Uint8Array) => string;
};
