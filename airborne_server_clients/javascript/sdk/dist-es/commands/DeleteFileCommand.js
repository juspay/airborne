import { de_DeleteFileCommand, se_DeleteFileCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class DeleteFileCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "DeleteFile", {})
    .n("AirborneClient", "DeleteFileCommand")
    .f(void 0, void 0)
    .ser(se_DeleteFileCommand)
    .de(de_DeleteFileCommand)
    .build() {
}
