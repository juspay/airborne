import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateOrganisationRequest, Organisation } from "../models/models_0";
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
 * The input for {@link CreateOrganisationCommand}.
 */
export interface CreateOrganisationCommandInput extends CreateOrganisationRequest {
}
/**
 * @public
 *
 * The output of {@link CreateOrganisationCommand}.
 */
export interface CreateOrganisationCommandOutput extends Organisation, __MetadataBearer {
}
declare const CreateOrganisationCommand_base: {
    new (input: CreateOrganisationCommandInput): import("@smithy/smithy-client").CommandImpl<CreateOrganisationCommandInput, CreateOrganisationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateOrganisationCommandInput): import("@smithy/smithy-client").CommandImpl<CreateOrganisationCommandInput, CreateOrganisationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create organisation request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateOrganisationCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateOrganisationCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateOrganisationRequest
 *   name: "STRING_VALUE", // required
 * };
 * const command = new CreateOrganisationCommand(input);
 * const response = await client.send(command);
 * // { // Organisation
 * //   name: "STRING_VALUE", // required
 * //   applications: [ // Applications // required
 * //     { // Application
 * //       application: "STRING_VALUE", // required
 * //       organisation: "STRING_VALUE", // required
 * //       access: [ // StringList // required
 * //         "STRING_VALUE",
 * //       ],
 * //     },
 * //   ],
 * //   access: [ // required
 * //     "STRING_VALUE",
 * //   ],
 * // };
 *
 * ```
 *
 * @param CreateOrganisationCommandInput - {@link CreateOrganisationCommandInput}
 * @returns {@link CreateOrganisationCommandOutput}
 * @see {@link CreateOrganisationCommandInput} for command's `input` shape.
 * @see {@link CreateOrganisationCommandOutput} for command's `response` shape.
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
export declare class CreateOrganisationCommand extends CreateOrganisationCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateOrganisationRequest;
            output: Organisation;
        };
        sdk: {
            input: CreateOrganisationCommandInput;
            output: CreateOrganisationCommandOutput;
        };
    };
}
