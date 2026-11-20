import { de_RampReleaseCommand, se_RampReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class RampReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "RampRelease", {})
    .n("AirborneClient", "RampReleaseCommand")
    .f(void 0, void 0)
    .ser(se_RampReleaseCommand)
    .de(de_RampReleaseCommand)
    .build() {
}
