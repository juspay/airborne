import { de_CreatePackageCommand, se_CreatePackageCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreatePackageCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreatePackage", {})
    .n("AirborneClient", "CreatePackageCommand")
    .f(void 0, void 0)
    .ser(se_CreatePackageCommand)
    .de(de_CreatePackageCommand)
    .build() {
}
