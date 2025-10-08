import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ListDimensionsRequest, ListDimensionsResponse } from "../models/models_0";
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
 * The input for {@link ListDimensionsCommand}.
 */
export interface ListDimensionsCommandInput extends ListDimensionsRequest {
}
/**
 * @public
 *
 * The output of {@link ListDimensionsCommand}.
 */
export interface ListDimensionsCommandOutput extends ListDimensionsResponse, __MetadataBearer {
}
declare const ListDimensionsCommand_base: {
    new (input: ListDimensionsCommandInput): import("@smithy/smithy-client").CommandImpl<ListDimensionsCommandInput, ListDimensionsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ListDimensionsCommandInput): import("@smithy/smithy-client").CommandImpl<ListDimensionsCommandInput, ListDimensionsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * List dimensions request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListDimensionsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListDimensionsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListDimensionsRequest
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   page: Number("int"),
 *   count: Number("int"),
 * };
 * const command = new ListDimensionsCommand(input);
 * const response = await client.send(command);
 * // { // ListDimensionsResponse
 * //   total_pages: Number("int"),
 * //   total_items: Number("int"),
 * //   data: [ // DimensionList
 * //     { // DimensionResponse
 * //       dimension: "STRING_VALUE", // required
 * //       description: "DOCUMENT_VALUE", // required
 * //       position: Number("int"), // required
 * //       schema: "DOCUMENT_VALUE",
 * //       change_reason: "STRING_VALUE", // required
 * //       mandatory: true || false,
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListDimensionsCommandInput - {@link ListDimensionsCommandInput}
 * @returns {@link ListDimensionsCommandOutput}
 * @see {@link ListDimensionsCommandInput} for command's `input` shape.
 * @see {@link ListDimensionsCommandOutput} for command's `response` shape.
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
export declare class ListDimensionsCommand extends ListDimensionsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListDimensionsRequest;
            output: ListDimensionsResponse;
        };
        sdk: {
            input: ListDimensionsCommandInput;
            output: ListDimensionsCommandOutput;
        };
    };
}
