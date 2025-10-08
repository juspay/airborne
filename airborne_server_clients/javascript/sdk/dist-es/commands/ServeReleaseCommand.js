import { de_ServeReleaseCommand, se_ServeReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ServeReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ServeRelease", {})
    .n("AirborneClient", "ServeReleaseCommand")
    .f(void 0, void 0)
    .ser(se_ServeReleaseCommand)
    .de(de_ServeReleaseCommand)
    .build() {
}
