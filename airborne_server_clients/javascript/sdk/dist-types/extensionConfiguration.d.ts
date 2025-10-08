import { HttpAuthExtensionConfiguration } from "./auth/httpAuthExtensionConfiguration";
import { HttpHandlerExtensionConfiguration } from "@smithy/protocol-http";
import { DefaultExtensionConfiguration } from "@smithy/types";
/**
 * @internal
 */
export interface AirborneExtensionConfiguration extends HttpHandlerExtensionConfiguration, DefaultExtensionConfiguration, HttpAuthExtensionConfiguration {
}
