import { de_CreateFileSetCommand, se_CreateFileSetCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateFileSetCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateFileSet", {})
    .n("AirborneClient", "CreateFileSetCommand")
    .f(void 0, void 0)
    .ser(se_CreateFileSetCommand)
    .de(de_CreateFileSetCommand)
    .build() {
}
