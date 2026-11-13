import { de_GetTelemetrySummaryCommand, se_GetTelemetrySummaryCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class GetTelemetrySummaryCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "GetTelemetrySummary", {})
    .n("AirborneClient", "GetTelemetrySummaryCommand")
    .f(void 0, void 0)
    .ser(se_GetTelemetrySummaryCommand)
    .de(de_GetTelemetrySummaryCommand)
    .build() {
}
