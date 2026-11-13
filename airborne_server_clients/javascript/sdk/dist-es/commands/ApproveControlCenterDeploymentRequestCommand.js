import { de_ApproveControlCenterDeploymentRequestCommand, se_ApproveControlCenterDeploymentRequestCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ApproveControlCenterDeploymentRequestCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ApproveControlCenterDeploymentRequest", {})
    .n("AirborneClient", "ApproveControlCenterDeploymentRequestCommand")
    .f(void 0, void 0)
    .ser(se_ApproveControlCenterDeploymentRequestCommand)
    .de(de_ApproveControlCenterDeploymentRequestCommand)
    .build() {
}
