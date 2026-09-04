import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { FileGroupVersionInfo, GetFileGroupVersionRequest } from "../models/models_0";
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
 * The input for {@link GetFileGroupVersionCommand}.
 */
export interface GetFileGroupVersionCommandInput extends GetFileGroupVersionRequest {
}
/**
 * @public
 *
 * The output of {@link GetFileGroupVersionCommand}.
 */
export interface GetFileGroupVersionCommandOutput extends FileGroupVersionInfo, __MetadataBearer {
}
declare const GetFileGroupVersionCommand_base: {
    new (input: GetFileGroupVersionCommandInput): import("@smithy/smithy-client").CommandImpl<GetFileGroupVersionCommandInput, GetFileGroupVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: GetFileGroupVersionCommandInput): import("@smithy/smithy-client").CommandImpl<GetFileGroupVersionCommandInput, GetFileGroupVersionCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/types").EndpointParameterInstructions;
};
/**
 * Get one version of a file group with its resolved files and metadata. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, GetFileGroupVersionCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, GetFileGroupVersionCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // GetFileGroupVersionRequest
 *   name: "STRING_VALUE", // required
 *   version: Number("int"), // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new GetFileGroupVersionCommand(input);
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
 * @param GetFileGroupVersionCommandInput - {@link GetFileGroupVersionCommandInput}
 * @returns {@link GetFileGroupVersionCommandOutput}
 * @see {@link GetFileGroupVersionCommandInput} for command's `input` shape.
 * @see {@link GetFileGroupVersionCommandOutput} for command's `response` shape.
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
export declare class GetFileGroupVersionCommand extends GetFileGroupVersionCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetFileGroupVersionRequest;
            output: FileGroupVersionInfo;
        };
        sdk: {
            input: GetFileGroupVersionCommandInput;
            output: GetFileGroupVersionCommandOutput;
        };
    };
}
