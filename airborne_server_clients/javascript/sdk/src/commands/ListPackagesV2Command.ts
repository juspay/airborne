// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ListPackagesV2Request,
  ListPackagesV2Response,
} from "../models/models_0";
import {
  de_ListPackagesV2Command,
  se_ListPackagesV2Command,
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
 * The input for {@link ListPackagesV2Command}.
 */
export interface ListPackagesV2CommandInput extends ListPackagesV2Request {}
/**
 * @public
 *
 * The output of {@link ListPackagesV2Command}.
 */
export interface ListPackagesV2CommandOutput extends ListPackagesV2Response, __MetadataBearer {}

/**
 * List packages within a package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListPackagesV2Command } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListPackagesV2Command } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListPackagesV2Request
 *   groupId: "STRING_VALUE", // required
 *   page: Number("int"),
 *   count: Number("int"),
 *   search: "STRING_VALUE",
 *   all: true || false,
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListPackagesV2Command(input);
 * const response = await client.send(command);
 * // { // ListPackagesV2Response
 * //   data: [ // PackageV2List // required
 * //     { // PackageV2
 * //       index: "STRING_VALUE",
 * //       tag: "STRING_VALUE",
 * //       version: Number("int"), // required
 * //       files: [ // StringList // required
 * //         "STRING_VALUE",
 * //       ],
 * //       package_group_id: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   total_pages: Number("int"), // required
 * //   total_items: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListPackagesV2CommandInput - {@link ListPackagesV2CommandInput}
 * @returns {@link ListPackagesV2CommandOutput}
 * @see {@link ListPackagesV2CommandInput} for command's `input` shape.
 * @see {@link ListPackagesV2CommandOutput} for command's `response` shape.
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
export class ListPackagesV2Command extends $Command.classBuilder<ListPackagesV2CommandInput, ListPackagesV2CommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListPackagesV2", {

  })
  .n("AirborneClient", "ListPackagesV2Command")
  .f(void 0, void 0)
  .ser(se_ListPackagesV2Command)
  .de(de_ListPackagesV2Command)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ListPackagesV2Request;
      output: ListPackagesV2Response;
  };
  sdk: {
      input: ListPackagesV2CommandInput;
      output: ListPackagesV2CommandOutput;
  };
};
}
