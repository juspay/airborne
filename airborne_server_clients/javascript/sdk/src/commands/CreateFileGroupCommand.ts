// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateFileGroupRequest,
  NamedFileGroup,
} from "../models/models_0";
import {
  de_CreateFileGroupCommand,
  se_CreateFileGroupCommand,
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
 * The input for {@link CreateFileGroupCommand}.
 */
export interface CreateFileGroupCommandInput extends CreateFileGroupRequest {}
/**
 * @public
 *
 * The output of {@link CreateFileGroupCommand}.
 */
export interface CreateFileGroupCommandOutput extends NamedFileGroup, __MetadataBearer {}

/**
 * Create a file group: a named, versioned collection of files that can be selected together when building packages and releases. Names are unique within the application; the given files and metadata become version 1. Every file key must resolve to an existing file. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileGroupRequest
 *   name: "STRING_VALUE", // required
 *   files: [ // FileKeyList
 *     "STRING_VALUE",
 *   ],
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileGroupCommand(input);
 * const response = await client.send(command);
 * // { // NamedFileGroup
 * //   name: "STRING_VALUE", // required
 * //   total_versions: Number("long"), // required
 * //   latest: { // FileGroupVersionInfo
 * //     version: Number("int"), // required
 * //     metadata: "DOCUMENT_VALUE", // required
 * //     files: [ // FileGroupMemberList // required
 * //       { // FileGroupMember
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
 * @param CreateFileGroupCommandInput - {@link CreateFileGroupCommandInput}
 * @returns {@link CreateFileGroupCommandOutput}
 * @see {@link CreateFileGroupCommandInput} for command's `input` shape.
 * @see {@link CreateFileGroupCommandOutput} for command's `response` shape.
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
export class CreateFileGroupCommand extends $Command.classBuilder<CreateFileGroupCommandInput, CreateFileGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateFileGroup", {

  })
  .n("AirborneClient", "CreateFileGroupCommand")
  .f(void 0, void 0)
  .ser(se_CreateFileGroupCommand)
  .de(de_CreateFileGroupCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateFileGroupRequest;
      output: NamedFileGroup;
  };
  sdk: {
      input: CreateFileGroupCommandInput;
      output: CreateFileGroupCommandOutput;
  };
};
}
