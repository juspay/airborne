// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import { ListOrganisationsResponse } from "../models/models_0";
import {
  de_ListOrganisationsCommand,
  se_ListOrganisationsCommand,
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
 * The input for {@link ListOrganisationsCommand}.
 */
export interface ListOrganisationsCommandInput {}
/**
 * @public
 *
 * The output of {@link ListOrganisationsCommand}.
 */
export interface ListOrganisationsCommandOutput extends ListOrganisationsResponse, __MetadataBearer {}

/**
 * List organisations request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListOrganisationsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListOrganisationsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = {};
 * const command = new ListOrganisationsCommand(input);
 * const response = await client.send(command);
 * // { // ListOrganisationsResponse
 * //   organisations: [ // Organisations // required
 * //     { // Organisation
 * //       name: "STRING_VALUE", // required
 * //       applications: [ // Applications // required
 * //         { // Application
 * //           application: "STRING_VALUE", // required
 * //           organisation: "STRING_VALUE", // required
 * //           access: [ // StringList // required
 * //             "STRING_VALUE",
 * //           ],
 * //         },
 * //       ],
 * //       access: [ // required
 * //         "STRING_VALUE",
 * //       ],
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListOrganisationsCommandInput - {@link ListOrganisationsCommandInput}
 * @returns {@link ListOrganisationsCommandOutput}
 * @see {@link ListOrganisationsCommandInput} for command's `input` shape.
 * @see {@link ListOrganisationsCommandOutput} for command's `response` shape.
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
export class ListOrganisationsCommand extends $Command.classBuilder<ListOrganisationsCommandInput, ListOrganisationsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListOrganisations", {

  })
  .n("AirborneClient", "ListOrganisationsCommand")
  .f(void 0, void 0)
  .ser(se_ListOrganisationsCommand)
  .de(de_ListOrganisationsCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: {};
      output: ListOrganisationsResponse;
  };
  sdk: {
      input: ListOrganisationsCommandInput;
      output: ListOrganisationsCommandOutput;
  };
};
}
