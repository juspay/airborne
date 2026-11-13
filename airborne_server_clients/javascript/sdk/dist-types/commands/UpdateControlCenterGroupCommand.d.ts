import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ControlCenterGroup, UpdateControlCenterGroupInput } from "../models/models_0";
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
 * The input for {@link UpdateControlCenterGroupCommand}.
 */
export interface UpdateControlCenterGroupCommandInput extends UpdateControlCenterGroupInput {
}
/**
 * @public
 *
 * The output of {@link UpdateControlCenterGroupCommand}.
 */
export interface UpdateControlCenterGroupCommandOutput extends ControlCenterGroup, __MetadataBearer {
}
declare const UpdateControlCenterGroupCommand_base: {
    new (input: UpdateControlCenterGroupCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateControlCenterGroupCommandInput, UpdateControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: UpdateControlCenterGroupCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateControlCenterGroupCommandInput, UpdateControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Replace a group's name and complete member list. Requires Bearer authentication and x-organisation. Only organisation admins/owners can update groups.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdateControlCenterGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdateControlCenterGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdateControlCenterGroupInput
 *   id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   members: [ // ControlCenterGroupMemberList // required
 *     { // ControlCenterGroupMember
 *       application: "STRING_VALUE", // required
 *       platform: "android" || "ios" || "web" || "other", // required
 *     },
 *   ],
 * };
 * const command = new UpdateControlCenterGroupCommand(input);
 * const response = await client.send(command);
 * // { // ControlCenterGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   members: [ // ControlCenterGroupMemberList // required
 * //     { // ControlCenterGroupMember
 * //       application: "STRING_VALUE", // required
 * //       platform: "android" || "ios" || "web" || "other", // required
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param UpdateControlCenterGroupCommandInput - {@link UpdateControlCenterGroupCommandInput}
 * @returns {@link UpdateControlCenterGroupCommandOutput}
 * @see {@link UpdateControlCenterGroupCommandInput} for command's `input` shape.
 * @see {@link UpdateControlCenterGroupCommandOutput} for command's `response` shape.
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
export declare class UpdateControlCenterGroupCommand extends UpdateControlCenterGroupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateControlCenterGroupInput;
            output: ControlCenterGroup;
        };
        sdk: {
            input: UpdateControlCenterGroupCommandInput;
            output: UpdateControlCenterGroupCommandOutput;
        };
    };
}
