import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { Application, CreateApplicationRequest } from "../models/models_0";
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
 * The input for {@link CreateApplicationCommand}.
 */
export interface CreateApplicationCommandInput extends CreateApplicationRequest {
}
/**
 * @public
 *
 * The output of {@link CreateApplicationCommand}.
 */
export interface CreateApplicationCommandOutput extends Application, __MetadataBearer {
}
declare const CreateApplicationCommand_base: {
    new (input: CreateApplicationCommandInput): import("@smithy/smithy-client").CommandImpl<CreateApplicationCommandInput, CreateApplicationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateApplicationCommandInput): import("@smithy/smithy-client").CommandImpl<CreateApplicationCommandInput, CreateApplicationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create application request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateApplicationCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateApplicationCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateApplicationRequest
 *   application: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 * };
 * const command = new CreateApplicationCommand(input);
 * const response = await client.send(command);
 * // { // Application
 * //   application: "STRING_VALUE", // required
 * //   organisation: "STRING_VALUE", // required
 * //   access: [ // StringList // required
 * //     "STRING_VALUE",
 * //   ],
 * // };
 *
 * ```
 *
 * @param CreateApplicationCommandInput - {@link CreateApplicationCommandInput}
 * @returns {@link CreateApplicationCommandOutput}
 * @see {@link CreateApplicationCommandInput} for command's `input` shape.
 * @see {@link CreateApplicationCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class CreateApplicationCommand extends CreateApplicationCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateApplicationRequest;
            output: Application;
        };
        sdk: {
            input: CreateApplicationCommandInput;
            output: CreateApplicationCommandOutput;
        };
    };
}
