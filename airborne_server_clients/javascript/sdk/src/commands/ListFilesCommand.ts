// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ListFilesRequest,
  ListFilesResponse,
} from "../models/models_0";
import {
  de_ListFilesCommand,
  se_ListFilesCommand,
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
 * The input for {@link ListFilesCommand}.
 */
export interface ListFilesCommandInput extends ListFilesRequest {}
/**
 * @public
 *
 * The output of {@link ListFilesCommand}.
 */
export interface ListFilesCommandOutput extends ListFilesResponse, __MetadataBearer {}

/**
 * List files request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListFilesCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListFilesCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListFilesRequest
 *   page: Number("int"),
 *   count: Number("int"),
 *   all: true || false,
 *   tag: "STRING_VALUE",
 *   search: "STRING_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new ListFilesCommand(input);
 * const response = await client.send(command);
 * // { // ListFilesResponse
 * //   data: [ // FileResponseList // required
 * //     { // CreateFileResponse
 * //       id: "STRING_VALUE", // required
 * //       file_path: "STRING_VALUE", // required
 * //       url: "STRING_VALUE", // required
 * //       version: Number("int"), // required
 * //       tag: "STRING_VALUE",
 * //       size: Number("int"), // required
 * //       checksum: "STRING_VALUE", // required
 * //       metadata: "DOCUMENT_VALUE", // required
 * //       status: "STRING_VALUE", // required
 * //       created_at: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   page: Number("int"), // required
 * //   count: Number("int"), // required
 * //   total_pages: Number("int"), // required
 * //   total_items: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param ListFilesCommandInput - {@link ListFilesCommandInput}
 * @returns {@link ListFilesCommandOutput}
 * @see {@link ListFilesCommandInput} for command's `input` shape.
 * @see {@link ListFilesCommandOutput} for command's `response` shape.
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
export class ListFilesCommand extends $Command.classBuilder<ListFilesCommandInput, ListFilesCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListFiles", {

  })
  .n("AirborneClient", "ListFilesCommand")
  .f(void 0, void 0)
  .ser(se_ListFilesCommand)
  .de(de_ListFilesCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ListFilesRequest;
      output: ListFilesResponse;
  };
  sdk: {
      input: ListFilesCommandInput;
      output: ListFilesCommandOutput;
  };
};
}
