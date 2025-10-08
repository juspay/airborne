import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateDimensionRequest, CreateDimensionResponse } from "../models/models_0";
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
 * The input for {@link CreateDimensionCommand}.
 */
export interface CreateDimensionCommandInput extends CreateDimensionRequest {
}
/**
 * @public
 *
 * The output of {@link CreateDimensionCommand}.
 */
export interface CreateDimensionCommandOutput extends CreateDimensionResponse, __MetadataBearer {
}
declare const CreateDimensionCommand_base: {
    new (input: CreateDimensionCommandInput): import("@smithy/smithy-client").CommandImpl<CreateDimensionCommandInput, CreateDimensionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateDimensionCommandInput): import("@smithy/smithy-client").CommandImpl<CreateDimensionCommandInput, CreateDimensionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create dimension request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateDimensionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateDimensionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateDimensionRequest
 *   dimension: "STRING_VALUE", // required
 *   description: "STRING_VALUE", // required
 *   dimension_type: "standard" || "cohort", // required
 *   depends_on: "STRING_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateDimensionCommand(input);
 * const response = await client.send(command);
 * // { // CreateDimensionResponse
 * //   dimension: "STRING_VALUE", // required
 * //   description: "DOCUMENT_VALUE", // required
 * //   position: Number("int"), // required
 * //   schema: "DOCUMENT_VALUE",
 * //   change_reason: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param CreateDimensionCommandInput - {@link CreateDimensionCommandInput}
 * @returns {@link CreateDimensionCommandOutput}
 * @see {@link CreateDimensionCommandInput} for command's `input` shape.
 * @see {@link CreateDimensionCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
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
export declare class CreateDimensionCommand extends CreateDimensionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateDimensionRequest;
            output: CreateDimensionResponse;
        };
        sdk: {
            input: CreateDimensionCommandInput;
            output: CreateDimensionCommandOutput;
        };
    };
}
