import { de_CreateApplicationCommand, se_CreateApplicationCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateApplicationCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateApplication", {})
    .n("AirborneClient", "CreateApplicationCommand")
    .f(void 0, void 0)
    .ser(se_CreateApplicationCommand)
    .de(de_CreateApplicationCommand)
    .build() {
}
