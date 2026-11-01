import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ControlCenterGroupPath, DeleteControlCenterGroupResponse } from "../models/models_0";
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
 * The input for {@link DeleteControlCenterGroupCommand}.
 */
export interface DeleteControlCenterGroupCommandInput extends ControlCenterGroupPath {
}
/**
 * @public
 *
 * The output of {@link DeleteControlCenterGroupCommand}.
 */
export interface DeleteControlCenterGroupCommandOutput extends DeleteControlCenterGroupResponse, __MetadataBearer {
}
declare const DeleteControlCenterGroupCommand_base: {
    new (input: DeleteControlCenterGroupCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteControlCenterGroupCommandInput, DeleteControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: DeleteControlCenterGroupCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteControlCenterGroupCommandInput, DeleteControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Delete a group by UUID. Requires Bearer authentication and x-organisation. Only organisation admins/owners can delete groups.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, DeleteControlCenterGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, DeleteControlCenterGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ControlCenterGroupPath
 *   id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 * };
 * const command = new DeleteControlCenterGroupCommand(input);
 * const response = await client.send(command);
 * // { // DeleteControlCenterGroupResponse
 * //   success: true || false, // required
 * // };
 *
 * ```
 *
 * @param DeleteControlCenterGroupCommandInput - {@link DeleteControlCenterGroupCommandInput}
 * @returns {@link DeleteControlCenterGroupCommandOutput}
 * @see {@link DeleteControlCenterGroupCommandInput} for command's `input` shape.
 * @see {@link DeleteControlCenterGroupCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
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
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class DeleteControlCenterGroupCommand extends DeleteControlCenterGroupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ControlCenterGroupPath;
            output: DeleteControlCenterGroupResponse;
        };
        sdk: {
            input: DeleteControlCenterGroupCommandInput;
            output: DeleteControlCenterGroupCommandOutput;
        };
    };
}
