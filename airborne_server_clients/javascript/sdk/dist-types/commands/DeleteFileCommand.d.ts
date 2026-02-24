import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { DeleteFileRequest, DeleteFileResponse } from "../models/models_0";
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
 * The input for {@link DeleteFileCommand}.
 */
export interface DeleteFileCommandInput extends DeleteFileRequest {
}
/**
 * @public
 *
 * The output of {@link DeleteFileCommand}.
 */
export interface DeleteFileCommandOutput extends DeleteFileResponse, __MetadataBearer {
}
declare const DeleteFileCommand_base: {
    new (input: DeleteFileCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteFileCommandInput, DeleteFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: DeleteFileCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteFileCommandInput, DeleteFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Delete file request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, DeleteFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, DeleteFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // DeleteFileRequest
 *   file_id: "STRING_VALUE", // required
 *   delete_all_versions: true || false,
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new DeleteFileCommand(input);
 * const response = await client.send(command);
 * // { // DeleteFileResponse
 * //   id: "STRING_VALUE", // required
 * //   file_path: "STRING_VALUE", // required
 * //   url: "STRING_VALUE", // required
 * //   versions: [ // DeletedVersionsList // required
 * //     Number("int"),
 * //   ],
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
 * @param DeleteFileCommandInput - {@link DeleteFileCommandInput}
 * @returns {@link DeleteFileCommandOutput}
 * @see {@link DeleteFileCommandInput} for command's `input` shape.
 * @see {@link DeleteFileCommandOutput} for command's `response` shape.
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
export declare class DeleteFileCommand extends DeleteFileCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DeleteFileRequest;
            output: DeleteFileResponse;
        };
        sdk: {
            input: DeleteFileCommandInput;
            output: DeleteFileCommandOutput;
        };
    };
}
