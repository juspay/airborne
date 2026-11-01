import { de_GetControlCenterReleaseEventsCommand, se_GetControlCenterReleaseEventsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetControlCenterReleaseEventsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetControlCenterReleaseEvents", {})
    .n("AirborneClient", "GetControlCenterReleaseEventsCommand")
    .f(void 0, void 0)
    .ser(se_GetControlCenterReleaseEventsCommand)
    .de(de_GetControlCenterReleaseEventsCommand)
    .build() {
}
