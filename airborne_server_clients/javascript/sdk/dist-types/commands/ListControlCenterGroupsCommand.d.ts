import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ListControlCenterGroupsInput, ListControlCenterGroupsResponse } from "../models/models_0";
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
 * The input for {@link ListControlCenterGroupsCommand}.
 */
export interface ListControlCenterGroupsCommandInput extends ListControlCenterGroupsInput {
}
/**
 * @public
 *
 * The output of {@link ListControlCenterGroupsCommand}.
 */
export interface ListControlCenterGroupsCommandOutput extends ListControlCenterGroupsResponse, __MetadataBearer {
}
declare const ListControlCenterGroupsCommand_base: {
    new (input: ListControlCenterGroupsCommandInput): import("@smithy/smithy-client").CommandImpl<ListControlCenterGroupsCommandInput, ListControlCenterGroupsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ListControlCenterGroupsCommandInput): import("@smithy/smithy-client").CommandImpl<ListControlCenterGroupsCommandInput, ListControlCenterGroupsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * List groups for the organisation in x-organisation. Member applications are filtered to those the caller can read. Requires Bearer authentication.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListControlCenterGroupsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListControlCenterGroupsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListControlCenterGroupsInput
 *   organisation: "STRING_VALUE", // required
 * };
 * const command = new ListControlCenterGroupsCommand(input);
 * const response = await client.send(command);
 * // { // ListControlCenterGroupsResponse
 * //   groups: [ // ControlCenterGroupList // required
 * //     { // ControlCenterGroup
 * //       id: "STRING_VALUE", // required
 * //       name: "STRING_VALUE", // required
 * //       members: [ // ControlCenterGroupMemberList // required
 * //         { // ControlCenterGroupMember
 * //           application: "STRING_VALUE", // required
 * //           platform: "android" || "ios" || "web" || "other", // required
 * //         },
 * //       ],
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListControlCenterGroupsCommandInput - {@link ListControlCenterGroupsCommandInput}
 * @returns {@link ListControlCenterGroupsCommandOutput}
 * @see {@link ListControlCenterGroupsCommandInput} for command's `input` shape.
 * @see {@link ListControlCenterGroupsCommandOutput} for command's `response` shape.
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
export declare class ListControlCenterGroupsCommand extends ListControlCenterGroupsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListControlCenterGroupsInput;
            output: ListControlCenterGroupsResponse;
        };
        sdk: {
            input: ListControlCenterGroupsCommandInput;
            output: ListControlCenterGroupsCommandOutput;
        };
    };
}
