import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { RequestOrganisationRequest, RequestOrganisationResponse } from "../models/models_0";
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
export interface RequestOrganisationCommandInput extends RequestOrganisationRequest {
}
/**
 * @public
 *
 * The output of {@link RequestOrganisationCommand}.
 */
export interface RequestOrganisationCommandOutput extends RequestOrganisationResponse, __MetadataBearer {
}
declare const RequestOrganisationCommand_base: {
    new (input: RequestOrganisationCommandInput): import("@smithy/smithy-client").CommandImpl<RequestOrganisationCommandInput, RequestOrganisationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: RequestOrganisationCommandInput): import("@smithy/smithy-client").CommandImpl<RequestOrganisationCommandInput, RequestOrganisationCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
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
export declare class RequestOrganisationCommand extends RequestOrganisationCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
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
