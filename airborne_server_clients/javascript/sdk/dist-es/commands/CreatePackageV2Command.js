import { de_CreatePackageV2Command, se_CreatePackageV2Command, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreatePackageV2Command extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreatePackageV2", {})
    .n("AirborneClient", "CreatePackageV2Command")
    .f(void 0, void 0)
    .ser(se_CreatePackageV2Command)
    .de(de_CreatePackageV2Command)
    .build() {
}
