import { UploadFileRequestFilterSensitiveLog, } from "../models/models_0";
import { de_UploadFileCommand, se_UploadFileCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class UploadFileCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UploadFile", {})
    .n("AirborneClient", "UploadFileCommand")
    .f(UploadFileRequestFilterSensitiveLog, void 0)
    .ser(se_UploadFileCommand)
    .de(de_UploadFileCommand)
    .build() {
}
