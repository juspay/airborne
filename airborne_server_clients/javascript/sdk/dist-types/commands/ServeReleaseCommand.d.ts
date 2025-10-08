import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { GetServeReleaseInput, ReleaseConfig } from "../models/models_0";
import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link ServeReleaseCommand}.
 */
export interface ServeReleaseCommandInput extends GetServeReleaseInput {
}
/**
 * @public
 *
 * The output of {@link ServeReleaseCommand}.
 */
export interface ServeReleaseCommandOutput extends ReleaseConfig, __MetadataBearer {
}
declare const ServeReleaseCommand_base: {
    new (input: ServeReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<ServeReleaseCommandInput, ServeReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ServeReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<ServeReleaseCommandInput, ServeReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Get release request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ServeReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ServeReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetServeReleaseInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ServeReleaseCommand(input);
 * const response = await client.send(command);
 * // { // ReleaseConfig
 * //   config: { // GetReleaseConfig
 * //     version: "STRING_VALUE", // required
 * //     release_config_timeout: Number("int"), // required
 * //     boot_timeout: Number("int"), // required
 * //     properties: { // ConfigProperties
 * //       tenant_info: "DOCUMENT_VALUE", // required
 * //     },
 * //   },
 * //   package: { // Package
 * //     tag: "STRING_VALUE",
 * //     version: Number("int"), // required
 * //     index: "STRING_VALUE", // required
 * //     files: [ // StringList // required
 * //       "STRING_VALUE",
 * //     ],
 * //   },
 * //   resources: "DOCUMENT_VALUE", // required
 * // };
 *
 * ```
 *
 * @param ServeReleaseCommandInput - {@link ServeReleaseCommandInput}
 * @returns {@link ServeReleaseCommandOutput}
 * @see {@link ServeReleaseCommandInput} for command's `input` shape.
 * @see {@link ServeReleaseCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class ServeReleaseCommand extends ServeReleaseCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetServeReleaseInput;
            output: ReleaseConfig;
        };
        sdk: {
            input: ServeReleaseCommandInput;
            output: ServeReleaseCommandOutput;
        };
    };
}
