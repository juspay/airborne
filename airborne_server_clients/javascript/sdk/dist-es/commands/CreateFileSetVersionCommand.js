import { de_CreateFileSetVersionCommand, se_CreateFileSetVersionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateFileSetVersionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateFileSetVersion", {})
    .n("AirborneClient", "CreateFileSetVersionCommand")
    .f(void 0, void 0)
    .ser(se_CreateFileSetVersionCommand)
    .de(de_CreateFileSetVersionCommand)
    .build() {
}
