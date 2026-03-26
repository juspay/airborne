import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateFileResponse, UpdateFileRequest } from "../models/models_0";
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
 * The input for {@link UpdateFileCommand}.
 */
export interface UpdateFileCommandInput extends UpdateFileRequest {
}
/**
 * @public
 *
 * The output of {@link UpdateFileCommand}.
 */
export interface UpdateFileCommandOutput extends CreateFileResponse, __MetadataBearer {
}
declare const UpdateFileCommand_base: {
    new (input: UpdateFileCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateFileCommandInput, UpdateFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: UpdateFileCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateFileCommandInput, UpdateFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Update file operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, UpdateFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, UpdateFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // UpdateFileRequest
 *   file_key: "STRING_VALUE", // required
 *   tag: "STRING_VALUE", // required
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new UpdateFileCommand(input);
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
 * @param UpdateFileCommandInput - {@link UpdateFileCommandInput}
 * @returns {@link UpdateFileCommandOutput}
 * @see {@link UpdateFileCommandInput} for command's `input` shape.
 * @see {@link UpdateFileCommandOutput} for command's `response` shape.
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
export declare class UpdateFileCommand extends UpdateFileCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateFileRequest;
            output: CreateFileResponse;
        };
        sdk: {
            input: UpdateFileCommandInput;
            output: UpdateFileCommandOutput;
        };
    };
}
