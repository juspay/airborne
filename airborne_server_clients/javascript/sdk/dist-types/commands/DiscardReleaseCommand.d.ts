import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { DiscardReleaseInput, DiscardReleaseResponse } from "../models/models_0";
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
 * The input for {@link DiscardReleaseCommand}.
 */
export interface DiscardReleaseCommandInput extends DiscardReleaseInput {
}
/**
 * @public
 *
 * The output of {@link DiscardReleaseCommand}.
 */
export interface DiscardReleaseCommandOutput extends DiscardReleaseResponse, __MetadataBearer {
}
declare const DiscardReleaseCommand_base: {
    new (input: DiscardReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<DiscardReleaseCommandInput, DiscardReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: DiscardReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<DiscardReleaseCommandInput, DiscardReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Discard a release that has not been ramped, so it never serves traffic. Only a release in the created state can be discarded; a ramped release must be concluded on "control" or rolled back instead, and a release that is already concluded or discarded returns 409. Unknown release ids return 404. Discarding never needs approval. Pass the organisation and application in the x-organisation and x-application headers. Returns 409 with "code: unresolved" when an upstream outcome is unknown. Requires a bearer token and release discard permission.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, DiscardReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, DiscardReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // DiscardReleaseInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   change_reason: "STRING_VALUE",
 * };
 * const command = new DiscardReleaseCommand(input);
 * const response = await client.send(command);
 * // { // DiscardReleaseResponse
 * //   success: true || false, // required
 * //   message: "STRING_VALUE", // required
 * //   experiment_id: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param DiscardReleaseCommandInput - {@link DiscardReleaseCommandInput}
 * @returns {@link DiscardReleaseCommandOutput}
 * @see {@link DiscardReleaseCommandInput} for command's `input` shape.
 * @see {@link DiscardReleaseCommandOutput} for command's `response` shape.
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
export declare class DiscardReleaseCommand extends DiscardReleaseCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DiscardReleaseInput;
            output: DiscardReleaseResponse;
        };
        sdk: {
            input: DiscardReleaseCommandInput;
            output: DiscardReleaseCommandOutput;
        };
    };
}
