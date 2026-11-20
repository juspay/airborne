import { de_ListControlCenterDeploymentRequestsCommand, se_ListControlCenterDeploymentRequestsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListControlCenterDeploymentRequestsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListControlCenterDeploymentRequests", {})
    .n("AirborneClient", "ListControlCenterDeploymentRequestsCommand")
    .f(void 0, void 0)
    .ser(se_ListControlCenterDeploymentRequestsCommand)
    .de(de_ListControlCenterDeploymentRequestsCommand)
    .build() {
}
