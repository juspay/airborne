import { de_AcknowledgeEmergencyRollbackCommand, se_AcknowledgeEmergencyRollbackCommand, } from "../protocols/Aws_restJson1";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
export { $Command };
export class AcknowledgeEmergencyRollbackCommand extends $Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "AcknowledgeEmergencyRollback", {})
    .n("AirborneClient", "AcknowledgeEmergencyRollbackCommand")
    .f(void 0, void 0)
    .ser(se_AcknowledgeEmergencyRollbackCommand)
    .de(de_AcknowledgeEmergencyRollbackCommand)
    .build() {
}
