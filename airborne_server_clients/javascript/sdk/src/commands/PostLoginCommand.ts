// smithy-typescript generated code
import {
  AirborneClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../AirborneClient";
import {
  UserCredentials,
  UserToken,
} from "../models/models_0";
import {
  de_PostLoginCommand,
  se_PostLoginCommand,
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
 * The input for {@link PostLoginCommand}.
 */
export interface PostLoginCommandInput extends UserCredentials {}
/**
 * @public
 *
 * The output of {@link PostLoginCommand}.
 */
export interface PostLoginCommandOutput extends UserToken, __MetadataBearer {}

/**
 * Login request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, PostLoginCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, PostLoginCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UserCredentials
 *   client_id: "STRING_VALUE", // required
 *   client_secret: "STRING_VALUE", // required
 * };
 * const command = new PostLoginCommand(input);
 * const response = await client.send(command);
 * // { // UserToken
 * //   access_token: "STRING_VALUE", // required
 * //   token_type: "STRING_VALUE", // required
 * //   expires_in: Number("long"), // required
 * //   refresh_token: "STRING_VALUE", // required
 * //   refresh_expires_in: Number("long"), // required
 * // };
 *
 * ```
 *
 * @param PostLoginCommandInput - {@link PostLoginCommandInput}
 * @returns {@link PostLoginCommandOutput}
 * @see {@link PostLoginCommandInput} for command's `input` shape.
 * @see {@link PostLoginCommandOutput} for command's `response` shape.
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
export class PostLoginCommand extends $Command.classBuilder<PostLoginCommandInput, PostLoginCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>()
      .m(function (this: any, Command: any, cs: any, config: AirborneClientResolvedConfig, o: any) {
          return [

  getSerdePlugin(config, this.serialize, this.deserialize),
      ];
  })
  .s("Airborne", "PostLogin", {

  })
  .n("AirborneClient", "PostLoginCommand")
  .f(void 0, void 0)
  .ser(se_PostLoginCommand)
  .de(de_PostLoginCommand)
.build() {
/** @internal type navigation helper, not in runtime. */
declare protected static __types: {
  api: {
      input: UserCredentials;
      output: UserToken;
  };
  sdk: {
      input: PostLoginCommandInput;
      output: PostLoginCommandOutput;
  };
};
}
