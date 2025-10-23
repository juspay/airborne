import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ListFilesRequest, ListFilesResponse } from "../models/models_0";
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
 * The input for {@link ListFilesCommand}.
 */
export interface ListFilesCommandInput extends ListFilesRequest {
}
/**
 * @public
 *
 * The output of {@link ListFilesCommand}.
 */
export interface ListFilesCommandOutput extends ListFilesResponse, __MetadataBearer {
}
declare const ListFilesCommand_base: {
    new (input: ListFilesCommandInput): import("@smithy/smithy-client").CommandImpl<ListFilesCommandInput, ListFilesCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ListFilesCommandInput): import("@smithy/smithy-client").CommandImpl<ListFilesCommandInput, ListFilesCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * List files request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListFilesCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListFilesCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListFilesRequest
 *   page: Number("int"),
 *   count: Number("int"),
 *   all: true || false,
 *   search: "STRING_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListFilesCommand(input);
 * const response = await client.send(command);
 * // { // ListFilesResponse
 * //   data: [ // FileResponseList // required
 * //     { // FileResponseListItem
 * //       file_path: "STRING_VALUE", // required
 * //       id: "STRING_VALUE", // required
 * //       version: Number("int"), // required
 * //       total_versions: Number("int"), // required
 * //     },
 * //   ],
 * //   total_pages: Number("int"), // required
 * //   total_items: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListFilesCommandInput - {@link ListFilesCommandInput}
 * @returns {@link ListFilesCommandOutput}
 * @see {@link ListFilesCommandInput} for command's `input` shape.
 * @see {@link ListFilesCommandOutput} for command's `response` shape.
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
export declare class ListFilesCommand extends ListFilesCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListFilesRequest;
            output: ListFilesResponse;
        };
        sdk: {
            input: ListFilesCommandInput;
            output: ListFilesCommandOutput;
        };
    };
}
