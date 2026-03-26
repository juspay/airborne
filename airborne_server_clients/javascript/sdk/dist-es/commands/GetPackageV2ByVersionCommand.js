import { de_GetPackageV2ByVersionCommand, se_GetPackageV2ByVersionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetPackageV2ByVersionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetPackageV2ByVersion", {})
    .n("AirborneClient", "GetPackageV2ByVersionCommand")
    .f(void 0, void 0)
    .ser(se_GetPackageV2ByVersionCommand)
    .de(de_GetPackageV2ByVersionCommand)
    .build() {
}
