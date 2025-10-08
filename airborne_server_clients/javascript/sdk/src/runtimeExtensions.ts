// smithy-typescript generated code
import {
  getHttpAuthExtensionConfiguration,
  resolveHttpAuthRuntimeConfig,
} from "./auth/httpAuthExtensionConfiguration";
import {
  getHttpHandlerExtensionConfiguration,
  resolveHttpHandlerRuntimeConfig,
} from "@smithy/protocol-http";
import {
  getDefaultExtensionConfiguration,
  resolveDefaultRuntimeConfig,
} from "@smithy/smithy-client";
import { AirborneExtensionConfiguration } from "./extensionConfiguration";

/**
 * @public
 */
export interface RuntimeExtension {
    configure(extensionConfiguration: AirborneExtensionConfiguration): void;
}

/**
 * @public
 */
export interface RuntimeExtensionsConfig {
    extensions: RuntimeExtension[]
}

/**
 * @internal
 */
export const resolveRuntimeExtensions = (
    runtimeConfig: any,
    extensions: RuntimeExtension[]
) => {
  const extensionConfiguration: AirborneExtensionConfiguration = Object.assign(
    getDefaultExtensionConfiguration(runtimeConfig),
    getHttpHandlerExtensionConfiguration(runtimeConfig),
    getHttpAuthExtensionConfiguration(runtimeConfig),
  );

  extensions.forEach(extension => extension.configure(extensionConfiguration));

  return Object.assign(runtimeConfig,
    resolveDefaultRuntimeConfig(extensionConfiguration),
    resolveHttpHandlerRuntimeConfig(extensionConfiguration),
    resolveHttpAuthRuntimeConfig(extensionConfiguration),
  );
}
