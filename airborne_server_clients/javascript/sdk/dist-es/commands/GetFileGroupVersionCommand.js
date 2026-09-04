import { de_GetFileGroupVersionCommand, se_GetFileGroupVersionCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetFileGroupVersionCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetFileGroupVersion", {})
    .n("AirborneClient", "GetFileGroupVersionCommand")
    .f(void 0, void 0)
    .ser(se_GetFileGroupVersionCommand)
    .de(de_GetFileGroupVersionCommand)
    .build() {
}
