import { de_ListOrganisationsCommand, se_ListOrganisationsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListOrganisationsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListOrganisations", {})
    .n("AirborneClient", "ListOrganisationsCommand")
    .f(void 0, void 0)
    .ser(se_ListOrganisationsCommand)
    .de(de_ListOrganisationsCommand)
    .build() {
}
