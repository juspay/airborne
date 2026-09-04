import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { TestValidationFunctionRequest, TestValidationFunctionResponse } from "../models/models_0";
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
 * The input for {@link TestValidationFunctionCommand}.
 */
export interface TestValidationFunctionCommandInput extends TestValidationFunctionRequest {
}
/**
 * @public
 *
 * The output of {@link TestValidationFunctionCommand}.
 */
export interface TestValidationFunctionCommandOutput extends TestValidationFunctionResponse, __MetadataBearer {
}
declare const TestValidationFunctionCommand_base: {
    new (input: TestValidationFunctionCommandInput): import("@smithy/smithy-client").CommandImpl<TestValidationFunctionCommandInput, TestValidationFunctionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: TestValidationFunctionCommandInput): import("@smithy/smithy-client").CommandImpl<TestValidationFunctionCommandInput, TestValidationFunctionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * Run validation code against test arguments without saving it, returning the boolean result or the execution error. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, TestValidationFunctionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, TestValidationFunctionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // TestValidationFunctionRequest
 *   function_code: "STRING_VALUE", // required
 *   test_args: "DOCUMENT_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new TestValidationFunctionCommand(input);
 * const response = await client.send(command);
 * // { // TestValidationFunctionResponse
 * //   valid: true || false, // required
 * //   result: true || false,
 * //   error: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param TestValidationFunctionCommandInput - {@link TestValidationFunctionCommandInput}
 * @returns {@link TestValidationFunctionCommandOutput}
 * @see {@link TestValidationFunctionCommandInput} for command's `input` shape.
 * @see {@link TestValidationFunctionCommandOutput} for command's `response` shape.
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
export declare class TestValidationFunctionCommand extends TestValidationFunctionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: TestValidationFunctionRequest;
            output: TestValidationFunctionResponse;
        };
        sdk: {
            input: TestValidationFunctionCommandInput;
            output: TestValidationFunctionCommandOutput;
        };
    };
}
