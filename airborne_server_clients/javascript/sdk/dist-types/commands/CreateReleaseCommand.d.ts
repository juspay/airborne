import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateReleaseRequest, CreateReleaseResponse } from "../models/models_0";
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
 * The input for {@link CreateReleaseCommand}.
 */
export interface CreateReleaseCommandInput extends CreateReleaseRequest {
}
/**
 * @public
 *
 * The output of {@link CreateReleaseCommand}.
 */
export interface CreateReleaseCommandOutput extends CreateReleaseResponse, __MetadataBearer {
}
declare const CreateReleaseCommand_base: {
    new (input: CreateReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<CreateReleaseCommandInput, CreateReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateReleaseCommandInput): import("@smithy/smithy-client").CommandImpl<CreateReleaseCommandInput, CreateReleaseCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create a new release. A release points a package (and any resources) at a set of targeting dimensions; ramp it later to roll it out. Pass the organisation and application in the x-organisation and x-application headers. Returns the created release with its resolved config and package. Returns 409 if another release is already ongoing for the same dimensions. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateReleaseCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateReleaseCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateReleaseRequest
 *   config: { // CreateReleaseRequestConfig
 *     release_config_timeout: Number("int"), // required
 *     boot_timeout: Number("int"), // required
 *     properties: "DOCUMENT_VALUE", // required
 *   },
 *   package_id: "STRING_VALUE",
 *   package: { // CreateReleaseRequestPackage
 *     properties: "DOCUMENT_VALUE",
 *     important: [ // StringList
 *       "STRING_VALUE",
 *     ],
 *     lazy: [
 *       "STRING_VALUE",
 *     ],
 *   },
 *   dimensions: { // DimensionsMap
 *     "<keys>": "DOCUMENT_VALUE",
 *   },
 *   resources: [
 *     "STRING_VALUE",
 *   ],
 *   rollback_sensitive: "security" || "one_way_migration",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateReleaseCommand(input);
 * const response = await client.send(command);
 * // { // CreateReleaseResponse
 * //   warnings: [ // ReleaseWarnings
 * //     "STRING_VALUE",
 * //   ],
 * //   id: "STRING_VALUE", // required
 * //   created_at: "STRING_VALUE", // required
 * //   config: { // GetReleaseConfig
 * //     version: "STRING_VALUE", // required
 * //     release_config_timeout: Number("int"), // required
 * //     boot_timeout: Number("int"), // required
 * //     properties: { // ConfigProperties
 * //       tenant_info: "DOCUMENT_VALUE", // required
 * //     },
 * //   },
 * //   package: { // ServePackage
 * //     name: "STRING_VALUE",
 * //     version: "STRING_VALUE",
 * //     index: { // ServeFile
 * //       file_path: "STRING_VALUE",
 * //       url: "STRING_VALUE",
 * //       checksum: "STRING_VALUE",
 * //       size: Number("long"),
 * //     },
 * //     properties: "DOCUMENT_VALUE",
 * //     important: [ // ServeFileList
 * //       {
 * //         file_path: "STRING_VALUE",
 * //         url: "STRING_VALUE",
 * //         checksum: "STRING_VALUE",
 * //         size: Number("long"),
 * //       },
 * //     ],
 * //     lazy: [
 * //       {
 * //         file_path: "STRING_VALUE",
 * //         url: "STRING_VALUE",
 * //         checksum: "STRING_VALUE",
 * //         size: Number("long"),
 * //       },
 * //     ],
 * //   },
 * //   experiment: { // ReleaseExperiment
 * //     experiment_id: "STRING_VALUE",
 * //     experiment_variants: { // ExperimentVariants
 * //       control: "STRING_VALUE",
 * //       experimentals: [ // StringList
 * //         "STRING_VALUE",
 * //       ],
 * //     },
 * //     package_version: Number("int"),
 * //     config_version: "STRING_VALUE",
 * //     created_at: "STRING_VALUE",
 * //     traffic_percentage: Number("int"),
 * //     status: "STRING_VALUE",
 * //   },
 * //   dimensions: { // DimensionsMap // required
 * //     "<keys>": "DOCUMENT_VALUE",
 * //   },
 * // };
 *
 * ```
 *
 * @param CreateReleaseCommandInput - {@link CreateReleaseCommandInput}
 * @returns {@link CreateReleaseCommandOutput}
 * @see {@link CreateReleaseCommandInput} for command's `input` shape.
 * @see {@link CreateReleaseCommandOutput} for command's `response` shape.
 * @see {@link AirborneClientResolvedConfig | config} for AirborneClient's `config` shape.
 *
 * @throws {@link Unauthorized} (client fault)
 *  Unauthorized error
 *
 * @throws {@link BadRequestError} (client fault)
 *  Bad request error
 *
 * @throws {@link ConflictError} (client fault)
 *  Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
 *
 * @throws {@link UnresolvedOperationError} (client fault)
 *  A write has an unknown upstream outcome. Inspect its real state and change history before resolving it; elapsed time alone does not establish rejection. An upstream 4xx is not proof that nothing was written, because the upstream handler can return it after configuration effects. While the operation is unresolved, writes for the application stay paused. When the 409 comes from a recovery attempt it can name the config keys or contexts that changed and must be restored, or finished and resolved as applied.
 *
 * @throws {@link NotFoundError} (client fault)
 *  Not found error
 *
 * @throws {@link InternalServerError} (server fault)
 *  Internal server error
 *
 * @throws {@link ForbiddenError} (client fault)
 *
 * @throws {@link ApprovalRequiredError} (client fault)
 *  A direct release write was refused because this application requires an approved deployment request.
 *
 * @throws {@link AirborneServiceException}
 * <p>Base exception class for all service exceptions from Airborne service.</p>
 *
 *
 * @public
 */
export declare class CreateReleaseCommand extends CreateReleaseCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateReleaseRequest;
            output: CreateReleaseResponse;
        };
        sdk: {
            input: CreateReleaseCommandInput;
            output: CreateReleaseCommandOutput;
        };
    };
}
