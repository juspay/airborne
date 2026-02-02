// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  GetReleaseRequest,
  GetReleaseResponse,
} from "../models/models_0";
import {
  de_GetReleaseCommand,
  se_GetReleaseCommand,
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
 * The input for {@link GetReleaseCommand}.
 */
export interface GetReleaseCommandInput extends GetReleaseRequest {}
/**
 * @public
 *
 * The output of {@link GetReleaseCommand}.
 */
export interface GetReleaseCommandOutput extends GetReleaseResponse, __MetadataBearer {}

/**
 * Release request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetReleaseRequest
 *   releaseId: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetReleaseCommand(input);
 * const response = await client.send(command);
 * // { // GetReleaseResponse
 * //   id: "STRING_VALUE",
 * //   created_at: "STRING_VALUE",
 * //   config: { // GetReleaseConfig
 * //     version: "STRING_VALUE", // required
 * //     release_config_timeout: Number("int"), // required
 * //     boot_timeout: Number("int"), // required
 * //     properties: { // ConfigProperties
 * //       tenant_info: "DOCUMENT_VALUE", // required
 * //     },
 * //   },
 * //   package: { // GetReleasePackage
 * //     name: "STRING_VALUE",
 * //     group_id: "STRING_VALUE",
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
 * //   sub_packages: [ // StringList
 * //     "STRING_VALUE",
 * //   ],
 * //   resources: [
 * //     {
 * //       file_path: "STRING_VALUE",
 * //       url: "STRING_VALUE",
 * //       checksum: "STRING_VALUE",
 * //     },
 * //   ],
 * //   experiment: { // ReleaseExperiment
 * //     experiment_id: "STRING_VALUE",
 * //     package_version: Number("int"),
 * //     config_version: "STRING_VALUE",
 * //     created_at: "STRING_VALUE",
 * //     traffic_percentage: Number("int"),
 * //     status: "STRING_VALUE",
 * //   },
 * //   dimensions: { // DimensionsMap
 * //     "<keys>": "DOCUMENT_VALUE",
 * //   },
 * // };
 *
 * ```
 *
 * @param GetReleaseCommandInput - {@link GetReleaseCommandInput}
 * @returns {@link GetReleaseCommandOutput}
 * @see {@link GetReleaseCommandInput} for command's `input` shape.
 * @see {@link GetReleaseCommandOutput} for command's `response` shape.
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
export class GetReleaseCommand extends $Command.classBuilder<GetReleaseCommandInput, GetReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetRelease", {

  })
  .n("AirborneClient", "GetReleaseCommand")
  .f(void 0, void 0)
  .ser(se_GetReleaseCommand)
  .de(de_GetReleaseCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetReleaseRequest;
      output: GetReleaseResponse;
  };
  sdk: {
      input: GetReleaseCommandInput;
      output: GetReleaseCommandOutput;
  };
};
}
