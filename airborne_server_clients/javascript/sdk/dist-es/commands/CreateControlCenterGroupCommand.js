import { de_CreateControlCenterGroupCommand, se_CreateControlCenterGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateControlCenterGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateControlCenterGroup", {})
    .n("AirborneClient", "CreateControlCenterGroupCommand")
    .f(void 0, void 0)
    .ser(se_CreateControlCenterGroupCommand)
    .de(de_CreateControlCenterGroupCommand)
    .build() {
}
