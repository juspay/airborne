import { de_TestValidationFunctionCommand, se_TestValidationFunctionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class TestValidationFunctionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "TestValidationFunction", {})
    .n("AirborneClient", "TestValidationFunctionCommand")
    .f(void 0, void 0)
    .ser(se_TestValidationFunctionCommand)
    .de(de_TestValidationFunctionCommand)
    .build() {
}
