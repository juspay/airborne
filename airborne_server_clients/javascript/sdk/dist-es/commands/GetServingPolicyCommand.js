import { de_GetServingPolicyCommand, se_GetServingPolicyCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetServingPolicyCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetServingPolicy", {})
    .n("AirborneClient", "GetServingPolicyCommand")
    .f(void 0, void 0)
    .ser(se_GetServingPolicyCommand)
    .de(de_GetServingPolicyCommand)
    .build() {
}
