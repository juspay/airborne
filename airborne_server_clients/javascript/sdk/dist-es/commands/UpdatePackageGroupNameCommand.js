import { de_UpdatePackageGroupNameCommand, se_UpdatePackageGroupNameCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class UpdatePackageGroupNameCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UpdatePackageGroupName", {})
    .n("AirborneClient", "UpdatePackageGroupNameCommand")
    .f(void 0, void 0)
    .ser(se_UpdatePackageGroupNameCommand)
    .de(de_UpdatePackageGroupNameCommand)
    .build() {
}
