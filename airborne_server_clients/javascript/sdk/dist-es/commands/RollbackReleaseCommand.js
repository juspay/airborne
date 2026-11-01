import { de_RollbackReleaseCommand, se_RollbackReleaseCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class RollbackReleaseCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "RollbackRelease", {})
    .n("AirborneClient", "RollbackReleaseCommand")
    .f(void 0, void 0)
    .ser(se_RollbackReleaseCommand)
    .de(de_RollbackReleaseCommand)
    .build() {
}
