import { de_PreviewServingPolicyCommand, se_PreviewServingPolicyCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class PreviewServingPolicyCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "PreviewServingPolicy", {})
    .n("AirborneClient", "PreviewServingPolicyCommand")
    .f(void 0, void 0)
    .ser(se_PreviewServingPolicyCommand)
    .de(de_PreviewServingPolicyCommand)
    .build() {
}
