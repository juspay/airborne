import { de_UpdateFileCommand, se_UpdateFileCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class UpdateFileCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UpdateFile", {})
    .n("AirborneClient", "UpdateFileCommand")
    .f(void 0, void 0)
    .ser(se_UpdateFileCommand)
    .de(de_UpdateFileCommand)
    .build() {
}
