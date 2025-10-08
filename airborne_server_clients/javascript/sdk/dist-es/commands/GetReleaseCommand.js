import { de_GetReleaseCommand, se_GetReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetRelease", {})
    .n("AirborneClient", "GetReleaseCommand")
    .f(void 0, void 0)
    .ser(se_GetReleaseCommand)
    .de(de_GetReleaseCommand)
    .build() {
}
