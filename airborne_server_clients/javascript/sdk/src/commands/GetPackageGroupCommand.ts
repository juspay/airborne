// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  GetPackageGroupRequest,
  PackageGroup,
} from "../models/models_0";
import {
  de_GetPackageGroupCommand,
  se_GetPackageGroupCommand,
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
 * The input for {@link GetPackageGroupCommand}.
 */
export interface GetPackageGroupCommandInput extends GetPackageGroupRequest {}
/**
 * @public
 *
 * The output of {@link GetPackageGroupCommand}.
 */
export interface GetPackageGroupCommandOutput extends PackageGroup, __MetadataBearer {}

/**
 * Get a single package group by ID
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetPackageGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetPackageGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetPackageGroupRequest
 *   groupId: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetPackageGroupCommand(input);
 * const response = await client.send(command);
 * // { // PackageGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   is_primary: true || false, // required
 * // };
 *
 * ```
 *
 * @param GetPackageGroupCommandInput - {@link GetPackageGroupCommandInput}
 * @returns {@link GetPackageGroupCommandOutput}
 * @see {@link GetPackageGroupCommandInput} for command's `input` shape.
 * @see {@link GetPackageGroupCommandOutput} for command's `response` shape.
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
export class GetPackageGroupCommand extends $Command.classBuilder<GetPackageGroupCommandInput, GetPackageGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetPackageGroup", {

  })
  .n("AirborneClient", "GetPackageGroupCommand")
  .f(void 0, void 0)
  .ser(se_GetPackageGroupCommand)
  .de(de_GetPackageGroupCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetPackageGroupRequest;
      output: PackageGroup;
  };
  sdk: {
      input: GetPackageGroupCommandInput;
      output: GetPackageGroupCommandOutput;
  };
};
}
