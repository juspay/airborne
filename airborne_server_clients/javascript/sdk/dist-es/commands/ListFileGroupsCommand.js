import { de_ListFileGroupsCommand, se_ListFileGroupsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListFileGroupsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListFileGroups", {})
    .n("AirborneClient", "ListFileGroupsCommand")
    .f(void 0, void 0)
    .ser(se_ListFileGroupsCommand)
    .de(de_ListFileGroupsCommand)
    .build() {
}
