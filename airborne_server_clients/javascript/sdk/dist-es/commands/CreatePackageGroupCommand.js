import { de_CreatePackageGroupCommand, se_CreatePackageGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreatePackageGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreatePackageGroup", {})
    .n("AirborneClient", "CreatePackageGroupCommand")
    .f(void 0, void 0)
    .ser(se_CreatePackageGroupCommand)
    .de(de_CreatePackageGroupCommand)
    .build() {
}
