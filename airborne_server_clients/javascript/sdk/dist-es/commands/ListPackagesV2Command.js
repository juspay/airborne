import { de_ListPackagesV2Command, se_ListPackagesV2Command, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListPackagesV2Command extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListPackagesV2", {})
    .n("AirborneClient", "ListPackagesV2Command")
    .f(void 0, void 0)
    .ser(se_ListPackagesV2Command)
    .de(de_ListPackagesV2Command)
    .build() {
}
