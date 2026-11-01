import { de_CreateControlCenterDeploymentRequestCommand, se_CreateControlCenterDeploymentRequestCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class CreateControlCenterDeploymentRequestCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "CreateControlCenterDeploymentRequest", {})
    .n("AirborneClient", "CreateControlCenterDeploymentRequestCommand")
    .f(void 0, void 0)
    .ser(se_CreateControlCenterDeploymentRequestCommand)
    .de(de_CreateControlCenterDeploymentRequestCommand)
    .build() {
}
