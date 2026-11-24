import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { RollbackReleaseInput, RollbackReleaseResponse } from "../models/models_0";
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
 * The input for {@link RollbackReleaseCommand}.
 */
export interface RollbackReleaseCommandInput extends RollbackReleaseInput {
}
/**
 * @public
 *
 * The output of {@link RollbackReleaseCommand}.
 */
export interface RollbackReleaseCommandOutput extends RollbackReleaseResponse, __MetadataBearer {
}
declare const RollbackReleaseCommand_base: {
    new (input: RollbackReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<RollbackReleaseCommandInput, RollbackReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: RollbackReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<RollbackReleaseCommandInput, RollbackReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Roll back a release according to its lifecycle state. Writes are durable and retries of a completed operation return its recorded success, including later unrelated live-release diagnostics. Unknown upstream outcomes return 409 unresolved and require real-state/operator review; changed replacements return 409 replacement_changed and must not be resumed automatically. Re-release only works while the source is the latest live release for its dimensions. Requires Bearer authentication plus x-organisation and x-application; callers need release write/conclude permission.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, RollbackReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, RollbackReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // RollbackReleaseInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   reason: "STRING_VALUE", // required
 *   emergency: true || false,
 *   confirm_sensitive_risk: true || false,
 * };
 * const command = new RollbackReleaseCommand(input);
 * const response = await client.send(command);
 * // { // RollbackReleaseResponse
 * //   action: "discarded" || "concluded_control" || "rereleased", // required
 * //   release_id: "STRING_VALUE", // required
 * //   rolled_back_to_package_version: "DOCUMENT_VALUE", // required
 * //   new_release_id: "DOCUMENT_VALUE", // required
 * //   reconciled_keys: { // ReconciledKeys
 * //     kept_current: [ // StringList // required
 * //       "STRING_VALUE",
 * //     ],
 * //     dropped: [ // required
 * //       "STRING_VALUE",
 * //     ],
 * //   },
 * //   current_live_release_id: "DOCUMENT_VALUE",
 * //   later_release_id: "DOCUMENT_VALUE",
 * // };
 *
 * ```
 *
 * @param RollbackReleaseCommandInput - {@link RollbackReleaseCommandInput}
 * @returns {@link RollbackReleaseCommandOutput}
 * @see {@link RollbackReleaseCommandInput} for command's `input` shape.
 * @see {@link RollbackReleaseCommandOutput} for command's `response` shape.
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
 * @throws {@link ConflictError} (client fault)
 *  Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
 *
 * @throws {@link ReleaseSupersededError} (client fault)
 *  Returned by rollback when the release is a concluded release that is no longer the latest live release for its dimensions. Nothing is changed.
 *
 * @throws {@link UnresolvedOperationError} (client fault)
 *  A write has an unknown upstream outcome. Inspect its real state and change history before resolving it; elapsed time alone does not establish rejection. An upstream 4xx is not proof that nothing was written, because the upstream handler can return it after configuration effects. While the operation is unresolved, writes for the application stay paused. When the 409 comes from a recovery attempt it can name the config keys or contexts that changed and must be restored, or finished and resolved as applied.
 *
 * @throws {@link RollbackReplacementChangedError} (client fault)
 *  The rollback replacement was changed outside the durable rollback operation. Human inspection is required; do not resume automatically.
 *
 * @throws {@link RollbackUnprocessableError} (client fault)
 *  Returned by rollback when no earlier live release exists or the historical package and config cannot be reconciled. Nothing is created.
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link RollbackPartialFailureError} (server fault)
 *  Returned when the durable replacement create, ramp, or conclude step needs recovery. Repeat the same rollback after reviewing upstream state.
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class RollbackReleaseCommand extends RollbackReleaseCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: RollbackReleaseInput;
            output: RollbackReleaseResponse;
        };
        sdk: {
            input: RollbackReleaseCommandInput;
            output: RollbackReleaseCommandOutput;
        };
    };
}
