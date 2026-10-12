// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateFileSetRequest,
  FileSet,
} from "../models/models_0";
import {
  de_CreateFileSetCommand,
  se_CreateFileSetCommand,
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
 * The input for {@link CreateFileSetCommand}.
 */
export interface CreateFileSetCommandInput extends CreateFileSetRequest {}
/**
 * @public
 *
 * The output of {@link CreateFileSetCommand}.
 */
export interface CreateFileSetCommandOutput extends FileSet, __MetadataBearer {}

/**
 * Create a file set: a named, versioned collection of files that can be selected together when building packages and releases. Names are unique within the application; the given files and metadata become version 1. Every file key must resolve to an existing file. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileSetCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileSetCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileSetRequest
 *   name: "STRING_VALUE", // required
 *   files: [ // FileKeyList // required
 *     "STRING_VALUE",
 *   ],
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileSetCommand(input);
 * const response = await client.send(command);
 * // { // FileSet
 * //   name: "STRING_VALUE", // required
 * //   total_versions: Number("long"), // required
 * //   latest: { // FileSetVersion
 * //     version: Number("int"), // required
 * //     metadata: "DOCUMENT_VALUE", // required
 * //     files: [ // FileSetMemberList // required
 * //       { // FileSetMember
 * //         id: "STRING_VALUE", // required
 * //         file_path: "STRING_VALUE", // required
 * //         version: Number("int"), // required
 * //         tag: "STRING_VALUE",
 * //         url: "STRING_VALUE", // required
 * //         size: Number("long"), // required
 * //         checksum: "STRING_VALUE", // required
 * //       },
 * //     ],
 * //     created_at: "STRING_VALUE", // required
 * //   },
 * //   created_at: "STRING_VALUE", // required
 * //   updated_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param CreateFileSetCommandInput - {@link CreateFileSetCommandInput}
 * @returns {@link CreateFileSetCommandOutput}
 * @see {@link CreateFileSetCommandInput} for command's `input` shape.
 * @see {@link CreateFileSetCommandOutput} for command's `response` shape.
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
export class CreateFileSetCommand extends $Command.classBuilder<CreateFileSetCommandInput, CreateFileSetCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateFileSet", {

  })
  .n("AirborneClient", "CreateFileSetCommand")
  .f(void 0, void 0)
  .ser(se_CreateFileSetCommand)
  .de(de_CreateFileSetCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateFileSetRequest;
      output: FileSet;
  };
  sdk: {
      input: CreateFileSetCommandInput;
      output: CreateFileSetCommandOutput;
  };
};
}
