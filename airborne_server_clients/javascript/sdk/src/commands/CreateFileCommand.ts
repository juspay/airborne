// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateFileRequest,
  CreateFileResponse,
} from "../models/models_0";
import {
  de_CreateFileCommand,
  se_CreateFileCommand,
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
 * The input for {@link CreateFileCommand}.
 */
export interface CreateFileCommandInput extends CreateFileRequest {}
/**
 * @public
 *
 * The output of {@link CreateFileCommand}.
 */
export interface CreateFileCommandOutput extends CreateFileResponse, __MetadataBearer {}

/**
 * Create file request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileRequest
 *   file_path: "STRING_VALUE", // required
 *   url: "STRING_VALUE", // required
 *   tag: "STRING_VALUE",
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileCommand(input);
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
 * @param CreateFileCommandInput - {@link CreateFileCommandInput}
 * @returns {@link CreateFileCommandOutput}
 * @see {@link CreateFileCommandInput} for command's `input` shape.
 * @see {@link CreateFileCommandOutput} for command's `response` shape.
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
export class CreateFileCommand extends $Command.classBuilder<CreateFileCommandInput, CreateFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateFile", {

  })
  .n("AirborneClient", "CreateFileCommand")
  .f(void 0, void 0)
  .ser(se_CreateFileCommand)
  .de(de_CreateFileCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateFileRequest;
      output: CreateFileResponse;
  };
  sdk: {
      input: CreateFileCommandInput;
      output: CreateFileCommandOutput;
  };
};
}
