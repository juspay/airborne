"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFileCommand = exports.$Command = void 0;
const models_0_1 = require("../models/models_0");
const Aws_restJson1_1 = require("../protocols/Aws_restJson1");
const middleware_serde_1 = require("@smithy/middleware-serde");
const smithy_client_1 = require("@smithy/smithy-client");
Object.defineProperty(exports, "$Command", { enumerable: true, get: function () { return smithy_client_1.Command; } });
class UploadFileCommand extends smithy_client_1.Command.classBuilder()
    .m(function (Command, cs, config, o) {
    return [
        (0, middleware_serde_1.getSerdePlugin)(config, this.serialize, this.deserialize),
    ];
})
    .s("Airborne", "UploadFile", {})
    .n("AirborneClient", "UploadFileCommand")
    .f(models_0_1.UploadFileRequestFilterSensitiveLog, void 0)
    .ser(Aws_restJson1_1.se_UploadFileCommand)
    .de(Aws_restJson1_1.de_UploadFileCommand)
    .build() {
}
exports.UploadFileCommand = UploadFileCommand;
