// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  FileSetDetail,
  GetFileSetRequest,
} from "../models/models_0";
import {
  de_GetFileSetCommand,
  se_GetFileSetCommand,
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
 * The input for {@link GetFileSetCommand}.
 */
export interface GetFileSetCommandInput extends GetFileSetRequest {}
/**
 * @public
 *
 * The output of {@link GetFileSetCommand}.
 */
export interface GetFileSetCommandOutput extends FileSetDetail, __MetadataBearer {}

/**
 * Get a file set and its full version history by name. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetFileSetCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetFileSetCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetFileSetRequest
 *   name: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetFileSetCommand(input);
 * const response = await client.send(command);
 * // { // FileSetDetail
 * //   name: "STRING_VALUE", // required
 * //   versions: [ // FileSetVersionList // required
 * //     { // FileSetVersion
 * //       version: Number("int"), // required
 * //       metadata: "DOCUMENT_VALUE", // required
 * //       files: [ // FileSetMemberList // required
 * //         { // FileSetMember
 * //           id: "STRING_VALUE", // required
 * //           file_path: "STRING_VALUE", // required
 * //           version: Number("int"), // required
 * //           tag: "STRING_VALUE",
 * //           url: "STRING_VALUE", // required
 * //           size: Number("long"), // required
 * //           checksum: "STRING_VALUE", // required
 * //         },
 * //       ],
 * //       created_at: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   created_at: "STRING_VALUE", // required
 * //   updated_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetFileSetCommandInput - {@link GetFileSetCommandInput}
 * @returns {@link GetFileSetCommandOutput}
 * @see {@link GetFileSetCommandInput} for command's `input` shape.
 * @see {@link GetFileSetCommandOutput} for command's `response` shape.
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
export class GetFileSetCommand extends $Command.classBuilder<GetFileSetCommandInput, GetFileSetCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetFileSet", {

  })
  .n("AirborneClient", "GetFileSetCommand")
  .f(void 0, void 0)
  .ser(se_GetFileSetCommand)
  .de(de_GetFileSetCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetFileSetRequest;
      output: FileSetDetail;
  };
  sdk: {
      input: GetFileSetCommandInput;
      output: GetFileSetCommandOutput;
  };
};
}
