import { de_GetControlCenterOverviewCommand, se_GetControlCenterOverviewCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetControlCenterOverviewCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetControlCenterOverview", {})
    .n("AirborneClient", "GetControlCenterOverviewCommand")
    .f(void 0, void 0)
    .ser(se_GetControlCenterOverviewCommand)
    .de(de_GetControlCenterOverviewCommand)
    .build() {
}
