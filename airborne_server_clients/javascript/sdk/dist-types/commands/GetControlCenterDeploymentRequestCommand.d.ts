import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ControlCenterDeploymentRequest, GetControlCenterDeploymentRequestInput } from "../models/models_0";
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
 * The input for {@link GetControlCenterDeploymentRequestCommand}.
 */
export interface GetControlCenterDeploymentRequestCommandInput extends GetControlCenterDeploymentRequestInput {
}
/**
 * @public
 *
 * The output of {@link GetControlCenterDeploymentRequestCommand}.
 */
export interface GetControlCenterDeploymentRequestCommandOutput extends ControlCenterDeploymentRequest, __MetadataBearer {
}
declare const GetControlCenterDeploymentRequestCommand_base: {
    new (input: GetControlCenterDeploymentRequestCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterDeploymentRequestCommandInput, GetControlCenterDeploymentRequestCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetControlCenterDeploymentRequestCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterDeploymentRequestCommandInput, GetControlCenterDeploymentRequestCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Fetch one request by UUID independently of queue pagination. Both scope headers are required.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetControlCenterDeploymentRequestCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetControlCenterDeploymentRequestCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetControlCenterDeploymentRequestInput
 *   id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetControlCenterDeploymentRequestCommand(input);
 * const response = await client.send(command);
 * // { // ControlCenterDeploymentRequest
 * //   id: "STRING_VALUE", // required
 * //   org: "STRING_VALUE", // required
 * //   application: "STRING_VALUE", // required
 * //   action: "create" || "update" || "ramp" || "conclude" || "discard" || "rollback" || "set_strict_serving" || "set_rollback_sensitive", // required
 * //   payload: { // DeploymentRequestPayload
 * //     body: "DOCUMENT_VALUE",
 * //     release_id: "STRING_VALUE",
 * //     snapshot: "DOCUMENT_VALUE",
 * //   },
 * //   payload_hash: "STRING_VALUE", // required
 * //   base_state: "DOCUMENT_VALUE", // required
 * //   requester: "STRING_VALUE", // required
 * //   reason: "STRING_VALUE", // required
 * //   status: "pending" || "executing" || "executed" || "failed" || "rejected" || "cancelled" || "expired" || "stale", // required
 * //   expires_at: new Date("TIMESTAMP"), // required
 * //   decided_by: "DOCUMENT_VALUE", // required
 * //   decision_reason: "DOCUMENT_VALUE", // required
 * //   created_at: new Date("TIMESTAMP"), // required
 * //   updated_at: new Date("TIMESTAMP"), // required
 * //   result: "DOCUMENT_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetControlCenterDeploymentRequestCommandInput - {@link GetControlCenterDeploymentRequestCommandInput}
 * @returns {@link GetControlCenterDeploymentRequestCommandOutput}
 * @see {@link GetControlCenterDeploymentRequestCommandInput} for command's `input` shape.
 * @see {@link GetControlCenterDeploymentRequestCommandOutput} for command's `response` shape.
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
export declare class GetControlCenterDeploymentRequestCommand extends GetControlCenterDeploymentRequestCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetControlCenterDeploymentRequestInput;
            output: ControlCenterDeploymentRequest;
        };
        sdk: {
            input: GetControlCenterDeploymentRequestCommandInput;
            output: GetControlCenterDeploymentRequestCommandOutput;
        };
    };
}
