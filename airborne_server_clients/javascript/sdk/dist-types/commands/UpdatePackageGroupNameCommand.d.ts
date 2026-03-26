import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { PackageGroup, UpdatePackageGroupRequest } from "../models/models_0";
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
 * The input for {@link UpdatePackageGroupNameCommand}.
 */
export interface UpdatePackageGroupNameCommandInput extends UpdatePackageGroupRequest {
}
/**
 * @public
 *
 * The output of {@link UpdatePackageGroupNameCommand}.
 */
export interface UpdatePackageGroupNameCommandOutput extends PackageGroup, __MetadataBearer {
}
declare const UpdatePackageGroupNameCommand_base: {
    new (input: UpdatePackageGroupNameCommandInput): import("@smithy/smithy-client").CommandImpl<UpdatePackageGroupNameCommandInput, UpdatePackageGroupNameCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: UpdatePackageGroupNameCommandInput): import("@smithy/smithy-client").CommandImpl<UpdatePackageGroupNameCommandInput, UpdatePackageGroupNameCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Update a package group name
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdatePackageGroupNameCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdatePackageGroupNameCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdatePackageGroupRequest
 *   groupId: "STRING_VALUE", // required
 *   name: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UpdatePackageGroupNameCommand(input);
 * const response = await client.send(command);
 * // { // PackageGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   is_primary: true || false, // required
 * // };
 *
 * ```
 *
 * @param UpdatePackageGroupNameCommandInput - {@link UpdatePackageGroupNameCommandInput}
 * @returns {@link UpdatePackageGroupNameCommandOutput}
 * @see {@link UpdatePackageGroupNameCommandInput} for command's `input` shape.
 * @see {@link UpdatePackageGroupNameCommandOutput} for command's `response` shape.
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
export declare class UpdatePackageGroupNameCommand extends UpdatePackageGroupNameCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdatePackageGroupRequest;
            output: PackageGroup;
        };
        sdk: {
            input: UpdatePackageGroupNameCommandInput;
            output: UpdatePackageGroupNameCommandOutput;
        };
    };
}
