// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  CreateCohortRangeInput,
  CreateCohortRangeOutput,
} from "../models/models_0";
import {
  de_CreateCohortRangeCommand,
  se_CreateCohortRangeCommand,
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
 * The input for {@link CreateCohortRangeCommand}.
 */
export interface CreateCohortRangeCommandInput extends CreateCohortRangeInput {}
/**
 * @public
 *
 * The output of {@link CreateCohortRangeCommand}.
 */
export interface CreateCohortRangeCommandOutput extends CreateCohortRangeOutput, __MetadataBearer {}

/**
 * Add an independent inclusive stable major.minor.patch semantic version interval. Prerelease and build metadata bounds return 400 because upstream comparators do not support their precedence. Earlier definitions are unchanged. Enum index zero wins overlaps. Does not alter checkpoint semantics. Requires cohort update permission; unavailable while maker-checker is enabled, like other targeting edits.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateCohortRangeCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateCohortRangeCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateCohortRangeInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   dimension: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   lower: "STRING_VALUE", // required
 *   upper: "STRING_VALUE", // required
 *   priority: Number("int"), // required
 * };
 * const command = new CreateCohortRangeCommand(input);
 * const response = await client.send(command);
 * // { // CreateCohortRangeOutput
 * //   name: "STRING_VALUE", // required
 * //   lower: "STRING_VALUE", // required
 * //   upper: "STRING_VALUE", // required
 * //   priority: Number("int"), // required
 * // };
 *
 * ```
 *
 * @param CreateCohortRangeCommandInput - {@link CreateCohortRangeCommandInput}
 * @returns {@link CreateCohortRangeCommandOutput}
 * @see {@link CreateCohortRangeCommandInput} for command's `input` shape.
 * @see {@link CreateCohortRangeCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
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
export class CreateCohortRangeCommand extends $Command.classBuilder<CreateCohortRangeCommandInput, CreateCohortRangeCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateCohortRange", {

  })
  .n("AirborneClient", "CreateCohortRangeCommand")
  .f(void 0, void 0)
  .ser(se_CreateCohortRangeCommand)
  .de(de_CreateCohortRangeCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateCohortRangeInput;
      output: CreateCohortRangeOutput;
  };
  sdk: {
      input: CreateCohortRangeCommandInput;
      output: CreateCohortRangeCommandOutput;
  };
};
}
