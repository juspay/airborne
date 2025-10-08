// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreatePackageRequest,
  Package,
} from "../models/models_0";
import {
  de_CreatePackageCommand,
  se_CreatePackageCommand,
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
 * The input for {@link CreatePackageCommand}.
 */
export interface CreatePackageCommandInput extends CreatePackageRequest {}
/**
 * @public
 *
 * The output of {@link CreatePackageCommand}.
 */
export interface CreatePackageCommandOutput extends Package, __MetadataBearer {}

/**
 * Create package request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreatePackageCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreatePackageCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreatePackageRequest
 *   index: "STRING_VALUE", // required
 *   tag: "STRING_VALUE",
 *   files: [ // StringList // required
 *     "STRING_VALUE",
 *   ],
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreatePackageCommand(input);
 * const response = await client.send(command);
 * // { // Package
 * //   tag: "STRING_VALUE",
 * //   version: Number("int"), // required
 * //   index: "STRING_VALUE", // required
 * //   files: [ // StringList // required
 * //     "STRING_VALUE",
 * //   ],
 * // };
 *
 * ```
 *
 * @param CreatePackageCommandInput - {@link CreatePackageCommandInput}
 * @returns {@link CreatePackageCommandOutput}
 * @see {@link CreatePackageCommandInput} for command's `input` shape.
 * @see {@link CreatePackageCommandOutput} for command's `response` shape.
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
export class CreatePackageCommand extends $Command.classBuilder<CreatePackageCommandInput, CreatePackageCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreatePackage", {

  })
  .n("AirborneClient", "CreatePackageCommand")
  .f(void 0, void 0)
  .ser(se_CreatePackageCommand)
  .de(de_CreatePackageCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreatePackageRequest;
      output: Package;
  };
  sdk: {
      input: CreatePackageCommandInput;
      output: CreatePackageCommandOutput;
  };
};
}
