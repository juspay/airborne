import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { User } from "../models/models_0";
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
 * The input for {@link GetUserCommand}.
 */
export interface GetUserCommandInput {
}
/**
 * @public
 *
 * The output of {@link GetUserCommand}.
 */
export interface GetUserCommandOutput extends User, __MetadataBearer {
}
declare const GetUserCommand_base: {
    new (input: GetUserCommandInput): import("@smithy/smithy-client").CommandImpl<GetUserCommandInput, GetUserCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [GetUserCommandInput]): import("@smithy/smithy-client").CommandImpl<GetUserCommandInput, GetUserCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Get user request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetUserCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetUserCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = {};
 * const command = new GetUserCommand(input);
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
 * @param GetUserCommandInput - {@link GetUserCommandInput}
 * @returns {@link GetUserCommandOutput}
 * @see {@link GetUserCommandInput} for command's `input` shape.
 * @see {@link GetUserCommandOutput} for command's `response` shape.
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
export declare class GetUserCommand extends GetUserCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: {};
            output: User;
        };
        sdk: {
            input: GetUserCommandInput;
            output: GetUserCommandOutput;
        };
    };
}
