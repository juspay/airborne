import { de_ServeReleaseV2Command, se_ServeReleaseV2Command, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ServeReleaseV2Command extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ServeReleaseV2", {})
    .n("AirborneClient", "ServeReleaseV2Command")
    .f(void 0, void 0)
    .ser(se_ServeReleaseV2Command)
    .de(de_ServeReleaseV2Command)
    .build() {
}
