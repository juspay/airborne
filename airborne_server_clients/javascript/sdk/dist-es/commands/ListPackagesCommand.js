import { de_ListPackagesCommand, se_ListPackagesCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListPackagesCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListPackages", {})
    .n("AirborneClient", "ListPackagesCommand")
    .f(void 0, void 0)
    .ser(se_ListPackagesCommand)
    .de(de_ListPackagesCommand)
    .build() {
}
