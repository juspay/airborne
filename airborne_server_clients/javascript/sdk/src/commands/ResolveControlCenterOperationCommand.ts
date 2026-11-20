// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ResolveControlCenterOperationInput,
  ResolveControlCenterOperationResponse,
} from "../models/models_0";
import {
  de_ResolveControlCenterOperationCommand,
  se_ResolveControlCenterOperationCommand,
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
 * The input for {@link ResolveControlCenterOperationCommand}.
 */
export interface ResolveControlCenterOperationCommandInput extends ResolveControlCenterOperationInput {}
/**
 * @public
 *
 * The output of {@link ResolveControlCenterOperationCommand}.
 */
export interface ResolveControlCenterOperationCommandOutput extends ResolveControlCenterOperationResponse, __MetadataBearer {}

/**
 * Resolve an unresolved operation after upstream verification. Only organisation owners/admins or super admins may recover. applied needs positive evidence of the expected change, matched through the operation's generated marker in current upstream state or its audit history. did_not_apply needs the experiment and the application's workspace configuration (defaults, contexts, overrides) to be unchanged from the values saved before the write, plus the operator's confirmation that the original request has terminated. A 409 names the changed config keys or contexts: restore them, or finish the intended change and resolve as applied. Operations created before this evidence was saved cannot be resolved as did_not_apply. The reason must not contain the reserved text `Airborne operation`. Markers are not authenticated provenance: anyone who can write to Superposition directly can forge one, so restrict direct upstream write access to trusted operators.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ResolveControlCenterOperationCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ResolveControlCenterOperationCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ResolveControlCenterOperationInput
 *   id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   finding: "did_not_apply" || "applied", // required
 *   reason: "STRING_VALUE", // required
 *   request_terminated: true || false,
 * };
 * const command = new ResolveControlCenterOperationCommand(input);
 * const response = await client.send(command);
 * // { // ResolveControlCenterOperationResponse
 * //   operation_id: "STRING_VALUE", // required
 * //   state: "confirmed" || "rejected", // required
 * //   finding: "did_not_apply" || "applied", // required
 * // };
 *
 * ```
 *
 * @param ResolveControlCenterOperationCommandInput - {@link ResolveControlCenterOperationCommandInput}
 * @returns {@link ResolveControlCenterOperationCommandOutput}
 * @see {@link ResolveControlCenterOperationCommandInput} for command's `input` shape.
 * @see {@link ResolveControlCenterOperationCommandOutput} for command's `response` shape.
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
export class ResolveControlCenterOperationCommand extends $Command.classBuilder<ResolveControlCenterOperationCommandInput, ResolveControlCenterOperationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ResolveControlCenterOperation", {

  })
  .n("AirborneClient", "ResolveControlCenterOperationCommand")
  .f(void 0, void 0)
  .ser(se_ResolveControlCenterOperationCommand)
  .de(de_ResolveControlCenterOperationCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ResolveControlCenterOperationInput;
      output: ResolveControlCenterOperationResponse;
  };
  sdk: {
      input: ResolveControlCenterOperationCommandInput;
      output: ResolveControlCenterOperationCommandOutput;
  };
};
}
