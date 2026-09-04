import { de_UpdateValidationFunctionCommand, se_UpdateValidationFunctionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class UpdateValidationFunctionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UpdateValidationFunction", {})
    .n("AirborneClient", "UpdateValidationFunctionCommand")
    .f(void 0, void 0)
    .ser(se_UpdateValidationFunctionCommand)
    .de(de_UpdateValidationFunctionCommand)
    .build() {
}
