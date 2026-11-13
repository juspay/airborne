// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  PreviewServingPolicyInput,
  ServingPreviewOutput,
} from "../models/models_0";
import {
  de_PreviewServingPolicyCommand,
  se_PreviewServingPolicyCommand,
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
 * The input for {@link PreviewServingPolicyCommand}.
 */
export interface PreviewServingPolicyCommandInput extends PreviewServingPolicyInput {}
/**
 * @public
 *
 * The output of {@link PreviewServingPolicyCommand}.
 */
export interface PreviewServingPolicyCommandOutput extends ServingPreviewOutput, __MetadataBearer {}

/**
 * Read-only evaluation of one context and toss. Returns whether enabling strict serving removes default fallback; this is not a population-wide impact count.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, PreviewServingPolicyCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, PreviewServingPolicyCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // PreviewServingPolicyInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   context: { // ServingPreviewContext // required
 *     "<keys>": "STRING_VALUE",
 *   },
 *   toss: "STRING_VALUE", // required
 * };
 * const command = new PreviewServingPolicyCommand(input);
 * const response = await client.send(command);
 * // { // ServingPreviewOutput
 * //   serving_policy: { // ServingPolicy
 * //     strict: true || false, // required
 * //     deployment_override: true || false, // required
 * //     effective_strict: true || false, // required
 * //   },
 * //   context: { // ServingPreviewContext // required
 * //     "<keys>": "STRING_VALUE",
 * //   },
 * //   toss: "STRING_VALUE", // required
 * //   config_version: "STRING_VALUE",
 * //   package_version: "DOCUMENT_VALUE",
 * //   targeted: true || false, // required
 * //   would_stop_serving: true || false, // required
 * //   strict_status: Number("int"), // required
 * //   scope: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param PreviewServingPolicyCommandInput - {@link PreviewServingPolicyCommandInput}
 * @returns {@link PreviewServingPolicyCommandOutput}
 * @see {@link PreviewServingPolicyCommandInput} for command's `input` shape.
 * @see {@link PreviewServingPolicyCommandOutput} for command's `response` shape.
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
export class PreviewServingPolicyCommand extends $Command.classBuilder<PreviewServingPolicyCommandInput, PreviewServingPolicyCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "PreviewServingPolicy", {

  })
  .n("AirborneClient", "PreviewServingPolicyCommand")
  .f(void 0, void 0)
  .ser(se_PreviewServingPolicyCommand)
  .de(de_PreviewServingPolicyCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: PreviewServingPolicyInput;
      output: ServingPreviewOutput;
  };
  sdk: {
      input: PreviewServingPolicyCommandInput;
      output: PreviewServingPolicyCommandOutput;
  };
};
}
