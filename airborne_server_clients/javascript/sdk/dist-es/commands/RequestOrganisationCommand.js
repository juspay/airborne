import { de_RequestOrganisationCommand, se_RequestOrganisationCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class RequestOrganisationCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "RequestOrganisation", {})
    .n("AirborneClient", "RequestOrganisationCommand")
    .f(void 0, void 0)
    .ser(se_RequestOrganisationCommand)
    .de(de_RequestOrganisationCommand)
    .build() {
}
