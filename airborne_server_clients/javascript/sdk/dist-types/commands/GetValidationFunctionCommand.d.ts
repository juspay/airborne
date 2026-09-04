import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { GetValidationFunctionRequest, ValidationFunctionResponse } from "../models/models_0";
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
 * The input for {@link GetValidationFunctionCommand}.
 */
export interface GetValidationFunctionCommandInput extends GetValidationFunctionRequest {
}
/**
 * @public
 *
 * The output of {@link GetValidationFunctionCommand}.
 */
export interface GetValidationFunctionCommandOutput extends ValidationFunctionResponse, __MetadataBearer {
}
declare const GetValidationFunctionCommand_base: {
    new (input: GetValidationFunctionCommandInput): import("@smithy/smithy-client").CommandImpl<GetValidationFunctionCommandInput, GetValidationFunctionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetValidationFunctionCommandInput): import("@smithy/smithy-client").CommandImpl<GetValidationFunctionCommandInput, GetValidationFunctionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * Get the application's release validation function. Apps that never saved one get the default, which accepts every release. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetValidationFunctionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetValidationFunctionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetValidationFunctionRequest
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetValidationFunctionCommand(input);
 * const response = await client.send(command);
 * // { // ValidationFunctionResponse
 * //   function_code: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetValidationFunctionCommandInput - {@link GetValidationFunctionCommandInput}
 * @returns {@link GetValidationFunctionCommandOutput}
 * @see {@link GetValidationFunctionCommandInput} for command's `input` shape.
 * @see {@link GetValidationFunctionCommandOutput} for command's `response` shape.
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
export declare class GetValidationFunctionCommand extends GetValidationFunctionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetValidationFunctionRequest;
            output: ValidationFunctionResponse;
        };
        sdk: {
            input: GetValidationFunctionCommandInput;
            output: GetValidationFunctionCommandOutput;
        };
    };
}
