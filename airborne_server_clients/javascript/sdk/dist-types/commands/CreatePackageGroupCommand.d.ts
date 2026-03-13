import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreatePackageGroupRequest, PackageGroup } from "../models/models_0";
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
 * The input for {@link CreatePackageGroupCommand}.
 */
export interface CreatePackageGroupCommandInput extends CreatePackageGroupRequest {
}
/**
 * @public
 *
 * The output of {@link CreatePackageGroupCommand}.
 */
export interface CreatePackageGroupCommandOutput extends PackageGroup, __MetadataBearer {
}
declare const CreatePackageGroupCommand_base: {
    new (input: CreatePackageGroupCommandInput): import("@smithy/smithy-client").CommandImpl<CreatePackageGroupCommandInput, CreatePackageGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreatePackageGroupCommandInput): import("@smithy/smithy-client").CommandImpl<CreatePackageGroupCommandInput, CreatePackageGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create a new package group
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreatePackageGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreatePackageGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreatePackageGroupRequest
 *   name: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreatePackageGroupCommand(input);
 * const response = await client.send(command);
 * // { // PackageGroup
 * //   id: "STRING_VALUE", // required
 * //   name: "STRING_VALUE", // required
 * //   is_primary: true || false, // required
 * // };
 *
 * ```
 *
 * @param CreatePackageGroupCommandInput - {@link CreatePackageGroupCommandInput}
 * @returns {@link CreatePackageGroupCommandOutput}
 * @see {@link CreatePackageGroupCommandInput} for command's `input` shape.
 * @see {@link CreatePackageGroupCommandOutput} for command's `response` shape.
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
export declare class CreatePackageGroupCommand extends CreatePackageGroupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreatePackageGroupRequest;
            output: PackageGroup;
        };
        sdk: {
            input: CreatePackageGroupCommandInput;
            output: CreatePackageGroupCommandOutput;
        };
    };
}
