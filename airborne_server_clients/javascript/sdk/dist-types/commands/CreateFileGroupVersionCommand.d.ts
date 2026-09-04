import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateFileGroupVersionRequest, FileGroupVersionInfo } from "../models/models_0";
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
 * The input for {@link CreateFileGroupVersionCommand}.
 */
export interface CreateFileGroupVersionCommandInput extends CreateFileGroupVersionRequest {
}
/**
 * @public
 *
 * The output of {@link CreateFileGroupVersionCommand}.
 */
export interface CreateFileGroupVersionCommandOutput extends FileGroupVersionInfo, __MetadataBearer {
}
declare const CreateFileGroupVersionCommand_base: {
    new (input: CreateFileGroupVersionCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileGroupVersionCommandInput, CreateFileGroupVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateFileGroupVersionCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileGroupVersionCommandInput, CreateFileGroupVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * Create a new immutable version of a file group, snapshotting the given files with its own metadata. The version number is assigned automatically. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileGroupVersionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileGroupVersionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileGroupVersionRequest
 *   name: "STRING_VALUE", // required
 *   files: [ // FileKeyList // required
 *     "STRING_VALUE",
 *   ],
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileGroupVersionCommand(input);
 * const response = await client.send(command);
 * // { // FileGroupVersionInfo
 * //   version: Number("int"), // required
 * //   metadata: "DOCUMENT_VALUE", // required
 * //   files: [ // FileGroupMemberList // required
 * //     { // FileGroupMember
 * //       id: "STRING_VALUE", // required
 * //       file_path: "STRING_VALUE", // required
 * //       version: Number("int"), // required
 * //       tag: "STRING_VALUE",
 * //       url: "STRING_VALUE", // required
 * //       size: Number("long"), // required
 * //       checksum: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   created_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param CreateFileGroupVersionCommandInput - {@link CreateFileGroupVersionCommandInput}
 * @returns {@link CreateFileGroupVersionCommandOutput}
 * @see {@link CreateFileGroupVersionCommandInput} for command's `input` shape.
 * @see {@link CreateFileGroupVersionCommandOutput} for command's `response` shape.
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
export declare class CreateFileGroupVersionCommand extends CreateFileGroupVersionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateFileGroupVersionRequest;
            output: FileGroupVersionInfo;
        };
        sdk: {
            input: CreateFileGroupVersionCommandInput;
            output: CreateFileGroupVersionCommandOutput;
        };
    };
}
