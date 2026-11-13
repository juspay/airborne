import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ControlCenterReleaseEventsInput, GetControlCenterReleaseEventsResponse } from "../models/models_0";
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
 * The input for {@link GetControlCenterReleaseEventsCommand}.
 */
export interface GetControlCenterReleaseEventsCommandInput extends ControlCenterReleaseEventsInput {
}
/**
 * @public
 *
 * The output of {@link GetControlCenterReleaseEventsCommand}.
 */
export interface GetControlCenterReleaseEventsCommandOutput extends GetControlCenterReleaseEventsResponse, __MetadataBearer {
}
declare const GetControlCenterReleaseEventsCommand_base: {
    new (input: GetControlCenterReleaseEventsCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterReleaseEventsCommandInput, GetControlCenterReleaseEventsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetControlCenterReleaseEventsCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterReleaseEventsCommandInput, GetControlCenterReleaseEventsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Return the ordered audit timeline for a release. Requires Bearer authentication plus x-organisation and x-application headers.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetControlCenterReleaseEventsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetControlCenterReleaseEventsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ControlCenterReleaseEventsInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetControlCenterReleaseEventsCommand(input);
 * const response = await client.send(command);
 * // { // GetControlCenterReleaseEventsResponse
 * //   events: [ // ControlCenterReleaseEventList // required
 * //     { // ControlCenterReleaseEvent
 * //       action: "created" || "ramped" || "concluded" || "discarded" || "rolled_back" || "operation_resolved", // required
 * //       actor: "STRING_VALUE", // required
 * //       created_at: new Date("TIMESTAMP"), // required
 * //       payload: "DOCUMENT_VALUE", // required
 * //       synthetic: true || false, // required
 * //     },
 * //   ],
 * //   outcome: "active" || "live" || "superseded" || "concluded_on_control" || "discarded", // required
 * // };
 *
 * ```
 *
 * @param GetControlCenterReleaseEventsCommandInput - {@link GetControlCenterReleaseEventsCommandInput}
 * @returns {@link GetControlCenterReleaseEventsCommandOutput}
 * @see {@link GetControlCenterReleaseEventsCommandInput} for command's `input` shape.
 * @see {@link GetControlCenterReleaseEventsCommandOutput} for command's `response` shape.
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
export declare class GetControlCenterReleaseEventsCommand extends GetControlCenterReleaseEventsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ControlCenterReleaseEventsInput;
            output: GetControlCenterReleaseEventsResponse;
        };
        sdk: {
            input: GetControlCenterReleaseEventsCommandInput;
            output: GetControlCenterReleaseEventsCommandOutput;
        };
    };
}
