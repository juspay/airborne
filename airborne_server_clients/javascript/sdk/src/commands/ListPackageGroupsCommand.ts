// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ListPackageGroupsRequest,
  ListPackageGroupsResponse,
} from "../models/models_0";
import {
  de_ListPackageGroupsCommand,
  se_ListPackageGroupsCommand,
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
 * The input for {@link ListPackageGroupsCommand}.
 */
export interface ListPackageGroupsCommandInput extends ListPackageGroupsRequest {}
/**
 * @public
 *
 * The output of {@link ListPackageGroupsCommand}.
 */
export interface ListPackageGroupsCommandOutput extends ListPackageGroupsResponse, __MetadataBearer {}

/**
 * List all package groups
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListPackageGroupsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListPackageGroupsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListPackageGroupsRequest
 *   page: Number("int"),
 *   count: Number("int"),
 *   search: "STRING_VALUE",
 *   all: true || false,
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListPackageGroupsCommand(input);
 * const response = await client.send(command);
 * // { // ListPackageGroupsResponse
 * //   data: [ // PackageGroupList // required
 * //     { // PackageGroup
 * //       id: "STRING_VALUE", // required
 * //       name: "STRING_VALUE", // required
 * //       is_primary: true || false, // required
 * //     },
 * //   ],
 * //   total_pages: Number("int"), // required
 * //   total_items: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListPackageGroupsCommandInput - {@link ListPackageGroupsCommandInput}
 * @returns {@link ListPackageGroupsCommandOutput}
 * @see {@link ListPackageGroupsCommandInput} for command's `input` shape.
 * @see {@link ListPackageGroupsCommandOutput} for command's `response` shape.
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
export class ListPackageGroupsCommand extends $Command.classBuilder<ListPackageGroupsCommandInput, ListPackageGroupsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListPackageGroups", {

  })
  .n("AirborneClient", "ListPackageGroupsCommand")
  .f(void 0, void 0)
  .ser(se_ListPackageGroupsCommand)
  .de(de_ListPackageGroupsCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ListPackageGroupsRequest;
      output: ListPackageGroupsResponse;
  };
  sdk: {
      input: ListPackageGroupsCommandInput;
      output: ListPackageGroupsCommandOutput;
  };
};
}
