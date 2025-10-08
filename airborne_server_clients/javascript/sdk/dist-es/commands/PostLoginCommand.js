import { de_PostLoginCommand, se_PostLoginCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class PostLoginCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "PostLogin", {})
    .n("AirborneClient", "PostLoginCommand")
    .f(void 0, void 0)
    .ser(se_PostLoginCommand)
    .de(de_PostLoginCommand)
    .build() {
}
