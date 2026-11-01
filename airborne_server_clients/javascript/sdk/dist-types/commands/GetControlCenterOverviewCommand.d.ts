import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { GetControlCenterOverviewInput, GetControlCenterOverviewResponse } from "../models/models_0";
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
 * The input for {@link GetControlCenterOverviewCommand}.
 */
export interface GetControlCenterOverviewCommandInput extends GetControlCenterOverviewInput {
}
/**
 * @public
 *
 * The output of {@link GetControlCenterOverviewCommand}.
 */
export interface GetControlCenterOverviewCommandOutput extends GetControlCenterOverviewResponse, __MetadataBearer {
}
declare const GetControlCenterOverviewCommand_base: {
    new (input: GetControlCenterOverviewCommandInput): import("@smithy/smithy-client").CommandImpl<GetControlCenterOverviewCommandInput, GetControlCenterOverviewCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [GetControlCenterOverviewCommandInput]): import("@smithy/smithy-client").CommandImpl<GetControlCenterOverviewCommandInput, GetControlCenterOverviewCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Return the authenticated user's release overview across accessible organisations and applications. No x-organisation or x-application header is required.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetControlCenterOverviewCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetControlCenterOverviewCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = {};
 * const command = new GetControlCenterOverviewCommand(input);
 * const response = await client.send(command);
 * // { // GetControlCenterOverviewResponse
 * //   generated_at: new Date("TIMESTAMP"), // required
 * //   organisations: [ // ControlCenterOrganisationOverviewList // required
 * //     { // ControlCenterOrganisationOverview
 * //       name: "STRING_VALUE", // required
 * //       groups: [ // ControlCenterOverviewGroupList // required
 * //         { // ControlCenterOverviewGroup
 * //           id: "STRING_VALUE", // required
 * //           name: "STRING_VALUE", // required
 * //           members: [ // ControlCenterAppStatusList // required
 * //             { // ControlCenterAppStatus
 * //               application: "STRING_VALUE", // required
 * //               platform: "DOCUMENT_VALUE", // required
 * //               live: [ // ControlCenterLiveReleaseList // required
 * //                 { // ControlCenterLiveRelease
 * //                   release_id: "STRING_VALUE", // required
 * //                   package_version: Number("long"), // required
 * //                   config_version: "STRING_VALUE", // required
 * //                   dimensions: "DOCUMENT_VALUE", // required
 * //                   concluded_at: new Date("TIMESTAMP"), // required
 * //                 },
 * //               ],
 * //               active: [ // ControlCenterActiveReleaseList // required
 * //                 { // ControlCenterActiveRelease
 * //                   release_id: "STRING_VALUE", // required
 * //                   package_version: Number("long"), // required
 * //                   status: "STRING_VALUE", // required
 * //                   traffic_percentage: Number("int"), // required
 * //                   experimental_variant: "STRING_VALUE", // required
 * //                   dimensions: "DOCUMENT_VALUE", // required
 * //                   created_at: new Date("TIMESTAMP"), // required
 * //                   created_by: "STRING_VALUE", // required
 * //                 },
 * //               ],
 * //               unresolved_operations: [ // ControlCenterUnresolvedOperationList // required
 * //                 { // ControlCenterUnresolvedOperation
 * //                   operation_id: "STRING_VALUE", // required
 * //                   message: "STRING_VALUE", // required
 * //                   expected: "DOCUMENT_VALUE", // required
 * //                   before: "DOCUMENT_VALUE", // required
 * //                   upstream_workspace: "DOCUMENT_VALUE", // required
 * //                 },
 * //               ],
 * //               last_activity_at: "DOCUMENT_VALUE", // required
 * //               error: "DOCUMENT_VALUE", // required
 * //             },
 * //           ],
 * //         },
 * //       ],
 * //       ungrouped: [ // required
 * //         {
 * //           application: "STRING_VALUE", // required
 * //           platform: "DOCUMENT_VALUE", // required
 * //           live: [ // required
 * //             {
 * //               release_id: "STRING_VALUE", // required
 * //               package_version: Number("long"), // required
 * //               config_version: "STRING_VALUE", // required
 * //               dimensions: "DOCUMENT_VALUE", // required
 * //               concluded_at: new Date("TIMESTAMP"), // required
 * //             },
 * //           ],
 * //           active: [ // required
 * //             {
 * //               release_id: "STRING_VALUE", // required
 * //               package_version: Number("long"), // required
 * //               status: "STRING_VALUE", // required
 * //               traffic_percentage: Number("int"), // required
 * //               experimental_variant: "STRING_VALUE", // required
 * //               dimensions: "DOCUMENT_VALUE", // required
 * //               created_at: new Date("TIMESTAMP"), // required
 * //               created_by: "STRING_VALUE", // required
 * //             },
 * //           ],
 * //           unresolved_operations: [ // required
 * //             {
 * //               operation_id: "STRING_VALUE", // required
 * //               message: "STRING_VALUE", // required
 * //               expected: "DOCUMENT_VALUE", // required
 * //               before: "DOCUMENT_VALUE", // required
 * //               upstream_workspace: "DOCUMENT_VALUE", // required
 * //             },
 * //           ],
 * //           last_activity_at: "DOCUMENT_VALUE", // required
 * //           error: "DOCUMENT_VALUE", // required
 * //         },
 * //       ],
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param GetControlCenterOverviewCommandInput - {@link GetControlCenterOverviewCommandInput}
 * @returns {@link GetControlCenterOverviewCommandOutput}
 * @see {@link GetControlCenterOverviewCommandInput} for command's `input` shape.
 * @see {@link GetControlCenterOverviewCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class GetControlCenterOverviewCommand extends GetControlCenterOverviewCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: {};
            output: GetControlCenterOverviewResponse;
        };
        sdk: {
            input: GetControlCenterOverviewCommandInput;
            output: GetControlCenterOverviewCommandOutput;
        };
    };
}
