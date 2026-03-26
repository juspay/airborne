import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { GetPackageV2ByTagRequest, PackageV2 } from "../models/models_0";
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
 * The input for {@link GetPackageV2ByTagCommand}.
 */
export interface GetPackageV2ByTagCommandInput extends GetPackageV2ByTagRequest {
}
/**
 * @public
 *
 * The output of {@link GetPackageV2ByTagCommand}.
 */
export interface GetPackageV2ByTagCommandOutput extends PackageV2, __MetadataBearer {
}
declare const GetPackageV2ByTagCommand_base: {
    new (input: GetPackageV2ByTagCommandInput): import("@smithy/smithy-client").CommandImpl<GetPackageV2ByTagCommandInput, GetPackageV2ByTagCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetPackageV2ByTagCommandInput): import("@smithy/smithy-client").CommandImpl<GetPackageV2ByTagCommandInput, GetPackageV2ByTagCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Get a package by tag within a package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetPackageV2ByTagCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetPackageV2ByTagCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetPackageV2ByTagRequest
 *   groupId: "STRING_VALUE", // required
 *   tag: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetPackageV2ByTagCommand(input);
 * const response = await client.send(command);
 * // { // PackageV2
 * //   index: "STRING_VALUE",
 * //   tag: "STRING_VALUE",
 * //   version: Number("int"), // required
 * //   files: [ // StringList // required
 * //     "STRING_VALUE",
 * //   ],
 * //   package_group_id: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetPackageV2ByTagCommandInput - {@link GetPackageV2ByTagCommandInput}
 * @returns {@link GetPackageV2ByTagCommandOutput}
 * @see {@link GetPackageV2ByTagCommandInput} for command's `input` shape.
 * @see {@link GetPackageV2ByTagCommandOutput} for command's `response` shape.
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
export declare class GetPackageV2ByTagCommand extends GetPackageV2ByTagCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetPackageV2ByTagRequest;
            output: PackageV2;
        };
        sdk: {
            input: GetPackageV2ByTagCommandInput;
            output: GetPackageV2ByTagCommandOutput;
        };
    };
}
