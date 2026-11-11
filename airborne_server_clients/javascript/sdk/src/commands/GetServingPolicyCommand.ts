// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  GetServingPolicyInput,
  ServingPolicy,
} from "../models/models_0";
import {
  de_GetServingPolicyCommand,
  se_GetServingPolicyCommand,
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
 * The input for {@link GetServingPolicyCommand}.
 */
export interface GetServingPolicyCommandInput extends GetServingPolicyInput {}
/**
 * @public
 *
 * The output of {@link GetServingPolicyCommand}.
 */
export interface GetServingPolicyCommandOutput extends ServingPolicy, __MetadataBearer {}

/**
 * Read stored and effective strict serving policy.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetServingPolicyCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetServingPolicyCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetServingPolicyInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetServingPolicyCommand(input);
 * const response = await client.send(command);
 * // { // ServingPolicy
 * //   strict: true || false, // required
 * //   deployment_override: true || false, // required
 * //   effective_strict: true || false, // required
 * // };
 *
 * ```
 *
 * @param GetServingPolicyCommandInput - {@link GetServingPolicyCommandInput}
 * @returns {@link GetServingPolicyCommandOutput}
 * @see {@link GetServingPolicyCommandInput} for command's `input` shape.
 * @see {@link GetServingPolicyCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
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
export class GetServingPolicyCommand extends $Command.classBuilder<GetServingPolicyCommandInput, GetServingPolicyCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "GetServingPolicy", {

  })
  .n("AirborneClient", "GetServingPolicyCommand")
  .f(void 0, void 0)
  .ser(se_GetServingPolicyCommand)
  .de(de_GetServingPolicyCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: GetServingPolicyInput;
      output: ServingPolicy;
  };
  sdk: {
      input: GetServingPolicyCommandInput;
      output: GetServingPolicyCommandOutput;
  };
};
}
