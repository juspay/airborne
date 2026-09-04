// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  FileGroupDetail,
  GetFileGroupRequest,
} from "../models/models_0";
import {
  de_GetFileGroupCommand,
  se_GetFileGroupCommand,
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
 * The input for {@link GetFileGroupCommand}.
 */
export interface GetFileGroupCommandInput extends GetFileGroupRequest {}
/**
 * @public
 *
 * The output of {@link GetFileGroupCommand}.
 */
export interface GetFileGroupCommandOutput extends FileGroupDetail, __MetadataBearer {}

/**
 * Get a file group and its full version history by name. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetFileGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetFileGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetFileGroupRequest
 *   name: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetFileGroupCommand(input);
 * const response = await client.send(command);
 * // { // FileGroupDetail
 * //   name: "STRING_VALUE", // required
 * //   versions: [ // FileGroupVersionInfoList // required
 * //     { // FileGroupVersionInfo
 * //       version: Number("int"), // required
 * //       metadata: "DOCUMENT_VALUE", // required
 * //       files: [ // FileGroupMemberList // required
 * //         { // FileGroupMember
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
 * @param GetFileGroupCommandInput - {@link GetFileGroupCommandInput}
 * @returns {@link GetFileGroupCommandOutput}
 * @see {@link GetFileGroupCommandInput} for command's `input` shape.
 * @see {@link GetFileGroupCommandOutput} for command's `response` shape.
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
export class GetFileGroupCommand extends $Command.classBuilder<GetFileGroupCommandInput, GetFileGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetFileGroup", {

  })
  .n("AirborneClient", "GetFileGroupCommand")
  .f(void 0, void 0)
  .ser(se_GetFileGroupCommand)
  .de(de_GetFileGroupCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetFileGroupRequest;
      output: FileGroupDetail;
  };
  sdk: {
      input: GetFileGroupCommandInput;
      output: GetFileGroupCommandOutput;
  };
};
}
