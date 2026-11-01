import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { PutServingPolicyInput, ServingPolicy } from "../models/models_0";
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
 * The input for {@link PutServingPolicyCommand}.
 */
export interface PutServingPolicyCommandInput extends PutServingPolicyInput {
}
/**
 * @public
 *
 * The output of {@link PutServingPolicyCommand}.
 */
export interface PutServingPolicyCommandOutput extends ServingPolicy, __MetadataBearer {
}
declare const PutServingPolicyCommand_base: {
    new (input: PutServingPolicyCommandInput): import("@smithy/smithy-client").CommandImpl<PutServingPolicyCommandInput, PutServingPolicyCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: PutServingPolicyCommandInput): import("@smithy/smithy-client").CommandImpl<PutServingPolicyCommandInput, PutServingPolicyCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Change strict serving. Requires release update permission. Both directions require set_strict_serving approval when maker-checker is enabled. Payload body is \{strict: boolean\}, without release_id.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, PutServingPolicyCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, PutServingPolicyCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // PutServingPolicyInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   strict: true || false, // required
 * };
 * const command = new PutServingPolicyCommand(input);
 * const response = await client.send(command);
 * // { // ServingPolicy
 * //   strict: true || false, // required
 * //   deployment_override: true || false, // required
 * //   effective_strict: true || false, // required
 * // };
 *
 * ```
 *
 * @param PutServingPolicyCommandInput - {@link PutServingPolicyCommandInput}
 * @returns {@link PutServingPolicyCommandOutput}
 * @see {@link PutServingPolicyCommandInput} for command's `input` shape.
 * @see {@link PutServingPolicyCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
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
export declare class PutServingPolicyCommand extends PutServingPolicyCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: PutServingPolicyInput;
            output: ServingPolicy;
        };
        sdk: {
            input: PutServingPolicyCommandInput;
            output: PutServingPolicyCommandOutput;
        };
    };
}
