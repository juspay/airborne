import { de_RejectControlCenterDeploymentRequestCommand, se_RejectControlCenterDeploymentRequestCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class RejectControlCenterDeploymentRequestCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "RejectControlCenterDeploymentRequest", {})
    .n("AirborneClient", "RejectControlCenterDeploymentRequestCommand")
    .f(void 0, void 0)
    .ser(se_RejectControlCenterDeploymentRequestCommand)
    .de(de_RejectControlCenterDeploymentRequestCommand)
    .build() {
}
