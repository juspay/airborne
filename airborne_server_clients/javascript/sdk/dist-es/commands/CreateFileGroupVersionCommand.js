import { de_CreateFileGroupVersionCommand, se_CreateFileGroupVersionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateFileGroupVersionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateFileGroupVersion", {})
    .n("AirborneClient", "CreateFileGroupVersionCommand")
    .f(void 0, void 0)
    .ser(se_CreateFileGroupVersionCommand)
    .de(de_CreateFileGroupVersionCommand)
    .build() {
}
