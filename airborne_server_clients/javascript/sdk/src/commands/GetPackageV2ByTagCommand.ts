// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  GetPackageV2ByTagRequest,
  PackageV2,
} from "../models/models_0";
import {
  de_GetPackageV2ByTagCommand,
  se_GetPackageV2ByTagCommand,
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
 * The input for {@link GetPackageV2ByTagCommand}.
 */
export interface GetPackageV2ByTagCommandInput extends GetPackageV2ByTagRequest {}
/**
 * @public
 *
 * The output of {@link GetPackageV2ByTagCommand}.
 */
export interface GetPackageV2ByTagCommandOutput extends PackageV2, __MetadataBearer {}

/**
 * Get a package by tag within a package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetPackageV2ByTagCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetPackageV2ByTagCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetPackageV2ByTagRequest
 *   groupId: "STRING_VALUE", // required
 *   tag: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetPackageV2ByTagCommand(input);
 * const response = await client.send(command);
 * // { // PackageV2
 * //   index: "STRING_VALUE",
 * //   tag: "STRING_VALUE",
 * //   version: Number("int"), // required
 * //   files: [ // StringList // required
 * //     "STRING_VALUE",
 * //   ],
 * //   package_group_id: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetPackageV2ByTagCommandInput - {@link GetPackageV2ByTagCommandInput}
 * @returns {@link GetPackageV2ByTagCommandOutput}
 * @see {@link GetPackageV2ByTagCommandInput} for command's `input` shape.
 * @see {@link GetPackageV2ByTagCommandOutput} for command's `response` shape.
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
export class GetPackageV2ByTagCommand extends $Command.classBuilder<GetPackageV2ByTagCommandInput, GetPackageV2ByTagCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetPackageV2ByTag", {

  })
  .n("AirborneClient", "GetPackageV2ByTagCommand")
  .f(void 0, void 0)
  .ser(se_GetPackageV2ByTagCommand)
  .de(de_GetPackageV2ByTagCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetPackageV2ByTagRequest;
      output: PackageV2;
  };
  sdk: {
      input: GetPackageV2ByTagCommandInput;
      output: GetPackageV2ByTagCommandOutput;
  };
};
}
