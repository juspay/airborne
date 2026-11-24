// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ControlCenterApprovalPolicy,
  GetControlCenterApprovalPolicyInput,
} from "../models/models_0";
import {
  de_GetControlCenterApprovalPolicyCommand,
  se_GetControlCenterApprovalPolicyCommand,
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
 * The input for {@link GetControlCenterApprovalPolicyCommand}.
 */
export interface GetControlCenterApprovalPolicyCommandInput extends GetControlCenterApprovalPolicyInput {}
/**
 * @public
 *
 * The output of {@link GetControlCenterApprovalPolicyCommand}.
 */
export interface GetControlCenterApprovalPolicyCommandOutput extends ControlCenterApprovalPolicy, __MetadataBearer {}

/**
 * Return the application's current approval policy. An absent row returns disabled, empty rosters, a 24-hour TTL and emergency rollback enabled.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetControlCenterApprovalPolicyCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetControlCenterApprovalPolicyCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetControlCenterApprovalPolicyInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetControlCenterApprovalPolicyCommand(input);
 * const response = await client.send(command);
 * // { // ControlCenterApprovalPolicy
 * //   enabled: true || false, // required
 * //   makers: [ // StringList // required
 * //     "STRING_VALUE",
 * //   ],
 * //   checkers: [ // required
 * //     "STRING_VALUE",
 * //   ],
 * //   request_ttl_hours: Number("int"), // required
 * //   emergency_rollback: true || false, // required
 * // };
 *
 * ```
 *
 * @param GetControlCenterApprovalPolicyCommandInput - {@link GetControlCenterApprovalPolicyCommandInput}
 * @returns {@link GetControlCenterApprovalPolicyCommandOutput}
 * @see {@link GetControlCenterApprovalPolicyCommandInput} for command's `input` shape.
 * @see {@link GetControlCenterApprovalPolicyCommandOutput} for command's `response` shape.
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
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export class GetControlCenterApprovalPolicyCommand extends $Command.classBuilder<GetControlCenterApprovalPolicyCommandInput, GetControlCenterApprovalPolicyCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetControlCenterApprovalPolicy", {

  })
  .n("AirborneClient", "GetControlCenterApprovalPolicyCommand")
  .f(void 0, void 0)
  .ser(se_GetControlCenterApprovalPolicyCommand)
  .de(de_GetControlCenterApprovalPolicyCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetControlCenterApprovalPolicyInput;
      output: ControlCenterApprovalPolicy;
  };
  sdk: {
      input: GetControlCenterApprovalPolicyCommandInput;
      output: GetControlCenterApprovalPolicyCommandOutput;
  };
};
}
