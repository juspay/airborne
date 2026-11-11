import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ControlCenterGroup, CreateControlCenterGroupInput } from "../models/models_0";
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
 * The input for {@link CreateControlCenterGroupCommand}.
 */
export interface CreateControlCenterGroupCommandInput extends CreateControlCenterGroupInput {
}
/**
 * @public
 *
 * The output of {@link CreateControlCenterGroupCommand}.
 */
export interface CreateControlCenterGroupCommandOutput extends ControlCenterGroup, __MetadataBearer {
}
declare const CreateControlCenterGroupCommand_base: {
    new (input: CreateControlCenterGroupCommandInput): import("@smithy/smithy-client").CommandImpl<CreateControlCenterGroupCommandInput, CreateControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateControlCenterGroupCommandInput): import("@smithy/smithy-client").CommandImpl<CreateControlCenterGroupCommandInput, CreateControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create a group with a name and full member list. Requires Bearer authentication and an x-organisation header. Only organisation admins/owners can create groups.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateControlCenterGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateControlCenterGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateControlCenterGroupInput
 *   organisation: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   members: [ // ControlCenterGroupMemberList // required
 *     { // ControlCenterGroupMember
 *       application: "STRING_VALUE", // required
 *       platform: "android" || "ios" || "web" || "other", // required
 *     },
 *   ],
 * };
 * const command = new CreateControlCenterGroupCommand(input);
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
 * @param CreateControlCenterGroupCommandInput - {@link CreateControlCenterGroupCommandInput}
 * @returns {@link CreateControlCenterGroupCommandOutput}
 * @see {@link CreateControlCenterGroupCommandInput} for command's `input` shape.
 * @see {@link CreateControlCenterGroupCommandOutput} for command's `response` shape.
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
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class CreateControlCenterGroupCommand extends CreateControlCenterGroupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateControlCenterGroupInput;
            output: ControlCenterGroup;
        };
        sdk: {
            input: CreateControlCenterGroupCommandInput;
            output: CreateControlCenterGroupCommandOutput;
        };
    };
}
