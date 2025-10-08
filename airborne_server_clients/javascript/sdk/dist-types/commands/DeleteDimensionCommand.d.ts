import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { DeleteDimensionRequest } from "../models/models_0";
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
 * The input for {@link DeleteDimensionCommand}.
 */
export interface DeleteDimensionCommandInput extends DeleteDimensionRequest {
}
/**
 * @public
 *
 * The output of {@link DeleteDimensionCommand}.
 */
export interface DeleteDimensionCommandOutput extends __MetadataBearer {
}
declare const DeleteDimensionCommand_base: {
    new (input: DeleteDimensionCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteDimensionCommandInput, DeleteDimensionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: DeleteDimensionCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteDimensionCommandInput, DeleteDimensionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Delete dimension request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, DeleteDimensionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, DeleteDimensionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // DeleteDimensionRequest
 *   dimension: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new DeleteDimensionCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param DeleteDimensionCommandInput - {@link DeleteDimensionCommandInput}
 * @returns {@link DeleteDimensionCommandOutput}
 * @see {@link DeleteDimensionCommandInput} for command's `input` shape.
 * @see {@link DeleteDimensionCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
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
export declare class DeleteDimensionCommand extends DeleteDimensionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DeleteDimensionRequest;
            output: {};
        };
        sdk: {
            input: DeleteDimensionCommandInput;
            output: DeleteDimensionCommandOutput;
        };
    };
}
