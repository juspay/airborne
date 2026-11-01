import { de_GetControlCenterRollbackPreviewCommand, se_GetControlCenterRollbackPreviewCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetControlCenterRollbackPreviewCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetControlCenterRollbackPreview", {})
    .n("AirborneClient", "GetControlCenterRollbackPreviewCommand")
    .f(void 0, void 0)
    .ser(se_GetControlCenterRollbackPreviewCommand)
    .de(de_GetControlCenterRollbackPreviewCommand)
    .build() {
}
