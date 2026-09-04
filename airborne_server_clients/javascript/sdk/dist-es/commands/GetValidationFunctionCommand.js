import { de_GetValidationFunctionCommand, se_GetValidationFunctionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetValidationFunctionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetValidationFunction", {})
    .n("AirborneClient", "GetValidationFunctionCommand")
    .f(void 0, void 0)
    .ser(se_GetValidationFunctionCommand)
    .de(de_GetValidationFunctionCommand)
    .build() {
}
