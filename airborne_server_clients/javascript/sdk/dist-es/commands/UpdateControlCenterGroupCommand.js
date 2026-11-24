import { de_UpdateControlCenterGroupCommand, se_UpdateControlCenterGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class UpdateControlCenterGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UpdateControlCenterGroup", {})
    .n("AirborneClient", "UpdateControlCenterGroupCommand")
    .f(void 0, void 0)
    .ser(se_UpdateControlCenterGroupCommand)
    .de(de_UpdateControlCenterGroupCommand)
    .build() {
}
