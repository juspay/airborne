import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateFileSetVersionRequest, FileSetVersion } from "../models/models_0";
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
 * The input for {@link CreateFileSetVersionCommand}.
 */
export interface CreateFileSetVersionCommandInput extends CreateFileSetVersionRequest {
}
/**
 * @public
 *
 * The output of {@link CreateFileSetVersionCommand}.
 */
export interface CreateFileSetVersionCommandOutput extends FileSetVersion, __MetadataBearer {
}
declare const CreateFileSetVersionCommand_base: {
    new (input: CreateFileSetVersionCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileSetVersionCommandInput, CreateFileSetVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateFileSetVersionCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileSetVersionCommandInput, CreateFileSetVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create a new immutable version of a file set, snapshotting the given files with its own metadata. The version number is assigned automatically. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileSetVersionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileSetVersionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileSetVersionRequest
 *   name: "STRING_VALUE", // required
 *   files: [ // FileKeyList // required
 *     "STRING_VALUE",
 *   ],
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileSetVersionCommand(input);
 * const response = await client.send(command);
 * // { // FileSetVersion
 * //   version: Number("int"), // required
 * //   metadata: "DOCUMENT_VALUE", // required
 * //   files: [ // FileSetMemberList // required
 * //     { // FileSetMember
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
 * @param CreateFileSetVersionCommandInput - {@link CreateFileSetVersionCommandInput}
 * @returns {@link CreateFileSetVersionCommandOutput}
 * @see {@link CreateFileSetVersionCommandInput} for command's `input` shape.
 * @see {@link CreateFileSetVersionCommandOutput} for command's `response` shape.
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
export declare class CreateFileSetVersionCommand extends CreateFileSetVersionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateFileSetVersionRequest;
            output: FileSetVersion;
        };
        sdk: {
            input: CreateFileSetVersionCommandInput;
            output: CreateFileSetVersionCommandOutput;
        };
    };
}
