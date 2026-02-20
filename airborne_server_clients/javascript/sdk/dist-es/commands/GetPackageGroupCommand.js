import { de_GetPackageGroupCommand, se_GetPackageGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetPackageGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetPackageGroup", {})
    .n("AirborneClient", "GetPackageGroupCommand")
    .f(void 0, void 0)
    .ser(se_GetPackageGroupCommand)
    .de(de_GetPackageGroupCommand)
    .build() {
}
