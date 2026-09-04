// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ListFileGroupsRequest,
  ListFileGroupsResponse,
} from "../models/models_0";
import {
  de_ListFileGroupsCommand,
  se_ListFileGroupsCommand,
} from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
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
 * The input for {@link ListFileGroupsCommand}.
 */
export interface ListFileGroupsCommandInput extends ListFileGroupsRequest {}
/**
 * @public
 *
 * The output of {@link ListFileGroupsCommand}.
 */
export interface ListFileGroupsCommandOutput extends ListFileGroupsResponse, __MetadataBearer {}

/**
 * List the file groups of the application, ordered by name. Supports pagination and an optional name search. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListFileGroupsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListFileGroupsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListFileGroupsRequest
 *   page: Number("int"),
 *   count: Number("int"),
 *   all: true || false,
 *   search: "STRING_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListFileGroupsCommand(input);
 * const response = await client.send(command);
 * // { // ListFileGroupsResponse
 * //   data: [ // NamedFileGroupList // required
 * //     { // NamedFileGroup
 * //       name: "STRING_VALUE", // required
 * //       total_versions: Number("long"), // required
 * //       latest: { // FileGroupVersionInfo
 * //         version: Number("int"), // required
 * //         metadata: "DOCUMENT_VALUE", // required
 * //         files: [ // FileGroupMemberList // required
 * //           { // FileGroupMember
 * //             id: "STRING_VALUE", // required
 * //             file_path: "STRING_VALUE", // required
 * //             version: Number("int"), // required
 * //             tag: "STRING_VALUE",
 * //             url: "STRING_VALUE", // required
 * //             size: Number("long"), // required
 * //             checksum: "STRING_VALUE", // required
 * //           },
 * //         ],
 * //         created_at: "STRING_VALUE", // required
 * //       },
 * //       created_at: "STRING_VALUE", // required
 * //       updated_at: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   total_items: Number("long"), // required
 * //   total_pages: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListFileGroupsCommandInput - {@link ListFileGroupsCommandInput}
 * @returns {@link ListFileGroupsCommandOutput}
 * @see {@link ListFileGroupsCommandInput} for command's `input` shape.
 * @see {@link ListFileGroupsCommandOutput} for command's `response` shape.
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
export class ListFileGroupsCommand extends $Command.classBuilder<ListFileGroupsCommandInput, ListFileGroupsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListFileGroups", {

  })
  .n("AirborneClient", "ListFileGroupsCommand")
  .f(void 0, void 0)
  .ser(se_ListFileGroupsCommand)
  .de(de_ListFileGroupsCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ListFileGroupsRequest;
      output: ListFileGroupsResponse;
  };
  sdk: {
      input: ListFileGroupsCommandInput;
      output: ListFileGroupsCommandOutput;
  };
};
}
