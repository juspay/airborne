import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { UpdateValidationFunctionRequest, ValidationFunctionResponse } from "../models/models_0";
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
 * The input for {@link UpdateValidationFunctionCommand}.
 */
export interface UpdateValidationFunctionCommandInput extends UpdateValidationFunctionRequest {
}
/**
 * @public
 *
 * The output of {@link UpdateValidationFunctionCommand}.
 */
export interface UpdateValidationFunctionCommandOutput extends ValidationFunctionResponse, __MetadataBearer {
}
declare const UpdateValidationFunctionCommand_base: {
    new (input: UpdateValidationFunctionCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateValidationFunctionCommandInput, UpdateValidationFunctionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: UpdateValidationFunctionCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateValidationFunctionCommandInput, UpdateValidationFunctionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * Save the application's release validation function. The code must define a synchronous `function main(args)` returning a boolean; it runs before every release create/update, and returning false rejects the release. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdateValidationFunctionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdateValidationFunctionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdateValidationFunctionRequest
 *   function_code: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UpdateValidationFunctionCommand(input);
 * const response = await client.send(command);
 * // { // ValidationFunctionResponse
 * //   function_code: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param UpdateValidationFunctionCommandInput - {@link UpdateValidationFunctionCommandInput}
 * @returns {@link UpdateValidationFunctionCommandOutput}
 * @see {@link UpdateValidationFunctionCommandInput} for command's `input` shape.
 * @see {@link UpdateValidationFunctionCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
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
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class UpdateValidationFunctionCommand extends UpdateValidationFunctionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateValidationFunctionRequest;
            output: ValidationFunctionResponse;
        };
        sdk: {
            input: UpdateValidationFunctionCommandInput;
            output: UpdateValidationFunctionCommandOutput;
        };
    };
}
