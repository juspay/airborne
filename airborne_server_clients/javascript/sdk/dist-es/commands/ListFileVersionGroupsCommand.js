import { de_ListFileVersionGroupsCommand, se_ListFileVersionGroupsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListFileVersionGroupsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListFileVersionGroups", {})
    .n("AirborneClient", "ListFileVersionGroupsCommand")
    .f(void 0, void 0)
    .ser(se_ListFileVersionGroupsCommand)
    .de(de_ListFileVersionGroupsCommand)
    .build() {
}
