import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { AcknowledgeEmergencyRollbackInput, AcknowledgeEmergencyRollbackResponse } from "../models/models_0";
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
 * The input for {@link AcknowledgeEmergencyRollbackCommand}.
 */
export interface AcknowledgeEmergencyRollbackCommandInput extends AcknowledgeEmergencyRollbackInput {
}
/**
 * @public
 *
 * The output of {@link AcknowledgeEmergencyRollbackCommand}.
 */
export interface AcknowledgeEmergencyRollbackCommandOutput extends AcknowledgeEmergencyRollbackResponse, __MetadataBearer {
}
declare const AcknowledgeEmergencyRollbackCommand_base: {
    new (input: AcknowledgeEmergencyRollbackCommandInput): import("@smithy/smithy-client").CommandImpl<AcknowledgeEmergencyRollbackCommandInput, AcknowledgeEmergencyRollbackCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: AcknowledgeEmergencyRollbackCommandInput): import("@smithy/smithy-client").CommandImpl<AcknowledgeEmergencyRollbackCommandInput, AcknowledgeEmergencyRollbackCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Independently acknowledge the emergency rollback for its source release. Only a different current checker may acknowledge it.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, AcknowledgeEmergencyRollbackCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, AcknowledgeEmergencyRollbackCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // AcknowledgeEmergencyRollbackInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   reason: "STRING_VALUE", // required
 * };
 * const command = new AcknowledgeEmergencyRollbackCommand(input);
 * const response = await client.send(command);
 * // { // AcknowledgeEmergencyRollbackResponse
 * //   success: true || false, // required
 * // };
 *
 * ```
 *
 * @param AcknowledgeEmergencyRollbackCommandInput - {@link AcknowledgeEmergencyRollbackCommandInput}
 * @returns {@link AcknowledgeEmergencyRollbackCommandOutput}
 * @see {@link AcknowledgeEmergencyRollbackCommandInput} for command's `input` shape.
 * @see {@link AcknowledgeEmergencyRollbackCommandOutput} for command's `response` shape.
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
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class AcknowledgeEmergencyRollbackCommand extends AcknowledgeEmergencyRollbackCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: AcknowledgeEmergencyRollbackInput;
            output: AcknowledgeEmergencyRollbackResponse;
        };
        sdk: {
            input: AcknowledgeEmergencyRollbackCommandInput;
            output: AcknowledgeEmergencyRollbackCommandOutput;
        };
    };
}
