// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreatePackageGroupRequest,
  PackageGroup,
} from "../models/models_0";
import {
  de_CreatePackageGroupCommand,
  se_CreatePackageGroupCommand,
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
 * The input for {@link CreatePackageGroupCommand}.
 */
export interface CreatePackageGroupCommandInput extends CreatePackageGroupRequest {}
/**
 * @public
 *
 * The output of {@link CreatePackageGroupCommand}.
 */
export interface CreatePackageGroupCommandOutput extends PackageGroup, __MetadataBearer {}

/**
 * Create a new package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreatePackageGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreatePackageGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreatePackageGroupRequest
 *   name: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreatePackageGroupCommand(input);
 * const response = await client.send(command);
 * // { // PackageGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   is_primary: true || false, // required
 * // };
 *
 * ```
 *
 * @param CreatePackageGroupCommandInput - {@link CreatePackageGroupCommandInput}
 * @returns {@link CreatePackageGroupCommandOutput}
 * @see {@link CreatePackageGroupCommandInput} for command's `input` shape.
 * @see {@link CreatePackageGroupCommandOutput} for command's `response` shape.
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
export class CreatePackageGroupCommand extends $Command.classBuilder<CreatePackageGroupCommandInput, CreatePackageGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreatePackageGroup", {

  })
  .n("AirborneClient", "CreatePackageGroupCommand")
  .f(void 0, void 0)
  .ser(se_CreatePackageGroupCommand)
  .de(de_CreatePackageGroupCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreatePackageGroupRequest;
      output: PackageGroup;
  };
  sdk: {
      input: CreatePackageGroupCommandInput;
      output: CreatePackageGroupCommandOutput;
  };
};
}
