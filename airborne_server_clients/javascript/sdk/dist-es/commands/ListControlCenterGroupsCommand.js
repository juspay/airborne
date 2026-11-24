import { de_ListControlCenterGroupsCommand, se_ListControlCenterGroupsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListControlCenterGroupsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListControlCenterGroups", {})
    .n("AirborneClient", "ListControlCenterGroupsCommand")
    .f(void 0, void 0)
    .ser(se_ListControlCenterGroupsCommand)
    .de(de_ListControlCenterGroupsCommand)
    .build() {
}
