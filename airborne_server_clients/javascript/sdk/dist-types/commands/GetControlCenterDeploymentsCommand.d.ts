import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { GetControlCenterDeploymentsInput, GetControlCenterDeploymentsResponse } from "../models/models_0";
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
 * The input for {@link GetControlCenterDeploymentsCommand}.
 */
export interface GetControlCenterDeploymentsCommandInput extends GetControlCenterDeploymentsInput {
}
/**
 * @public
 *
 * The output of {@link GetControlCenterDeploymentsCommand}.
 */
export interface GetControlCenterDeploymentsCommandOutput extends GetControlCenterDeploymentsResponse, __MetadataBearer {
}
declare const GetControlCenterDeploymentsCommand_base: {
    new (input: GetControlCenterDeploymentsCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterDeploymentsCommandInput, GetControlCenterDeploymentsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [GetControlCenterDeploymentsCommandInput]): import("@smithy/smithy-client").CommandImpl<GetControlCenterDeploymentsCommandInput, GetControlCenterDeploymentsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetControlCenterDeploymentsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetControlCenterDeploymentsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetControlCenterDeploymentsInput
 *   org: "STRING_VALUE",
 *   group: "STRING_VALUE",
 *   app: "STRING_VALUE",
 *   action: [ // DeploymentActionList
 *     "created" || "ramped" || "concluded" || "rolled_back" || "discarded" || "emergency_rollback" || "requested" || "approved" || "rejected" || "expired" || "cache_failed" || "cache_retried" || "policy_changed" || "executed" || "failed" || "stale" || "cancelled" || "rollback_abandoned" || "emergency_acknowledged",
 *   ],
 *   platform: "STRING_VALUE",
 *   actor: "STRING_VALUE",
 *   since: "STRING_VALUE",
 *   cursor: "STRING_VALUE",
 *   limit: Number("int"),
 * };
 * const command = new GetControlCenterDeploymentsCommand(input);
 * const response = await client.send(command);
 * // { // GetControlCenterDeploymentsResponse
 * //   items: [ // DeploymentEventList // required
 * //     { // DeploymentEvent
 * //       event_id: "STRING_VALUE", // required
 * //       at: "STRING_VALUE", // required
 * //       org: "STRING_VALUE", // required
 * //       group: "DOCUMENT_VALUE", // required
 * //       app: "STRING_VALUE", // required
 * //       platform: "DOCUMENT_VALUE", // required
 * //       release_id: "DOCUMENT_VALUE", // required
 * //       package_version: "DOCUMENT_VALUE", // required
 * //       request_id: "DOCUMENT_VALUE", // required
 * //       action: "created" || "ramped" || "concluded" || "rolled_back" || "discarded" || "emergency_rollback" || "requested" || "approved" || "rejected" || "expired" || "cache_failed" || "cache_retried" || "policy_changed" || "executed" || "failed" || "stale" || "cancelled" || "rollback_abandoned" || "emergency_acknowledged", // required
 * //       recovered: true || false, // required
 * //       actor: "DOCUMENT_VALUE", // required
 * //       from_target: "DOCUMENT_VALUE", // required
 * //       to_target: "DOCUMENT_VALUE", // required
 * //       summary: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   next_cursor: "DOCUMENT_VALUE", // required
 * //   partial: true || false, // required
 * //   errors: [ // DeploymentReadErrorList // required
 * //     { // DeploymentReadError
 * //       org: "STRING_VALUE", // required
 * //       app: "DOCUMENT_VALUE", // required
 * //       reason: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   audit_completeness: { // DeploymentAuditCompleteness
 * //     complete: true || false, // required
 * //     transactional_actions: [ // StringList // required
 * //       "STRING_VALUE",
 * //     ],
 * //     best_effort_actions: [ // required
 * //       "STRING_VALUE",
 * //     ],
 * //     notes: [ // required
 * //       "STRING_VALUE",
 * //     ],
 * //   },
 * // };
 *
 * ```
 *
 * @param GetControlCenterDeploymentsCommandInput - {@link GetControlCenterDeploymentsCommandInput}
 * @returns {@link GetControlCenterDeploymentsCommandOutput}
 * @see {@link GetControlCenterDeploymentsCommandInput} for command's `input` shape.
 * @see {@link GetControlCenterDeploymentsCommandOutput} for command's `response` shape.
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
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 */
export declare class GetControlCenterDeploymentsCommand extends GetControlCenterDeploymentsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetControlCenterDeploymentsInput;
            output: GetControlCenterDeploymentsResponse;
        };
        sdk: {
            input: GetControlCenterDeploymentsCommandInput;
            output: GetControlCenterDeploymentsCommandOutput;
        };
    };
}
