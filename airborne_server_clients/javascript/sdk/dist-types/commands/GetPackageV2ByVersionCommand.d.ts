import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { GetPackageV2ByVersionRequest, PackageV2 } from "../models/models_0";
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
 * The input for {@link GetPackageV2ByVersionCommand}.
 */
export interface GetPackageV2ByVersionCommandInput extends GetPackageV2ByVersionRequest {
}
/**
 * @public
 *
 * The output of {@link GetPackageV2ByVersionCommand}.
 */
export interface GetPackageV2ByVersionCommandOutput extends PackageV2, __MetadataBearer {
}
declare const GetPackageV2ByVersionCommand_base: {
    new (input: GetPackageV2ByVersionCommandInput): import("@smithy/smithy-client").CommandImpl<GetPackageV2ByVersionCommandInput, GetPackageV2ByVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetPackageV2ByVersionCommandInput): import("@smithy/smithy-client").CommandImpl<GetPackageV2ByVersionCommandInput, GetPackageV2ByVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Get a package by version within a package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetPackageV2ByVersionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetPackageV2ByVersionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetPackageV2ByVersionRequest
 *   groupId: "STRING_VALUE", // required
 *   version: Number("int"), // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetPackageV2ByVersionCommand(input);
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
 * @param GetPackageV2ByVersionCommandInput - {@link GetPackageV2ByVersionCommandInput}
 * @returns {@link GetPackageV2ByVersionCommandOutput}
 * @see {@link GetPackageV2ByVersionCommandInput} for command's `input` shape.
 * @see {@link GetPackageV2ByVersionCommandOutput} for command's `response` shape.
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
export declare class GetPackageV2ByVersionCommand extends GetPackageV2ByVersionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetPackageV2ByVersionRequest;
            output: PackageV2;
        };
        sdk: {
            input: GetPackageV2ByVersionCommandInput;
            output: GetPackageV2ByVersionCommandOutput;
        };
    };
}
