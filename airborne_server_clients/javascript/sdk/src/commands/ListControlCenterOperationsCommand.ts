// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  ListControlCenterOperationsInput,
  ListControlCenterOperationsResponse,
} from "../models/models_0";
import {
  de_ListControlCenterOperationsCommand,
  se_ListControlCenterOperationsCommand,
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
 * The input for {@link ListControlCenterOperationsCommand}.
 */
export interface ListControlCenterOperationsCommandInput extends ListControlCenterOperationsInput {}
/**
 * @public
 *
 * The output of {@link ListControlCenterOperationsCommand}.
 */
export interface ListControlCenterOperationsCommandOutput extends ListControlCenterOperationsResponse, __MetadataBearer {}

/**
 * List unresolved upstream write outcomes for an application. Requires Bearer authentication, scope headers, and release read access.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, ListControlCenterOperationsCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, ListControlCenterOperationsCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // ListControlCenterOperationsInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 *   status: "STRING_VALUE",
 * };
 * const command = new ListControlCenterOperationsCommand(input);
 * const response = await client.send(command);
 * // { // ListControlCenterOperationsResponse
 * //   operations: [ // ControlCenterUnresolvedOperationDetailsList // required
 * //     { // ControlCenterUnresolvedOperationDetails
 * //       code: "STRING_VALUE", // required
 * //       operation_id: "STRING_VALUE", // required
 * //       message: "STRING_VALUE", // required
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListControlCenterOperationsCommandInput - {@link ListControlCenterOperationsCommandInput}
 * @returns {@link ListControlCenterOperationsCommandOutput}
 * @see {@link ListControlCenterOperationsCommandInput} for command's `input` shape.
 * @see {@link ListControlCenterOperationsCommandOutput} for command's `response` shape.
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
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export class ListControlCenterOperationsCommand extends $Command.classBuilder<ListControlCenterOperationsCommandInput, ListControlCenterOperationsCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "ListControlCenterOperations", {

  })
  .n("AirborneClient", "ListControlCenterOperationsCommand")
  .f(void 0, void 0)
  .ser(se_ListControlCenterOperationsCommand)
  .de(de_ListControlCenterOperationsCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: ListControlCenterOperationsInput;
      output: ListControlCenterOperationsResponse;
  };
  sdk: {
      input: ListControlCenterOperationsCommandInput;
      output: ListControlCenterOperationsCommandOutput;
  };
};
}
