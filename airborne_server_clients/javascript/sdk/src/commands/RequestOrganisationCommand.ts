// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  RequestOrganisationRequest,
  RequestOrganisationResponse,
} from "../models/models_0";
import {
  de_RequestOrganisationCommand,
  se_RequestOrganisationCommand,
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
 * The input for {@link RequestOrganisationCommand}.
 */
export interface RequestOrganisationCommandInput extends RequestOrganisationRequest {}
/**
 * @public
 *
 * The output of {@link RequestOrganisationCommand}.
 */
export interface RequestOrganisationCommandOutput extends RequestOrganisationResponse, __MetadataBearer {}

/**
 * Request organisation request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, RequestOrganisationCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, RequestOrganisationCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // RequestOrganisationRequest
 *   organisation_name: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   email: "STRING_VALUE", // required
 *   phone: "STRING_VALUE", // required
 *   app_store_link: "STRING_VALUE", // required
 *   play_store_link: "STRING_VALUE", // required
 * };
 * const command = new RequestOrganisationCommand(input);
 * const response = await client.send(command);
 * // { // RequestOrganisationResponse
 * //   organisation_name: "STRING_VALUE", // required
 * //   message: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param RequestOrganisationCommandInput - {@link RequestOrganisationCommandInput}
 * @returns {@link RequestOrganisationCommandOutput}
 * @see {@link RequestOrganisationCommandInput} for command's `input` shape.
 * @see {@link RequestOrganisationCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
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
export class RequestOrganisationCommand extends $Command.classBuilder<RequestOrganisationCommandInput, RequestOrganisationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "RequestOrganisation", {

  })
  .n("AirborneClient", "RequestOrganisationCommand")
  .f(void 0, void 0)
  .ser(se_RequestOrganisationCommand)
  .de(de_RequestOrganisationCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: RequestOrganisationRequest;
      output: RequestOrganisationResponse;
  };
  sdk: {
      input: RequestOrganisationCommandInput;
      output: RequestOrganisationCommandOutput;
  };
};
}
