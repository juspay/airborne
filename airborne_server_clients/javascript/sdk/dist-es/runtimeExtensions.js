import { getHttpAuthExtensionConfiguration, resolveHttpAuthRuntimeConfig, } from "./auth/httpAuthExtensionConfiguration";
import { getHttpHandlerExtensionConfiguration, resolveHttpHandlerRuntimeConfig, } from "@smithy/protocol-http";
import { getDefaultExtensionConfiguration, resolveDefaultRuntimeConfig, } from "@smithy/smithy-client";
export const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
    const extensionConfiguration = Object.assign(getDefaultExtensionConfiguration(runtimeConfig), getHttpHandlerExtensionConfiguration(runtimeConfig), getHttpAuthExtensionConfiguration(runtimeConfig));
    extensions.forEach(extension => extension.configure(extensionConfiguration));
    return Object.assign(runtimeConfig, resolveDefaultRuntimeConfig(extensionConfiguration), resolveHttpHandlerRuntimeConfig(extensionConfiguration), resolveHttpAuthRuntimeConfig(extensionConfiguration));
};
