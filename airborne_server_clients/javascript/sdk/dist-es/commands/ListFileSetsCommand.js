import { de_ListFileSetsCommand, se_ListFileSetsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListFileSetsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListFileSets", {})
    .n("AirborneClient", "ListFileSetsCommand")
    .f(void 0, void 0)
    .ser(se_ListFileSetsCommand)
    .de(de_ListFileSetsCommand)
    .build() {
}
