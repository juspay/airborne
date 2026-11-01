import { de_IngestTelemetryReportsCommand, se_IngestTelemetryReportsCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class IngestTelemetryReportsCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "IngestTelemetryReports", {})
    .n("AirborneClient", "IngestTelemetryReportsCommand")
    .f(void 0, void 0)
    .ser(se_IngestTelemetryReportsCommand)
    .de(de_IngestTelemetryReportsCommand)
    .build() {
}
