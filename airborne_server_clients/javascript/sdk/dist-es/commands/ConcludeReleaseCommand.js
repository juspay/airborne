import { de_ConcludeReleaseCommand, se_ConcludeReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ConcludeReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ConcludeRelease", {})
    .n("AirborneClient", "ConcludeReleaseCommand")
    .f(void 0, void 0)
    .ser(se_ConcludeReleaseCommand)
    .de(de_ConcludeReleaseCommand)
    .build() {
}
