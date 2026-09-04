import { de_GetFileGroupCommand, se_GetFileGroupCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetFileGroupCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetFileGroup", {})
    .n("AirborneClient", "GetFileGroupCommand")
    .f(void 0, void 0)
    .ser(se_GetFileGroupCommand)
    .de(de_GetFileGroupCommand)
    .build() {
}
