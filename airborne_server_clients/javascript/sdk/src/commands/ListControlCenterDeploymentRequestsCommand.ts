// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ListControlCenterDeploymentRequestsInput,
  ListControlCenterDeploymentRequestsResponse,
} from "../models/models_0";
import {
  de_ListControlCenterDeploymentRequestsCommand,
  se_ListControlCenterDeploymentRequestsCommand,
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
 * The input for {@link ListControlCenterDeploymentRequestsCommand}.
 */
export interface ListControlCenterDeploymentRequestsCommandInput extends ListControlCenterDeploymentRequestsInput {}
/**
 * @public
 *
 * The output of {@link ListControlCenterDeploymentRequestsCommand}.
 */
export interface ListControlCenterDeploymentRequestsCommandOutput extends ListControlCenterDeploymentRequestsResponse, __MetadataBearer {}

/**
 * List the newest deployment requests. Status filtering precedes the 1,000-row cap. Omit x-application to list across the organisation, with per-application read filtering.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListControlCenterDeploymentRequestsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListControlCenterDeploymentRequestsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListControlCenterDeploymentRequestsInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE",
 *   status: "pending" || "executing" || "executed" || "failed" || "rejected" || "cancelled" || "expired" || "stale",
 * };
 * const command = new ListControlCenterDeploymentRequestsCommand(input);
 * const response = await client.send(command);
 * // { // ListControlCenterDeploymentRequestsResponse
 * //   requests: [ // ControlCenterDeploymentRequestList // required
 * //     { // ControlCenterDeploymentRequest
 * //       id: "STRING_VALUE", // required
 * //       org: "STRING_VALUE", // required
 * //       application: "STRING_VALUE", // required
 * //       action: "create" || "update" || "ramp" || "conclude" || "discard" || "rollback" || "set_strict_serving" || "set_rollback_sensitive", // required
 * //       payload: { // DeploymentRequestPayload
 * //         body: "DOCUMENT_VALUE",
 * //         release_id: "STRING_VALUE",
 * //         snapshot: "DOCUMENT_VALUE",
 * //       },
 * //       payload_hash: "STRING_VALUE", // required
 * //       base_state: "DOCUMENT_VALUE", // required
 * //       requester: "STRING_VALUE", // required
 * //       reason: "STRING_VALUE", // required
 * //       status: "pending" || "executing" || "executed" || "failed" || "rejected" || "cancelled" || "expired" || "stale", // required
 * //       expires_at: new Date("TIMESTAMP"), // required
 * //       decided_by: "DOCUMENT_VALUE", // required
 * //       decision_reason: "DOCUMENT_VALUE", // required
 * //       created_at: new Date("TIMESTAMP"), // required
 * //       updated_at: new Date("TIMESTAMP"), // required
 * //       result: "DOCUMENT_VALUE", // required
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListControlCenterDeploymentRequestsCommandInput - {@link ListControlCenterDeploymentRequestsCommandInput}
 * @returns {@link ListControlCenterDeploymentRequestsCommandOutput}
 * @see {@link ListControlCenterDeploymentRequestsCommandInput} for command's `input` shape.
 * @see {@link ListControlCenterDeploymentRequestsCommandOutput} for command's `response` shape.
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
export class ListControlCenterDeploymentRequestsCommand extends $Command.classBuilder<ListControlCenterDeploymentRequestsCommandInput, ListControlCenterDeploymentRequestsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListControlCenterDeploymentRequests", {

  })
  .n("AirborneClient", "ListControlCenterDeploymentRequestsCommand")
  .f(void 0, void 0)
  .ser(se_ListControlCenterDeploymentRequestsCommand)
  .de(de_ListControlCenterDeploymentRequestsCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ListControlCenterDeploymentRequestsInput;
      output: ListControlCenterDeploymentRequestsResponse;
  };
  sdk: {
      input: ListControlCenterDeploymentRequestsCommandInput;
      output: ListControlCenterDeploymentRequestsCommandOutput;
  };
};
}
