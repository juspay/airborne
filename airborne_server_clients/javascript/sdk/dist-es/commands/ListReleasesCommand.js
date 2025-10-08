import { de_ListReleasesCommand, se_ListReleasesCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class ListReleasesCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "ListReleases", {})
    .n("AirborneClient", "ListReleasesCommand")
    .f(void 0, void 0)
    .ser(se_ListReleasesCommand)
    .de(de_ListReleasesCommand)
    .build() {
}
