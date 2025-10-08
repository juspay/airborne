import { AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../AirborneClient";
import { CreateFileRequest, CreateFileResponse } from "../models/models_0";
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
 * The input for {@link CreateFileCommand}.
 */
export interface CreateFileCommandInput extends CreateFileRequest {
}
/**
 * @public
 *
 * The output of {@link CreateFileCommand}.
 */
export interface CreateFileCommandOutput extends CreateFileResponse, __MetadataBearer {
}
declare const CreateFileCommand_base: {
    new (input: CreateFileCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileCommandInput, CreateFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (__0_0: CreateFileCommandInput): import("@smithy/smithy-client").CommandImpl<CreateFileCommandInput, CreateFileCommandOutput, AirborneClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * Create file request operation
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { AirborneClient, CreateFileCommand } from "airborne-server-sdk"; // ES Modules import
 * // const { AirborneClient, CreateFileCommand } = require("airborne-server-sdk"); // CommonJS import
 * const client = new AirborneClient(config);
 * const input = { // CreateFileRequest
 *   file_path: "STRING_VALUE", // required
 *   url: "STRING_VALUE", // required
 *   tag: "STRING_VALUE",
 *   metadata: "DOCUMENT_VALUE",
 *   organisation: "STRING_VALUE", // required
 *   application: "STRING_VALUE", // required
 * };
 * const command = new CreateFileCommand(input);
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
 * @param CreateFileCommandInput - {@link CreateFileCommandInput}
 * @returns {@link CreateFileCommandOutput}
 * @see {@link CreateFileCommandInput} for command's `input` shape.
 * @see {@link CreateFileCommandOutput} for command's `response` shape.
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
export declare class CreateFileCommand extends CreateFileCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateFileRequest;
            output: CreateFileResponse;
        };
        sdk: {
            input: CreateFileCommandInput;
            output: CreateFileCommandOutput;
        };
    };
}
