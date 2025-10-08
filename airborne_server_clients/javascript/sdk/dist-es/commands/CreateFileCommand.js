import { de_CreateFileCommand, se_CreateFileCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateFileCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateFile", {})
    .n("AirborneClient", "CreateFileCommand")
    .f(void 0, void 0)
    .ser(se_CreateFileCommand)
    .de(de_CreateFileCommand)
    .build() {
}
