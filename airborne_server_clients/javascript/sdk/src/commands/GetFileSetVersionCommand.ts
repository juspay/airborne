// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  FileSetVersion,
  GetFileSetVersionRequest,
} from "../models/models_0";
import {
  de_GetFileSetVersionCommand,
  se_GetFileSetVersionCommand,
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
 * The input for {@link GetFileSetVersionCommand}.
 */
export interface GetFileSetVersionCommandInput extends GetFileSetVersionRequest {}
/**
 * @public
 *
 * The output of {@link GetFileSetVersionCommand}.
 */
export interface GetFileSetVersionCommandOutput extends FileSetVersion, __MetadataBearer {}

/**
 * Get one version of a file set with its resolved files and metadata. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetFileSetVersionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetFileSetVersionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetFileSetVersionRequest
 *   name: "STRING_VALUE", // required
 *   version: Number("int"), // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetFileSetVersionCommand(input);
 * const response = await client.send(command);
 * // { // FileSetVersion
 * //   version: Number("int"), // required
 * //   metadata: "DOCUMENT_VALUE", // required
 * //   files: [ // FileSetMemberList // required
 * //     { // FileSetMember
 * //       id: "STRING_VALUE", // required
 * //       file_path: "STRING_VALUE", // required
 * //       version: Number("int"), // required
 * //       tag: "STRING_VALUE",
 * //       url: "STRING_VALUE", // required
 * //       size: Number("long"), // required
 * //       checksum: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   created_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetFileSetVersionCommandInput - {@link GetFileSetVersionCommandInput}
 * @returns {@link GetFileSetVersionCommandOutput}
 * @see {@link GetFileSetVersionCommandInput} for command's `input` shape.
 * @see {@link GetFileSetVersionCommandOutput} for command's `response` shape.
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
export class GetFileSetVersionCommand extends $Command.classBuilder<GetFileSetVersionCommandInput, GetFileSetVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetFileSetVersion", {

  })
  .n("AirborneClient", "GetFileSetVersionCommand")
  .f(void 0, void 0)
  .ser(se_GetFileSetVersionCommand)
  .de(de_GetFileSetVersionCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetFileSetVersionRequest;
      output: FileSetVersion;
  };
  sdk: {
      input: GetFileSetVersionCommandInput;
      output: GetFileSetVersionCommandOutput;
  };
};
}
