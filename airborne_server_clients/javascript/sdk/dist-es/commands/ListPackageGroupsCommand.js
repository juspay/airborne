import { de_ListPackageGroupsCommand, se_ListPackageGroupsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListPackageGroupsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListPackageGroups", {})
    .n("AirborneClient", "ListPackageGroupsCommand")
    .f(void 0, void 0)
    .ser(se_ListPackageGroupsCommand)
    .de(de_ListPackageGroupsCommand)
    .build() {
}
