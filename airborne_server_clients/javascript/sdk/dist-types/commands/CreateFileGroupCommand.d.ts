import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateFileGroupRequest, NamedFileGroup } from "../models/models_0";
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
 * The input for {@link CreateFileGroupCommand}.
 */
export interface CreateFileGroupCommandInput extends CreateFileGroupRequest {
}
/**
 * @public
 *
 * The output of {@link CreateFileGroupCommand}.
 */
export interface CreateFileGroupCommandOutput extends NamedFileGroup, __MetadataBearer {
}
declare const CreateFileGroupCommand_base: {
    new (input: CreateFileGroupCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileGroupCommandInput, CreateFileGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateFileGroupCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileGroupCommandInput, CreateFileGroupCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * Create a file group: a named, versioned collection of files that can be selected together when building packages and releases. Names are unique within the application; the given files and metadata become version 1. Every file key must resolve to an existing file. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileGroupCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileGroupCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileGroupRequest
 *   name: "STRING_VALUE", // required
 *   files: [ // FileKeyList
 *     "STRING_VALUE",
 *   ],
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileGroupCommand(input);
 * const response = await client.send(command);
 * // { // NamedFileGroup
 * //   name: "STRING_VALUE", // required
 * //   total_versions: Number("long"), // required
 * //   latest: { // FileGroupVersionInfo
 * //     version: Number("int"), // required
 * //     metadata: "DOCUMENT_VALUE", // required
 * //     files: [ // FileGroupMemberList // required
 * //       { // FileGroupMember
 * //         id: "STRING_VALUE", // required
 * //         file_path: "STRING_VALUE", // required
 * //         version: Number("int"), // required
 * //         tag: "STRING_VALUE",
 * //         url: "STRING_VALUE", // required
 * //         size: Number("long"), // required
 * //         checksum: "STRING_VALUE", // required
 * //       },
 * //     ],
 * //     created_at: "STRING_VALUE", // required
 * //   },
 * //   created_at: "STRING_VALUE", // required
 * //   updated_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param CreateFileGroupCommandInput - {@link CreateFileGroupCommandInput}
 * @returns {@link CreateFileGroupCommandOutput}
 * @see {@link CreateFileGroupCommandInput} for command's `input` shape.
 * @see {@link CreateFileGroupCommandOutput} for command's `response` shape.
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
export declare class CreateFileGroupCommand extends CreateFileGroupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateFileGroupRequest;
            output: NamedFileGroup;
        };
        sdk: {
            input: CreateFileGroupCommandInput;
            output: CreateFileGroupCommandOutput;
        };
    };
}
