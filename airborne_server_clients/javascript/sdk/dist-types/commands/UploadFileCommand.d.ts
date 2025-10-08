import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateFileResponse, UploadFileRequest } from "../models/models_0";
import { Command as $Command } from "@smithy/smithy-client";
import { StreamingBlobPayloadInputTypes, MetadataBearer as __MetadataBearer } from "@smithy/types";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UploadFileCommand}.
 */
export interface UploadFileCommandInput extends Omit<UploadFileRequest, "file"> {
    file: StreamingBlobPayloadInputTypes;
}
/**
 * @public
 *
 * The output of {@link UploadFileCommand}.
 */
export interface UploadFileCommandOutput extends CreateFileResponse, __MetadataBearer {
}
declare const UploadFileCommand_base: {
    new (input: UploadFileCommandInput): import("@smithy/smithy-client").CommandImpl<UploadFileCommandInput, UploadFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: UploadFileCommandInput): import("@smithy/smithy-client").CommandImpl<UploadFileCommandInput, UploadFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Upload file request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UploadFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UploadFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UploadFileRequest
 *   file: "MULTIPLE_TYPES_ACCEPTED", // see \@smithy/types -> StreamingBlobPayloadInputTypes // required
 *   file_path: "STRING_VALUE", // required
 *   tag: "STRING_VALUE",
 *   checksum: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UploadFileCommand(input);
 * const response = await client.send(command);
 * // { // CreateFileResponse
 * //   id: "STRING_VALUE", // required
 * //   file_path: "STRING_VALUE", // required
 * //   url: "STRING_VALUE", // required
 * //   version: Number("int"), // required
 * //   tag: "STRING_VALUE",
 * //   size: Number("int"), // required
 * //   checksum: "STRING_VALUE", // required
 * //   metadata: "DOCUMENT_VALUE", // required
 * //   status: "STRING_VALUE", // required
 * //   created_at: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param UploadFileCommandInput - {@link UploadFileCommandInput}
 * @returns {@link UploadFileCommandOutput}
 * @see {@link UploadFileCommandInput} for command's `input` shape.
 * @see {@link UploadFileCommandOutput} for command's `response` shape.
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
export declare class UploadFileCommand extends UploadFileCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UploadFileRequest;
            output: CreateFileResponse;
        };
        sdk: {
            input: UploadFileCommandInput;
            output: UploadFileCommandOutput;
        };
    };
}
