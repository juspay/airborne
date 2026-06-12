// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreatePackageV2Request,
  PackageV2,
} from "../models/models_0";
import {
  de_CreatePackageV2Command,
  se_CreatePackageV2Command,
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
 * The input for {@link CreatePackageV2Command}.
 */
export interface CreatePackageV2CommandInput extends CreatePackageV2Request {}
/**
 * @public
 *
 * The output of {@link CreatePackageV2Command}.
 */
export interface CreatePackageV2CommandOutput extends PackageV2, __MetadataBearer {}

/**
 * Create a package within a package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreatePackageV2Command } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreatePackageV2Command } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreatePackageV2Request
 *   groupId: "STRING_VALUE", // required
 *   index: "STRING_VALUE",
 *   tag: "STRING_VALUE",
 *   files: [ // StringList // required
 *     "STRING_VALUE",
 *   ],
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreatePackageV2Command(input);
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
 * @param CreatePackageV2CommandInput - {@link CreatePackageV2CommandInput}
 * @returns {@link CreatePackageV2CommandOutput}
 * @see {@link CreatePackageV2CommandInput} for command's `input` shape.
 * @see {@link CreatePackageV2CommandOutput} for command's `response` shape.
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
export class CreatePackageV2Command extends $Command.classBuilder<CreatePackageV2CommandInput, CreatePackageV2CommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreatePackageV2", {

  })
  .n("AirborneClient", "CreatePackageV2Command")
  .f(void 0, void 0)
  .ser(se_CreatePackageV2Command)
  .de(de_CreatePackageV2Command)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreatePackageV2Request;
      output: PackageV2;
  };
  sdk: {
      input: CreatePackageV2CommandInput;
      output: CreatePackageV2CommandOutput;
  };
};
}
