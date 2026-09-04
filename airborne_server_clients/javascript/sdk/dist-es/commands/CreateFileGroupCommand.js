import { de_CreateFileGroupCommand, se_CreateFileGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateFileGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateFileGroup", {})
    .n("AirborneClient", "CreateFileGroupCommand")
    .f(void 0, void 0)
    .ser(se_CreateFileGroupCommand)
    .de(de_CreateFileGroupCommand)
    .build() {
}
