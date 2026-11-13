import { de_DeleteControlCenterGroupCommand, se_DeleteControlCenterGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class DeleteControlCenterGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "DeleteControlCenterGroup", {})
    .n("AirborneClient", "DeleteControlCenterGroupCommand")
    .f(void 0, void 0)
    .ser(se_DeleteControlCenterGroupCommand)
    .de(de_DeleteControlCenterGroupCommand)
    .build() {
}
