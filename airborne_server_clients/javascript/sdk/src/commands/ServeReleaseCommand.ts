// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  GetServeReleaseInput,
  ReleaseConfig,
} from "../models/models_0";
import {
  de_ServeReleaseCommand,
  se_ServeReleaseCommand,
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
 * The input for {@link ServeReleaseCommand}.
 */
export interface ServeReleaseCommandInput extends GetServeReleaseInput {}
/**
 * @public
 *
 * The output of {@link ServeReleaseCommand}.
 */
export interface ServeReleaseCommandOutput extends ReleaseConfig, __MetadataBearer {}

/**
 * Get release request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ServeReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ServeReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetServeReleaseInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ServeReleaseCommand(input);
 * const response = await client.send(command);
 * // { // ReleaseConfig
 * //   config: { // GetReleaseConfig
 * //     version: "STRING_VALUE", // required
 * //     release_config_timeout: Number("int"), // required
 * //     boot_timeout: Number("int"), // required
 * //     properties: { // ConfigProperties
 * //       tenant_info: "DOCUMENT_VALUE", // required
 * //     },
 * //   },
 * //   package: { // Package
 * //     tag: "STRING_VALUE",
 * //     version: Number("int"), // required
 * //     index: "STRING_VALUE", // required
 * //     files: [ // StringList // required
 * //       "STRING_VALUE",
 * //     ],
 * //   },
 * //   resources: "DOCUMENT_VALUE", // required
 * // };
 *
 * ```
 *
 * @param ServeReleaseCommandInput - {@link ServeReleaseCommandInput}
 * @returns {@link ServeReleaseCommandOutput}
 * @see {@link ServeReleaseCommandInput} for command's `input` shape.
 * @see {@link ServeReleaseCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export class ServeReleaseCommand extends $Command.classBuilder<ServeReleaseCommandInput, ServeReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ServeRelease", {

  })
  .n("AirborneClient", "ServeReleaseCommand")
  .f(void 0, void 0)
  .ser(se_ServeReleaseCommand)
  .de(de_ServeReleaseCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetServeReleaseInput;
      output: ReleaseConfig;
  };
  sdk: {
      input: ServeReleaseCommandInput;
      output: ServeReleaseCommandOutput;
  };
};
}
