import { de_GetFileSetCommand, se_GetFileSetCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetFileSetCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetFileSet", {})
    .n("AirborneClient", "GetFileSetCommand")
    .f(void 0, void 0)
    .ser(se_GetFileSetCommand)
    .de(de_GetFileSetCommand)
    .build() {
}
