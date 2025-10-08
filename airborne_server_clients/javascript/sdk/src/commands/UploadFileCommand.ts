// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateFileResponse,
  UploadFileRequest,
  UploadFileRequestFilterSensitiveLog,
} from "../models/models_0";
import {
  de_UploadFileCommand,
  se_UploadFileCommand,
} from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import {
  StreamingBlobPayloadInputTypes,
  MetadataBearer as __MetadataBearer,
} from "@smithy/types";

/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UploadFileCommand}.
 */
export interface UploadFileCommandInput extends Omit<UploadFileRequest, "file"> {
    file: StreamingBlobPayloadInputTypes;
}

/**
 * @public
 *
 * The output of {@link UploadFileCommand}.
 */
export interface UploadFileCommandOutput extends CreateFileResponse, __MetadataBearer {}

/**
 * Upload file request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UploadFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UploadFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UploadFileRequest
 *   file: "MULTIPLE_TYPES_ACCEPTED", // see \@smithy/types -> StreamingBlobPayloadInputTypes // required
 *   file_path: "STRING_VALUE", // required
 *   tag: "STRING_VALUE",
 *   checksum: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UploadFileCommand(input);
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
 * @param UploadFileCommandInput - {@link UploadFileCommandInput}
 * @returns {@link UploadFileCommandOutput}
 * @see {@link UploadFileCommandInput} for command's `input` shape.
 * @see {@link UploadFileCommandOutput} for command's `response` shape.
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
export class UploadFileCommand extends $Command.classBuilder<UploadFileCommandInput, UploadFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "UploadFile", {

  })
  .n("AirborneClient", "UploadFileCommand")
  .f(UploadFileRequestFilterSensitiveLog, void 0)
  .ser(se_UploadFileCommand)
  .de(de_UploadFileCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: UploadFileRequest;
      output: CreateFileResponse;
  };
  sdk: {
      input: UploadFileCommandInput;
      output: UploadFileCommandOutput;
  };
};
}
