// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateReleaseRequest,
  CreateReleaseResponse,
} from "../models/models_0";
import {
  de_CreateReleaseCommand,
  se_CreateReleaseCommand,
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
 * The input for {@link CreateReleaseCommand}.
 */
export interface CreateReleaseCommandInput extends CreateReleaseRequest {}
/**
 * @public
 *
 * The output of {@link CreateReleaseCommand}.
 */
export interface CreateReleaseCommandOutput extends CreateReleaseResponse, __MetadataBearer {}

/**
 * Create release request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateReleaseRequest
 *   config: { // CreateReleaseRequestConfig
 *     release_config_timeout: Number("int"), // required
 *     boot_timeout: Number("int"), // required
 *     properties: "DOCUMENT_VALUE", // required
 *   },
 *   package_id: "STRING_VALUE",
 *   package: { // CreateReleaseRequestPackage
 *     properties: "DOCUMENT_VALUE",
 *     important: [ // StringList
 *       "STRING_VALUE",
 *     ],
 *     lazy: [
 *       "STRING_VALUE",
 *     ],
 *   },
 *   dimensions: { // DimensionsMap
 *     "<keys>": "DOCUMENT_VALUE",
 *   },
 *   resources: [
 *     "STRING_VALUE",
 *   ],
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateReleaseCommand(input);
 * const response = await client.send(command);
 * // { // CreateReleaseResponse
 * //   id: "STRING_VALUE", // required
 * //   created_at: "STRING_VALUE", // required
 * //   config: { // GetReleaseConfig
 * //     version: "STRING_VALUE", // required
 * //     release_config_timeout: Number("int"), // required
 * //     boot_timeout: Number("int"), // required
 * //     properties: { // ConfigProperties
 * //       tenant_info: "DOCUMENT_VALUE", // required
 * //     },
 * //   },
 * //   package: { // ServePackage
 * //     name: "STRING_VALUE",
 * //     version: "STRING_VALUE",
 * //     index: { // ServeFile
 * //       file_path: "STRING_VALUE",
 * //       url: "STRING_VALUE",
 * //       checksum: "STRING_VALUE",
 * //     },
 * //     properties: "DOCUMENT_VALUE",
 * //     important: [ // ServeFileList
 * //       {
 * //         file_path: "STRING_VALUE",
 * //         url: "STRING_VALUE",
 * //         checksum: "STRING_VALUE",
 * //       },
 * //     ],
 * //     lazy: [
 * //       {
 * //         file_path: "STRING_VALUE",
 * //         url: "STRING_VALUE",
 * //         checksum: "STRING_VALUE",
 * //       },
 * //     ],
 * //   },
 * //   experiment: { // ReleaseExperiment
 * //     experiment_id: "STRING_VALUE",
 * //     package_version: Number("int"),
 * //     config_version: "STRING_VALUE",
 * //     created_at: "STRING_VALUE",
 * //     traffic_percentage: Number("int"),
 * //     status: "STRING_VALUE",
 * //   },
 * //   dimensions: { // DimensionsMap // required
 * //     "<keys>": "DOCUMENT_VALUE",
 * //   },
 * // };
 *
 * ```
 *
 * @param CreateReleaseCommandInput - {@link CreateReleaseCommandInput}
 * @returns {@link CreateReleaseCommandOutput}
 * @see {@link CreateReleaseCommandInput} for command's `input` shape.
 * @see {@link CreateReleaseCommandOutput} for command's `response` shape.
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
export class CreateReleaseCommand extends $Command.classBuilder<CreateReleaseCommandInput, CreateReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateRelease", {

  })
  .n("AirborneClient", "CreateReleaseCommand")
  .f(void 0, void 0)
  .ser(se_CreateReleaseCommand)
  .de(de_CreateReleaseCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateReleaseRequest;
      output: CreateReleaseResponse;
  };
  sdk: {
      input: CreateReleaseCommandInput;
      output: CreateReleaseCommandOutput;
  };
};
}
