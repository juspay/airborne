import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ListVersionResponse, ListVersionsRequest } from "../models/models_0";
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
 * The input for {@link ListVersionsCommand}.
 */
export interface ListVersionsCommandInput extends ListVersionsRequest {
}
/**
 * @public
 *
 * The output of {@link ListVersionsCommand}.
 */
export interface ListVersionsCommandOutput extends ListVersionResponse, __MetadataBearer {
}
declare const ListVersionsCommand_base: {
    new (input: ListVersionsCommandInput): import("@smithy/smithy-client").CommandImpl<ListVersionsCommandInput, ListVersionsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ListVersionsCommandInput): import("@smithy/smithy-client").CommandImpl<ListVersionsCommandInput, ListVersionsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * List versions request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListVersionsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListVersionsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListVersionsRequest
 *   filepath: "STRING_VALUE", // required
 *   page: Number("int"),
 *   count: Number("int"),
 *   all: true || false,
 *   search: "STRING_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListVersionsCommand(input);
 * const response = await client.send(command);
 * // { // ListVersionResponse
 * //   data: [ // FileVersionItemList // required
 * //     { // FileVersionItem
 * //       version: Number("int"), // required
 * //       tag: "STRING_VALUE",
 * //       created_at: "STRING_VALUE", // required
 * //       id: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   total_pages: Number("int"), // required
 * //   total_items: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListVersionsCommandInput - {@link ListVersionsCommandInput}
 * @returns {@link ListVersionsCommandOutput}
 * @see {@link ListVersionsCommandInput} for command's `input` shape.
 * @see {@link ListVersionsCommandOutput} for command's `response` shape.
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
export declare class ListVersionsCommand extends ListVersionsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListVersionsRequest;
            output: ListVersionResponse;
        };
        sdk: {
            input: ListVersionsCommandInput;
            output: ListVersionsCommandOutput;
        };
    };
}
