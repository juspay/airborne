// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  RampReleaseInput,
  RampReleaseResponse,
} from "../models/models_0";
import {
  de_RampReleaseCommand,
  se_RampReleaseCommand,
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
 * The input for {@link RampReleaseCommand}.
 */
export interface RampReleaseCommandInput extends RampReleaseInput {}
/**
 * @public
 *
 * The output of {@link RampReleaseCommand}.
 */
export interface RampReleaseCommandOutput extends RampReleaseResponse, __MetadataBearer {}

/**
 * Set the share of traffic that receives a release. A release starts at 0% and is not served until it is ramped; the first ramp moves it from created to in progress, and later ramps raise or lower the share. Pass the organisation and application in the x-organisation and x-application headers. Unknown release ids return 404. Values outside 0–50 return 400 before any write is attempted. Explicit upstream 400 and 422 validation rejections for ramps are recorded as not applied and do not pause writes for the application; other uncertain outcomes return 409 with code "unresolved" and own_attempt true, so inspect the real state before retrying and never repeat a committed ramp merely to clear a cache failure. Returns 409 when the release has already concluded or been discarded, and 409 with code "unresolved" when an earlier upstream write for the application still needs recovery; an organisation admin can resolve that operation with ResolveControlCenterOperation. When the application requires approvals, raising traffic (or any ramp of a rollback-sensitive release) is refused with 403 "approval_required"; raise a deployment request instead. Requires a bearer token and release ramp permission.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, RampReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, RampReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // RampReleaseInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   traffic_percentage: Number("int"), // required
 *   change_reason: "STRING_VALUE",
 * };
 * const command = new RampReleaseCommand(input);
 * const response = await client.send(command);
 * // { // RampReleaseResponse
 * //   success: true || false, // required
 * //   message: "STRING_VALUE", // required
 * //   experiment_id: "STRING_VALUE", // required
 * //   traffic_percentage: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param RampReleaseCommandInput - {@link RampReleaseCommandInput}
 * @returns {@link RampReleaseCommandOutput}
 * @see {@link RampReleaseCommandInput} for command's `input` shape.
 * @see {@link RampReleaseCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link ConflictError} (client fault)
 *  Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link UnresolvedOperationError} (client fault)
 *  A write has an unknown upstream outcome. Inspect its real state and change history before resolving it; elapsed time alone does not establish rejection. An upstream 4xx is not proof that nothing was written, because the upstream handler can return it after configuration effects. While the operation is unresolved, writes for the application stay paused. When the 409 comes from a recovery attempt it can name the config keys or contexts that changed and must be restored, or finished and resolved as applied.
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
export class RampReleaseCommand extends $Command.classBuilder<RampReleaseCommandInput, RampReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "RampRelease", {

  })
  .n("AirborneClient", "RampReleaseCommand")
  .f(void 0, void 0)
  .ser(se_RampReleaseCommand)
  .de(de_RampReleaseCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: RampReleaseInput;
      output: RampReleaseResponse;
  };
  sdk: {
      input: RampReleaseCommandInput;
      output: RampReleaseCommandOutput;
  };
};
}
