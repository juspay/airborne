// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import { DeleteDimensionRequest } from "../models/models_0";
import {
  de_DeleteDimensionCommand,
  se_DeleteDimensionCommand,
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
 * The input for {@link DeleteDimensionCommand}.
 */
export interface DeleteDimensionCommandInput extends DeleteDimensionRequest {}
/**
 * @public
 *
 * The output of {@link DeleteDimensionCommand}.
 */
export interface DeleteDimensionCommandOutput extends __MetadataBearer {}

/**
 * Delete dimension request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, DeleteDimensionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, DeleteDimensionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // DeleteDimensionRequest
 *   dimension: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new DeleteDimensionCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param DeleteDimensionCommandInput - {@link DeleteDimensionCommandInput}
 * @returns {@link DeleteDimensionCommandOutput}
 * @see {@link DeleteDimensionCommandInput} for command's `input` shape.
 * @see {@link DeleteDimensionCommandOutput} for command's `response` shape.
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
export class DeleteDimensionCommand extends $Command.classBuilder<DeleteDimensionCommandInput, DeleteDimensionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "DeleteDimension", {

  })
  .n("AirborneClient", "DeleteDimensionCommand")
  .f(void 0, void 0)
  .ser(se_DeleteDimensionCommand)
  .de(de_DeleteDimensionCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: DeleteDimensionRequest;
      output: {};
  };
  sdk: {
      input: DeleteDimensionCommandInput;
      output: DeleteDimensionCommandOutput;
  };
};
}
