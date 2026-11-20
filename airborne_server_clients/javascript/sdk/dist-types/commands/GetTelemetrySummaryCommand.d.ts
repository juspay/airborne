import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { TelemetrySummary, TelemetrySummaryInput } from "../models/models_0";
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
 * The input for {@link GetTelemetrySummaryCommand}.
 */
export interface GetTelemetrySummaryCommandInput extends TelemetrySummaryInput {
}
/**
 * @public
 *
 * The output of {@link GetTelemetrySummaryCommand}.
 */
export interface GetTelemetrySummaryCommandOutput extends TelemetrySummary, __MetadataBearer {
}
declare const GetTelemetrySummaryCommand_base: {
    new (input: GetTelemetrySummaryCommandInput): import("@smithy/smithy-client").CommandImpl<GetTelemetrySummaryCommandInput, GetTelemetrySummaryCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetTelemetrySummaryCommandInput): import("@smithy/smithy-client").CommandImpl<GetTelemetrySummaryCommandInput, GetTelemetrySummaryCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * @public
 *
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetTelemetrySummaryCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetTelemetrySummaryCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // TelemetrySummaryInput
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetTelemetrySummaryCommand(input);
 * const response = await client.send(command);
 * // { // TelemetrySummary
 * //   window_days: Number("int"),
 * //   verification: "STRING_VALUE",
 * //   automatic_action: "STRING_VALUE",
 * //   adoption_definition: "STRING_VALUE",
 * //   releases: "DOCUMENT_VALUE",
 * //   release_totals: "DOCUMENT_VALUE",
 * //   blocked_package_versions: "DOCUMENT_VALUE",
 * // };
 *
 * ```
 *
 * @param GetTelemetrySummaryCommandInput - {@link GetTelemetrySummaryCommandInput}
 * @returns {@link GetTelemetrySummaryCommandOutput}
 * @see {@link GetTelemetrySummaryCommandInput} for command's `input` shape.
 * @see {@link GetTelemetrySummaryCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 */
export declare class GetTelemetrySummaryCommand extends GetTelemetrySummaryCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: TelemetrySummaryInput;
            output: TelemetrySummary;
        };
        sdk: {
            input: GetTelemetrySummaryCommandInput;
            output: GetTelemetrySummaryCommandOutput;
        };
    };
}
