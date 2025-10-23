"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Airborne = void 0;
const AirborneClient_1 = require("./AirborneClient");
const CreateApplicationCommand_1 = require("./commands/CreateApplicationCommand");
const CreateDimensionCommand_1 = require("./commands/CreateDimensionCommand");
const CreateFileCommand_1 = require("./commands/CreateFileCommand");
const CreateOrganisationCommand_1 = require("./commands/CreateOrganisationCommand");
const CreatePackageCommand_1 = require("./commands/CreatePackageCommand");
const CreateReleaseCommand_1 = require("./commands/CreateReleaseCommand");
const DeleteDimensionCommand_1 = require("./commands/DeleteDimensionCommand");
const GetReleaseCommand_1 = require("./commands/GetReleaseCommand");
const GetUserCommand_1 = require("./commands/GetUserCommand");
const ListDimensionsCommand_1 = require("./commands/ListDimensionsCommand");
const ListFilesCommand_1 = require("./commands/ListFilesCommand");
const ListOrganisationsCommand_1 = require("./commands/ListOrganisationsCommand");
const ListPackagesCommand_1 = require("./commands/ListPackagesCommand");
const ListReleasesCommand_1 = require("./commands/ListReleasesCommand");
const ListVersionsCommand_1 = require("./commands/ListVersionsCommand");
const PostLoginCommand_1 = require("./commands/PostLoginCommand");
const RequestOrganisationCommand_1 = require("./commands/RequestOrganisationCommand");
const ServeReleaseCommand_1 = require("./commands/ServeReleaseCommand");
const ServeReleaseV2Command_1 = require("./commands/ServeReleaseV2Command");
const UpdateDimensionCommand_1 = require("./commands/UpdateDimensionCommand");
const UploadFileCommand_1 = require("./commands/UploadFileCommand");
const smithy_client_1 = require("@smithy/smithy-client");
const commands = {
    CreateApplicationCommand: CreateApplicationCommand_1.CreateApplicationCommand,
    CreateDimensionCommand: CreateDimensionCommand_1.CreateDimensionCommand,
    CreateFileCommand: CreateFileCommand_1.CreateFileCommand,
    CreateOrganisationCommand: CreateOrganisationCommand_1.CreateOrganisationCommand,
    CreatePackageCommand: CreatePackageCommand_1.CreatePackageCommand,
    CreateReleaseCommand: CreateReleaseCommand_1.CreateReleaseCommand,
    DeleteDimensionCommand: DeleteDimensionCommand_1.DeleteDimensionCommand,
    GetReleaseCommand: GetReleaseCommand_1.GetReleaseCommand,
    GetUserCommand: GetUserCommand_1.GetUserCommand,
    ListDimensionsCommand: ListDimensionsCommand_1.ListDimensionsCommand,
    ListFilesCommand: ListFilesCommand_1.ListFilesCommand,
    ListOrganisationsCommand: ListOrganisationsCommand_1.ListOrganisationsCommand,
    ListPackagesCommand: ListPackagesCommand_1.ListPackagesCommand,
    ListReleasesCommand: ListReleasesCommand_1.ListReleasesCommand,
    ListVersionsCommand: ListVersionsCommand_1.ListVersionsCommand,
    PostLoginCommand: PostLoginCommand_1.PostLoginCommand,
    RequestOrganisationCommand: RequestOrganisationCommand_1.RequestOrganisationCommand,
    ServeReleaseCommand: ServeReleaseCommand_1.ServeReleaseCommand,
    ServeReleaseV2Command: ServeReleaseV2Command_1.ServeReleaseV2Command,
    UpdateDimensionCommand: UpdateDimensionCommand_1.UpdateDimensionCommand,
    UploadFileCommand: UploadFileCommand_1.UploadFileCommand,
};
class Airborne extends AirborneClient_1.AirborneClient {
}
exports.Airborne = Airborne;
(0, smithy_client_1.createAggregatedClient)(commands, Airborne);
