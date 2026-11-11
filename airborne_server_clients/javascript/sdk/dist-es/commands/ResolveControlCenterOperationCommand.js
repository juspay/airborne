import { de_ResolveControlCenterOperationCommand, se_ResolveControlCenterOperationCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ResolveControlCenterOperationCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ResolveControlCenterOperation", {})
    .n("AirborneClient", "ResolveControlCenterOperationCommand")
    .f(void 0, void 0)
    .ser(se_ResolveControlCenterOperationCommand)
    .de(de_ResolveControlCenterOperationCommand)
    .build() {
}
