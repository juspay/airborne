import { de_UpdateControlCenterApprovalPolicyCommand, se_UpdateControlCenterApprovalPolicyCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class UpdateControlCenterApprovalPolicyCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UpdateControlCenterApprovalPolicy", {})
    .n("AirborneClient", "UpdateControlCenterApprovalPolicyCommand")
    .f(void 0, void 0)
    .ser(se_UpdateControlCenterApprovalPolicyCommand)
    .de(de_UpdateControlCenterApprovalPolicyCommand)
    .build() {
}
