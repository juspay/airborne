// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  PackageGroup,
  UpdatePackageGroupRequest,
} from "../models/models_0";
import {
  de_UpdatePackageGroupNameCommand,
  se_UpdatePackageGroupNameCommand,
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
 * The input for {@link UpdatePackageGroupNameCommand}.
 */
export interface UpdatePackageGroupNameCommandInput extends UpdatePackageGroupRequest {}
/**
 * @public
 *
 * The output of {@link UpdatePackageGroupNameCommand}.
 */
export interface UpdatePackageGroupNameCommandOutput extends PackageGroup, __MetadataBearer {}

/**
 * Update a package group name
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdatePackageGroupNameCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdatePackageGroupNameCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdatePackageGroupRequest
 *   groupId: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UpdatePackageGroupNameCommand(input);
 * const response = await client.send(command);
 * // { // PackageGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   is_primary: true || false, // required
 * // };
 *
 * ```
 *
 * @param UpdatePackageGroupNameCommandInput - {@link UpdatePackageGroupNameCommandInput}
 * @returns {@link UpdatePackageGroupNameCommandOutput}
 * @see {@link UpdatePackageGroupNameCommandInput} for command's `input` shape.
 * @see {@link UpdatePackageGroupNameCommandOutput} for command's `response` shape.
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
export class UpdatePackageGroupNameCommand extends $Command.classBuilder<UpdatePackageGroupNameCommandInput, UpdatePackageGroupNameCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "UpdatePackageGroupName", {

  })
  .n("AirborneClient", "UpdatePackageGroupNameCommand")
  .f(void 0, void 0)
  .ser(se_UpdatePackageGroupNameCommand)
  .de(de_UpdatePackageGroupNameCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: UpdatePackageGroupRequest;
      output: PackageGroup;
  };
  sdk: {
      input: UpdatePackageGroupNameCommandInput;
      output: UpdatePackageGroupNameCommandOutput;
  };
};
}
