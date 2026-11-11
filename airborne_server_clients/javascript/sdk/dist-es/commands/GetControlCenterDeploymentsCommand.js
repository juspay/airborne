import { de_GetControlCenterDeploymentsCommand, se_GetControlCenterDeploymentsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetControlCenterDeploymentsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetControlCenterDeployments", {})
    .n("AirborneClient", "GetControlCenterDeploymentsCommand")
    .f(void 0, void 0)
    .ser(se_GetControlCenterDeploymentsCommand)
    .de(de_GetControlCenterDeploymentsCommand)
    .build() {
}
