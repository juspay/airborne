import { de_GetPackageV2ByTagCommand, se_GetPackageV2ByTagCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetPackageV2ByTagCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetPackageV2ByTag", {})
    .n("AirborneClient", "GetPackageV2ByTagCommand")
    .f(void 0, void 0)
    .ser(se_GetPackageV2ByTagCommand)
    .de(de_GetPackageV2ByTagCommand)
    .build() {
}
