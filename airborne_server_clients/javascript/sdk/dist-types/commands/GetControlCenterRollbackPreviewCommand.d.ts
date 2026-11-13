import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { RollbackPreviewInput, RollbackPreviewResponse } from "../models/models_0";
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
 * The input for {@link GetControlCenterRollbackPreviewCommand}.
 */
export interface GetControlCenterRollbackPreviewCommandInput extends RollbackPreviewInput {
}
/**
 * @public
 *
 * The output of {@link GetControlCenterRollbackPreviewCommand}.
 */
export interface GetControlCenterRollbackPreviewCommandOutput extends RollbackPreviewResponse, __MetadataBearer {
}
declare const GetControlCenterRollbackPreviewCommand_base: {
    new (input: GetControlCenterRollbackPreviewCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterRollbackPreviewCommandInput, GetControlCenterRollbackPreviewCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetControlCenterRollbackPreviewCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterRollbackPreviewCommandInput, GetControlCenterRollbackPreviewCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Compute the rollback decision and package/config reconciliation without persisting an operation or changing upstream, audit, journal, or cache state. Requires release read permission and organisation/application scope headers.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetControlCenterRollbackPreviewCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetControlCenterRollbackPreviewCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // RollbackPreviewInput
 *   release_id: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetControlCenterRollbackPreviewCommand(input);
 * const response = await client.send(command);
 * // { // RollbackPreviewResponse
 * //   action: "DOCUMENT_VALUE", // required
 * //   current_package_version: "DOCUMENT_VALUE", // required
 * //   resulting_package_version: "DOCUMENT_VALUE", // required
 * //   reconciled_keys: "DOCUMENT_VALUE", // required
 * //   blocked: "DOCUMENT_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetControlCenterRollbackPreviewCommandInput - {@link GetControlCenterRollbackPreviewCommandInput}
 * @returns {@link GetControlCenterRollbackPreviewCommandOutput}
 * @see {@link GetControlCenterRollbackPreviewCommandInput} for command's `input` shape.
 * @see {@link GetControlCenterRollbackPreviewCommandOutput} for command's `response` shape.
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
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class GetControlCenterRollbackPreviewCommand extends GetControlCenterRollbackPreviewCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: RollbackPreviewInput;
            output: RollbackPreviewResponse;
        };
        sdk: {
            input: GetControlCenterRollbackPreviewCommandInput;
            output: GetControlCenterRollbackPreviewCommandOutput;
        };
    };
}
