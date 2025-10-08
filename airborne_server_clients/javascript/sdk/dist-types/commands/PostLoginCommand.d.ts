import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { User, UserCredentials } from "../models/models_0";
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
export interface PostLoginCommandInput extends UserCredentials {
}
/**
 * @public
 *
 * The output of {@link PostLoginCommand}.
 */
export interface PostLoginCommandOutput extends User, __MetadataBearer {
}
declare const PostLoginCommand_base: {
    new (input: PostLoginCommandInput): import("@smithy/smithy-client").CommandImpl<PostLoginCommandInput, PostLoginCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: PostLoginCommandInput): import("@smithy/smithy-client").CommandImpl<PostLoginCommandInput, PostLoginCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
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
 * // { // User
 * //   user_id: "STRING_VALUE", // required
 * //   organisations: [ // Organisations // required
 * //     { // Organisation
 * //       name: "STRING_VALUE", // required
 * //       applications: [ // Applications // required
 * //         { // Application
 * //           application: "STRING_VALUE", // required
 * //           organisation: "STRING_VALUE", // required
 * //           access: [ // StringList // required
 * //             "STRING_VALUE",
 * //           ],
 * //         },
 * //       ],
 * //       access: [ // required
 * //         "STRING_VALUE",
 * //       ],
 * //     },
 * //   ],
 * //   user_token: { // UserToken
 * //     access_token: "STRING_VALUE", // required
 * //     token_type: "STRING_VALUE", // required
 * //     expires_in: Number("long"), // required
 * //     refresh_token: "STRING_VALUE", // required
 * //     refresh_expires_in: Number("long"), // required
 * //   },
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
export declare class PostLoginCommand extends PostLoginCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UserCredentials;
            output: User;
        };
        sdk: {
            input: PostLoginCommandInput;
            output: PostLoginCommandOutput;
        };
    };
}
