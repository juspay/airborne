// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateFileResponse,
  UpdateFileRequest,
} from "../models/models_0";
import {
  de_UpdateFileCommand,
  se_UpdateFileCommand,
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
 * The input for {@link UpdateFileCommand}.
 */
export interface UpdateFileCommandInput extends UpdateFileRequest {}
/**
 * @public
 *
 * The output of {@link UpdateFileCommand}.
 */
export interface UpdateFileCommandOutput extends CreateFileResponse, __MetadataBearer {}

/**
 * Update file operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdateFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdateFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdateFileRequest
 *   file_key: "STRING_VALUE", // required
 *   tag: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UpdateFileCommand(input);
 * const response = await client.send(command);
 * // { // CreateFileResponse
 * //   id: "STRING_VALUE", // required
 * //   file_path: "STRING_VALUE", // required
 * //   url: "STRING_VALUE", // required
 * //   version: Number("int"), // required
 * //   tag: "STRING_VALUE",
 * //   size: Number("int"), // required
 * //   checksum: "STRING_VALUE", // required
 * //   metadata: "DOCUMENT_VALUE", // required
 * //   status: "STRING_VALUE", // required
 * //   created_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param UpdateFileCommandInput - {@link UpdateFileCommandInput}
 * @returns {@link UpdateFileCommandOutput}
 * @see {@link UpdateFileCommandInput} for command's `input` shape.
 * @see {@link UpdateFileCommandOutput} for command's `response` shape.
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
export class UpdateFileCommand extends $Command.classBuilder<UpdateFileCommandInput, UpdateFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "UpdateFile", {

  })
  .n("AirborneClient", "UpdateFileCommand")
  .f(void 0, void 0)
  .ser(se_UpdateFileCommand)
  .de(de_UpdateFileCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: UpdateFileRequest;
      output: CreateFileResponse;
  };
  sdk: {
      input: UpdateFileCommandInput;
      output: UpdateFileCommandOutput;
  };
};
}
