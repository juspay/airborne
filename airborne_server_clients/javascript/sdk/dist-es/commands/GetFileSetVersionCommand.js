import { de_GetFileSetVersionCommand, se_GetFileSetVersionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetFileSetVersionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetFileSetVersion", {})
    .n("AirborneClient", "GetFileSetVersionCommand")
    .f(void 0, void 0)
    .ser(se_GetFileSetVersionCommand)
    .de(de_GetFileSetVersionCommand)
    .build() {
}
