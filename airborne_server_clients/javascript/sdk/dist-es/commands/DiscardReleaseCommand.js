import { de_DiscardReleaseCommand, se_DiscardReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class DiscardReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "DiscardRelease", {})
    .n("AirborneClient", "DiscardReleaseCommand")
    .f(void 0, void 0)
    .ser(se_DiscardReleaseCommand)
    .de(de_DiscardReleaseCommand)
    .build() {
}
