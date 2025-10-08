import { de_GetUserCommand, se_GetUserCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetUserCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetUser", {})
    .n("AirborneClient", "GetUserCommand")
    .f(void 0, void 0)
    .ser(se_GetUserCommand)
    .de(de_GetUserCommand)
    .build() {
}
