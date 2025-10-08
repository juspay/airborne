// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  Application,
  CreateApplicationRequest,
} from "../models/models_0";
import {
  de_CreateApplicationCommand,
  se_CreateApplicationCommand,
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
 * The input for {@link CreateApplicationCommand}.
 */
export interface CreateApplicationCommandInput extends CreateApplicationRequest {}
/**
 * @public
 *
 * The output of {@link CreateApplicationCommand}.
 */
export interface CreateApplicationCommandOutput extends Application, __MetadataBearer {}

/**
 * Create application request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateApplicationCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateApplicationCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateApplicationRequest
 *   application: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 * };
 * const command = new CreateApplicationCommand(input);
 * const response = await client.send(command);
 * // { // Application
 * //   application: "STRING_VALUE", // required
 * //   organisation: "STRING_VALUE", // required
 * //   access: [ // StringList // required
 * //     "STRING_VALUE",
 * //   ],
 * // };
 *
 * ```
 *
 * @param CreateApplicationCommandInput - {@link CreateApplicationCommandInput}
 * @returns {@link CreateApplicationCommandOutput}
 * @see {@link CreateApplicationCommandInput} for command's `input` shape.
 * @see {@link CreateApplicationCommandOutput} for command's `response` shape.
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
export class CreateApplicationCommand extends $Command.classBuilder<CreateApplicationCommandInput, CreateApplicationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "CreateApplication", {

  })
  .n("AirborneClient", "CreateApplicationCommand")
  .f(void 0, void 0)
  .ser(se_CreateApplicationCommand)
  .de(de_CreateApplicationCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: CreateApplicationRequest;
      output: Application;
  };
  sdk: {
      input: CreateApplicationCommandInput;
      output: CreateApplicationCommandOutput;
  };
};
}
