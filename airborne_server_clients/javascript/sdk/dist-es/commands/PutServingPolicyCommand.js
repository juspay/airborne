import { de_PutServingPolicyCommand, se_PutServingPolicyCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class PutServingPolicyCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "PutServingPolicy", {})
    .n("AirborneClient", "PutServingPolicyCommand")
    .f(void 0, void 0)
    .ser(se_PutServingPolicyCommand)
    .de(de_PutServingPolicyCommand)
    .build() {
}
