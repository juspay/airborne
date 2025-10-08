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
  de_ServeReleaseV2Command,
  se_ServeReleaseV2Command,
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
 * The input for {@link ServeReleaseV2Command}.
 */
export interface ServeReleaseV2CommandInput extends GetServeReleaseInput {}
/**
 * @public
 *
 * The output of {@link ServeReleaseV2Command}.
 */
export interface ServeReleaseV2CommandOutput extends ReleaseConfig, __MetadataBearer {}

/**
 * Get release v2 request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ServeReleaseV2Command } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ServeReleaseV2Command } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetServeReleaseInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ServeReleaseV2Command(input);
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
 * @param ServeReleaseV2CommandInput - {@link ServeReleaseV2CommandInput}
 * @returns {@link ServeReleaseV2CommandOutput}
 * @see {@link ServeReleaseV2CommandInput} for command's `input` shape.
 * @see {@link ServeReleaseV2CommandOutput} for command's `response` shape.
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
export class ServeReleaseV2Command extends $Command.classBuilder<ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ServeReleaseV2", {

  })
  .n("AirborneClient", "ServeReleaseV2Command")
  .f(void 0, void 0)
  .ser(se_ServeReleaseV2Command)
  .de(de_ServeReleaseV2Command)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetServeReleaseInput;
      output: ReleaseConfig;
  };
  sdk: {
      input: ServeReleaseV2CommandInput;
      output: ServeReleaseV2CommandOutput;
  };
};
}
