import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ConcludeReleaseInput, ConcludeReleaseResponse } from "../models/models_0";
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
 * The input for {@link ConcludeReleaseCommand}.
 */
export interface ConcludeReleaseCommandInput extends ConcludeReleaseInput {
}
/**
 * @public
 *
 * The output of {@link ConcludeReleaseCommand}.
 */
export interface ConcludeReleaseCommandOutput extends ConcludeReleaseResponse, __MetadataBearer {
}
declare const ConcludeReleaseCommand_base: {
    new (input: ConcludeReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<ConcludeReleaseCommandInput, ConcludeReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ConcludeReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<ConcludeReleaseCommandInput, ConcludeReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Make one variant of a ramped release permanent. Concluding on an experimental variant promotes the release; concluding on the control variant ends it and leaves the previous release live. Read the variant ids from experiment.experiment_variants on GetRelease. The release must have been ramped first. Unknown release ids return 404. Pass the organisation and application in the x-organisation and x-application headers. Returns 409 when the release is still only created (ramp it first) or has already concluded or been discarded, 409 with "code: unresolved" when an upstream outcome is unknown, and 400 when the chosen variant does not exist. When the application requires approvals, every conclude is refused with 403 "approval_required"; raise a deployment request instead. Requires a bearer token and release conclude permission.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ConcludeReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ConcludeReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ConcludeReleaseInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   chosen_variant: "STRING_VALUE", // required
 *   change_reason: "STRING_VALUE",
 * };
 * const command = new ConcludeReleaseCommand(input);
 * const response = await client.send(command);
 * // { // ConcludeReleaseResponse
 * //   success: true || false, // required
 * //   message: "STRING_VALUE", // required
 * //   experiment_id: "STRING_VALUE", // required
 * //   chosen_variant: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param ConcludeReleaseCommandInput - {@link ConcludeReleaseCommandInput}
 * @returns {@link ConcludeReleaseCommandOutput}
 * @see {@link ConcludeReleaseCommandInput} for command's `input` shape.
 * @see {@link ConcludeReleaseCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link ConflictError} (client fault)
 *  Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link UnresolvedOperationError} (client fault)
 *  A write has an unknown upstream outcome. Inspect its real state and change history before resolving it; elapsed time alone does not establish rejection. An upstream 4xx is not proof that nothing was written, because the upstream handler can return it after configuration effects. While the operation is unresolved, writes for the application stay paused. When the 409 comes from a recovery attempt it can name the config keys or contexts that changed and must be restored, or finished and resolved as applied.
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
export declare class ConcludeReleaseCommand extends ConcludeReleaseCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ConcludeReleaseInput;
            output: ConcludeReleaseResponse;
        };
        sdk: {
            input: ConcludeReleaseCommandInput;
            output: ConcludeReleaseCommandOutput;
        };
    };
}
