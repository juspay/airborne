import { de_GetControlCenterApprovalPolicyCommand, se_GetControlCenterApprovalPolicyCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetControlCenterApprovalPolicyCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetControlCenterApprovalPolicy", {})
    .n("AirborneClient", "GetControlCenterApprovalPolicyCommand")
    .f(void 0, void 0)
    .ser(se_GetControlCenterApprovalPolicyCommand)
    .de(de_GetControlCenterApprovalPolicyCommand)
    .build() {
}
