// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  DimensionResponse,
  UpdateDimensionRequest,
} from "../models/models_0";
import {
  de_UpdateDimensionCommand,
  se_UpdateDimensionCommand,
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
 * The input for {@link UpdateDimensionCommand}.
 */
export interface UpdateDimensionCommandInput extends UpdateDimensionRequest {}
/**
 * @public
 *
 * The output of {@link UpdateDimensionCommand}.
 */
export interface UpdateDimensionCommandOutput extends DimensionResponse, __MetadataBearer {}

/**
 * Update dimension request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdateDimensionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdateDimensionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdateDimensionRequest
 *   dimension: "STRING_VALUE", // required
 *   change_reason: "STRING_VALUE", // required
 *   position: Number("int"), // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UpdateDimensionCommand(input);
 * const response = await client.send(command);
 * // { // DimensionResponse
 * //   dimension: "STRING_VALUE", // required
 * //   description: "DOCUMENT_VALUE", // required
 * //   position: Number("int"), // required
 * //   schema: "DOCUMENT_VALUE",
 * //   change_reason: "STRING_VALUE", // required
 * //   mandatory: true || false,
 * // };
 *
 * ```
 *
 * @param UpdateDimensionCommandInput - {@link UpdateDimensionCommandInput}
 * @returns {@link UpdateDimensionCommandOutput}
 * @see {@link UpdateDimensionCommandInput} for command's `input` shape.
 * @see {@link UpdateDimensionCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export class UpdateDimensionCommand extends $Command.classBuilder<UpdateDimensionCommandInput, UpdateDimensionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "UpdateDimension", {

  })
  .n("AirborneClient", "UpdateDimensionCommand")
  .f(void 0, void 0)
  .ser(se_UpdateDimensionCommand)
  .de(de_UpdateDimensionCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: UpdateDimensionRequest;
      output: DimensionResponse;
  };
  sdk: {
      input: UpdateDimensionCommandInput;
      output: UpdateDimensionCommandOutput;
  };
};
}
