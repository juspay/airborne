import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ControlCenterDeploymentRequest, CreateControlCenterDeploymentRequestInput } from "../models/models_0";
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
 * The input for {@link CreateControlCenterDeploymentRequestCommand}.
 */
export interface CreateControlCenterDeploymentRequestCommandInput extends CreateControlCenterDeploymentRequestInput {
}
/**
 * @public
 *
 * The output of {@link CreateControlCenterDeploymentRequestCommand}.
 */
export interface CreateControlCenterDeploymentRequestCommandOutput extends ControlCenterDeploymentRequest, __MetadataBearer {
}
declare const CreateControlCenterDeploymentRequestCommand_base: {
    new (input: CreateControlCenterDeploymentRequestCommandInput): import("@smithy/smithy-client").CommandImpl<CreateControlCenterDeploymentRequestCommandInput, CreateControlCenterDeploymentRequestCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateControlCenterDeploymentRequestCommandInput): import("@smithy/smithy-client").CommandImpl<CreateControlCenterDeploymentRequestCommandInput, CreateControlCenterDeploymentRequestCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Raise an immutable deployment request. The server resolves and freezes the snapshot, hashes it and records the authenticated subject as requester.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateControlCenterDeploymentRequestCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateControlCenterDeploymentRequestCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateControlCenterDeploymentRequestInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   action: "create" || "update" || "ramp" || "conclude" || "discard" || "rollback" || "set_strict_serving" || "set_rollback_sensitive", // required
 *   payload: { // DeploymentRequestInputPayload
 *     body: "DOCUMENT_VALUE",
 *     release_id: "STRING_VALUE",
 *   },
 *   reason: "STRING_VALUE", // required
 * };
 * const command = new CreateControlCenterDeploymentRequestCommand(input);
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
 * @param CreateControlCenterDeploymentRequestCommandInput - {@link CreateControlCenterDeploymentRequestCommandInput}
 * @returns {@link CreateControlCenterDeploymentRequestCommandOutput}
 * @see {@link CreateControlCenterDeploymentRequestCommandInput} for command's `input` shape.
 * @see {@link CreateControlCenterDeploymentRequestCommandOutput} for command's `response` shape.
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
 * @throws {@link ConflictError} (client fault)
 *  Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
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
export declare class CreateControlCenterDeploymentRequestCommand extends CreateControlCenterDeploymentRequestCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateControlCenterDeploymentRequestInput;
            output: ControlCenterDeploymentRequest;
        };
        sdk: {
            input: CreateControlCenterDeploymentRequestCommandInput;
            output: CreateControlCenterDeploymentRequestCommandOutput;
        };
    };
}
