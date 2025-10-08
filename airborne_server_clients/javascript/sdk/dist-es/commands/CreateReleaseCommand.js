import { de_CreateReleaseCommand, se_CreateReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateRelease", {})
    .n("AirborneClient", "CreateReleaseCommand")
    .f(void 0, void 0)
    .ser(se_CreateReleaseCommand)
    .de(de_CreateReleaseCommand)
    .build() {
}
