import { de_GetControlCenterDeploymentRequestCommand, se_GetControlCenterDeploymentRequestCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetControlCenterDeploymentRequestCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetControlCenterDeploymentRequest", {})
    .n("AirborneClient", "GetControlCenterDeploymentRequestCommand")
    .f(void 0, void 0)
    .ser(se_GetControlCenterDeploymentRequestCommand)
    .de(de_GetControlCenterDeploymentRequestCommand)
    .build() {
}
