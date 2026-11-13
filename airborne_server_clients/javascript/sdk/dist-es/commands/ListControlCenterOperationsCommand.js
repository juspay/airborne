import { de_ListControlCenterOperationsCommand, se_ListControlCenterOperationsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListControlCenterOperationsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListControlCenterOperations", {})
    .n("AirborneClient", "ListControlCenterOperationsCommand")
    .f(void 0, void 0)
    .ser(se_ListControlCenterOperationsCommand)
    .de(de_ListControlCenterOperationsCommand)
    .build() {
}
