// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ControlCenterGroup,
  CreateControlCenterGroupInput,
} from "../models/models_0";
import {
  de_CreateControlCenterGroupCommand,
  se_CreateControlCenterGroupCommand,
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
 * The input for {@link CreateControlCenterGroupCommand}.
 */
export interface CreateControlCenterGroupCommandInput extends CreateControlCenterGroupInput {}
/**
 * @public
 *
 * The output of {@link CreateControlCenterGroupCommand}.
 */
export interface CreateControlCenterGroupCommandOutput extends ControlCenterGroup, __MetadataBearer {}

/**
 * Create a group with a name and full member list. Requires Bearer authentication and an x-organisation header. Only organisation admins/owners can create groups.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateControlCenterGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateControlCenterGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateControlCenterGroupInput
 *   organisation: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   members: [ // ControlCenterGroupMemberList // required
 *     { // ControlCenterGroupMember
 *       application: "STRING_VALUE", // required
 *       platform: "android" || "ios" || "web" || "other", // required
 *     },
 *   ],
 * };
 * const command = new CreateControlCenterGroupCommand(input);
 * const response = await client.send(command);
 * // { // ControlCenterGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   members: [ // ControlCenterGroupMemberList // required
 * //     { // ControlCenterGroupMember
 * //       application: "STRING_VALUE", // required
 * //       platform: "android" || "ios" || "web" || "other", // required
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param CreateControlCenterGroupCommandInput - {@link CreateControlCenterGroupCommandInput}
 * @returns {@link CreateControlCenterGroupCommandOutput}
 * @see {@link CreateControlCenterGroupCommandInput} for command's `input` shape.
 * @see {@link CreateControlCenterGroupCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export class CreateControlCenterGroupCommand extends $Command.classBuilder<CreateControlCenterGroupCommandInput, CreateControlCenterGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateControlCenterGroup", {

  })
  .n("AirborneClient", "CreateControlCenterGroupCommand")
  .f(void 0, void 0)
  .ser(se_CreateControlCenterGroupCommand)
  .de(de_CreateControlCenterGroupCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateControlCenterGroupInput;
      output: ControlCenterGroup;
  };
  sdk: {
      input: CreateControlCenterGroupCommandInput;
      output: CreateControlCenterGroupCommandOutput;
  };
};
}
