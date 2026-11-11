// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  TelemetryAccepted,
  TelemetryBatch,
} from "../models/models_0";
import {
  de_IngestTelemetryReportsCommand,
  se_IngestTelemetryReportsCommand,
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
 * The input for {@link IngestTelemetryReportsCommand}.
 */
export interface IngestTelemetryReportsCommandInput extends TelemetryBatch {}
/**
 * @public
 *
 * The output of {@link IngestTelemetryReportsCommand}.
 */
export interface IngestTelemetryReportsCommandOutput extends TelemetryAccepted, __MetadataBearer {}

/**
 * Optional unverified device reports. 400 drops invalid/expired receipts; 429 retries later; 503 means disabled/unavailable.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, IngestTelemetryReportsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, IngestTelemetryReportsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // TelemetryBatch
 *   receipt: "STRING_VALUE", // required
 *   install_id: "STRING_VALUE", // required
 *   events: [ // TelemetryEvents // required
 *     { // TelemetryEvent
 *       id: "STRING_VALUE", // required
 *       kind: "STRING_VALUE", // required
 *     },
 *   ],
 * };
 * const command = new IngestTelemetryReportsCommand(input);
 * const response = await client.send(command);
 * // { // TelemetryAccepted
 * //   accepted: true || false, // required
 * //   verification: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param IngestTelemetryReportsCommandInput - {@link IngestTelemetryReportsCommandInput}
 * @returns {@link IngestTelemetryReportsCommandOutput}
 * @see {@link IngestTelemetryReportsCommandInput} for command's `input` shape.
 * @see {@link IngestTelemetryReportsCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link TooManyRequestsError} (client fault)
 *
 * @throws {@link ServiceUnavailableError} (server fault)
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
export class IngestTelemetryReportsCommand extends $Command.classBuilder<IngestTelemetryReportsCommandInput, IngestTelemetryReportsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "IngestTelemetryReports", {

  })
  .n("AirborneClient", "IngestTelemetryReportsCommand")
  .f(void 0, void 0)
  .ser(se_IngestTelemetryReportsCommand)
  .de(de_IngestTelemetryReportsCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: TelemetryBatch;
      output: TelemetryAccepted;
  };
  sdk: {
      input: IngestTelemetryReportsCommandInput;
      output: IngestTelemetryReportsCommandOutput;
  };
};
}
