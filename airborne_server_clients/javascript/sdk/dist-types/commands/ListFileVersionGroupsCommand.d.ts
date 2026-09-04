import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { ListFileVersionGroupsRequest, ListFileVersionGroupsResponse } from "../models/models_0";
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
 * The input for {@link ListFileVersionGroupsCommand}.
 */
export interface ListFileVersionGroupsCommandInput extends ListFileVersionGroupsRequest {
}
/**
 * @public
 *
 * The output of {@link ListFileVersionGroupsCommand}.
 */
export interface ListFileVersionGroupsCommandOutput extends ListFileVersionGroupsResponse, __MetadataBearer {
}
declare const ListFileVersionGroupsCommand_base: {
    new (input: ListFileVersionGroupsCommandInput): import("@smithy/smithy-client").CommandImpl<ListFileVersionGroupsCommandInput, ListFileVersionGroupsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: ListFileVersionGroupsCommandInput): import("@smithy/smithy-client").CommandImpl<ListFileVersionGroupsCommandInput, ListFileVersionGroupsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * List files grouped by path, so that all versions and tags of a file appear together. Supports pagination and optional search and tag filters. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListFileVersionGroupsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListFileVersionGroupsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListFileVersionGroupsRequest
 *   page: Number("int"),
 *   count: Number("int"),
 *   search: "STRING_VALUE",
 *   tags: "STRING_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListFileVersionGroupsCommand(input);
 * const response = await client.send(command);
 * // { // ListFileVersionGroupsResponse
 * //   groups: [ // FileGroupList // required
 * //     { // FileGroup
 * //       file_path: "STRING_VALUE", // required
 * //       total_versions: Number("int"), // required
 * //       versions: [ // FileGroupVersionList // required
 * //         { // FileGroupVersion
 * //           version: Number("int"), // required
 * //           url: "STRING_VALUE", // required
 * //           size: Number("int"), // required
 * //           created_at: "STRING_VALUE", // required
 * //         },
 * //       ],
 * //       tags: [ // FileGroupTagList // required
 * //         { // FileGroupTag
 * //           tag: "STRING_VALUE", // required
 * //           version: Number("int"), // required
 * //         },
 * //       ],
 * //     },
 * //   ],
 * //   total_items: Number("int"), // required
 * //   total_pages: Number("int"), // required
 * //   page: Number("int"), // required
 * //   count: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListFileVersionGroupsCommandInput - {@link ListFileVersionGroupsCommandInput}
 * @returns {@link ListFileVersionGroupsCommandOutput}
 * @see {@link ListFileVersionGroupsCommandInput} for command's `input` shape.
 * @see {@link ListFileVersionGroupsCommandOutput} for command's `response` shape.
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
export declare class ListFileVersionGroupsCommand extends ListFileVersionGroupsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListFileVersionGroupsRequest;
            output: ListFileVersionGroupsResponse;
        };
        sdk: {
            input: ListFileVersionGroupsCommandInput;
            output: ListFileVersionGroupsCommandOutput;
        };
    };
}
