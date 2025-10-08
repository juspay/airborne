import { de_ListFilesCommand, se_ListFilesCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListFilesCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListFiles", {})
    .n("AirborneClient", "ListFilesCommand")
    .f(void 0, void 0)
    .ser(se_ListFilesCommand)
    .de(de_ListFilesCommand)
    .build() {
}
