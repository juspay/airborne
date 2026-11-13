// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ControlCenterApprovalPolicy,
  UpdateControlCenterApprovalPolicyInput,
} from "../models/models_0";
import {
  de_UpdateControlCenterApprovalPolicyCommand,
  se_UpdateControlCenterApprovalPolicyCommand,
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
 * The input for {@link UpdateControlCenterApprovalPolicyCommand}.
 */
export interface UpdateControlCenterApprovalPolicyCommandInput extends UpdateControlCenterApprovalPolicyInput {}
/**
 * @public
 *
 * The output of {@link UpdateControlCenterApprovalPolicyCommand}.
 */
export interface UpdateControlCenterApprovalPolicyCommandOutput extends ControlCenterApprovalPolicy, __MetadataBearer {}

/**
 * Replace the application's approval policy. Only actual organisation owners/admins may edit it. Roster identities must be enabled Keycloak users with app access and ordinary release permissions. Enabling requires at least two distinct subjects and a different eligible checker for each maker. Returns 409 until the operator deployment readiness fence is attested after all old instances and writes are drained.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdateControlCenterApprovalPolicyCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdateControlCenterApprovalPolicyCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdateControlCenterApprovalPolicyInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   enabled: true || false,
 *   makers: [ // StringList
 *     "STRING_VALUE",
 *   ],
 *   checkers: [
 *     "STRING_VALUE",
 *   ],
 *   request_ttl_hours: Number("int"),
 *   emergency_rollback: true || false,
 * };
 * const command = new UpdateControlCenterApprovalPolicyCommand(input);
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
 * @param UpdateControlCenterApprovalPolicyCommandInput - {@link UpdateControlCenterApprovalPolicyCommandInput}
 * @returns {@link UpdateControlCenterApprovalPolicyCommandOutput}
 * @see {@link UpdateControlCenterApprovalPolicyCommandInput} for command's `input` shape.
 * @see {@link UpdateControlCenterApprovalPolicyCommandOutput} for command's `response` shape.
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
 * @throws {@link ConflictError} (client fault)
 *  Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
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
export class UpdateControlCenterApprovalPolicyCommand extends $Command.classBuilder<UpdateControlCenterApprovalPolicyCommandInput, UpdateControlCenterApprovalPolicyCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "UpdateControlCenterApprovalPolicy", {

  })
  .n("AirborneClient", "UpdateControlCenterApprovalPolicyCommand")
  .f(void 0, void 0)
  .ser(se_UpdateControlCenterApprovalPolicyCommand)
  .de(de_UpdateControlCenterApprovalPolicyCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: UpdateControlCenterApprovalPolicyInput;
      output: ControlCenterApprovalPolicy;
  };
  sdk: {
      input: UpdateControlCenterApprovalPolicyCommandInput;
      output: UpdateControlCenterApprovalPolicyCommandOutput;
  };
};
}
