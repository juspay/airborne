// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CancelControlCenterDeploymentRequestInput,
  ControlCenterDeploymentRequest,
} from "../models/models_0";
import {
  de_CancelControlCenterDeploymentRequestCommand,
  se_CancelControlCenterDeploymentRequestCommand,
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
 * The input for {@link CancelControlCenterDeploymentRequestCommand}.
 */
export interface CancelControlCenterDeploymentRequestCommandInput extends CancelControlCenterDeploymentRequestInput {}
/**
 * @public
 *
 * The output of {@link CancelControlCenterDeploymentRequestCommand}.
 */
export interface CancelControlCenterDeploymentRequestCommandOutput extends ControlCenterDeploymentRequest, __MetadataBearer {}

/**
 * Cancel a request. Only its requester may cancel it.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CancelControlCenterDeploymentRequestCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CancelControlCenterDeploymentRequestCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CancelControlCenterDeploymentRequestInput
 *   id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   reason: "STRING_VALUE",
 * };
 * const command = new CancelControlCenterDeploymentRequestCommand(input);
 * const response = await client.send(command);
 * // { // ControlCenterDeploymentRequest
 * //   id: "STRING_VALUE", // required
 * //   org: "STRING_VALUE", // required
 * //   application: "STRING_VALUE", // required
 * //   action: "create" || "update" || "ramp" || "conclude" || "discard" || "rollback" || "set_strict_serving" || "set_rollback_sensitive", // required
 * //   payload: { // DeploymentRequestPayload
 * //     body: "DOCUMENT_VALUE",
 * //     release_id: "STRING_VALUE",
 * //     snapshot: "DOCUMENT_VALUE",
 * //   },
 * //   payload_hash: "STRING_VALUE", // required
 * //   base_state: "DOCUMENT_VALUE", // required
 * //   requester: "STRING_VALUE", // required
 * //   reason: "STRING_VALUE", // required
 * //   status: "pending" || "executing" || "executed" || "failed" || "rejected" || "cancelled" || "expired" || "stale", // required
 * //   expires_at: new Date("TIMESTAMP"), // required
 * //   decided_by: "DOCUMENT_VALUE", // required
 * //   decision_reason: "DOCUMENT_VALUE", // required
 * //   created_at: new Date("TIMESTAMP"), // required
 * //   updated_at: new Date("TIMESTAMP"), // required
 * //   result: "DOCUMENT_VALUE", // required
 * // };
 *
 * ```
 *
 * @param CancelControlCenterDeploymentRequestCommandInput - {@link CancelControlCenterDeploymentRequestCommandInput}
 * @returns {@link CancelControlCenterDeploymentRequestCommandOutput}
 * @see {@link CancelControlCenterDeploymentRequestCommandInput} for command's `input` shape.
 * @see {@link CancelControlCenterDeploymentRequestCommandOutput} for command's `response` shape.
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
export class CancelControlCenterDeploymentRequestCommand extends $Command.classBuilder<CancelControlCenterDeploymentRequestCommandInput, CancelControlCenterDeploymentRequestCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CancelControlCenterDeploymentRequest", {

  })
  .n("AirborneClient", "CancelControlCenterDeploymentRequestCommand")
  .f(void 0, void 0)
  .ser(se_CancelControlCenterDeploymentRequestCommand)
  .de(de_CancelControlCenterDeploymentRequestCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CancelControlCenterDeploymentRequestInput;
      output: ControlCenterDeploymentRequest;
  };
  sdk: {
      input: CancelControlCenterDeploymentRequestCommandInput;
      output: CancelControlCenterDeploymentRequestCommandOutput;
  };
};
}
