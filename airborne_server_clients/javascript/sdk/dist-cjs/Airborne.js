"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Airborne = void 0;
const AirborneClient_1 = require("./AirborneClient");
const CreateApplicationCommand_1 = require("./commands/CreateApplicationCommand");
const CreateDimensionCommand_1 = require("./commands/CreateDimensionCommand");
const CreateFileCommand_1 = require("./commands/CreateFileCommand");
const CreateOrganisationCommand_1 = require("./commands/CreateOrganisationCommand");
const CreatePackageCommand_1 = require("./commands/CreatePackageCommand");
const CreatePackageGroupCommand_1 = require("./commands/CreatePackageGroupCommand");
const CreatePackageV2Command_1 = require("./commands/CreatePackageV2Command");
const CreateReleaseCommand_1 = require("./commands/CreateReleaseCommand");
const DeleteDimensionCommand_1 = require("./commands/DeleteDimensionCommand");
const GetPackageGroupCommand_1 = require("./commands/GetPackageGroupCommand");
const GetPackageV2ByTagCommand_1 = require("./commands/GetPackageV2ByTagCommand");
const GetPackageV2ByVersionCommand_1 = require("./commands/GetPackageV2ByVersionCommand");
const GetReleaseCommand_1 = require("./commands/GetReleaseCommand");
const GetUserCommand_1 = require("./commands/GetUserCommand");
const ListDimensionsCommand_1 = require("./commands/ListDimensionsCommand");
const ListFilesCommand_1 = require("./commands/ListFilesCommand");
const ListOrganisationsCommand_1 = require("./commands/ListOrganisationsCommand");
const ListPackageGroupsCommand_1 = require("./commands/ListPackageGroupsCommand");
const ListPackagesCommand_1 = require("./commands/ListPackagesCommand");
const ListPackagesV2Command_1 = require("./commands/ListPackagesV2Command");
const ListReleasesCommand_1 = require("./commands/ListReleasesCommand");
const PostLoginCommand_1 = require("./commands/PostLoginCommand");
const RequestOrganisationCommand_1 = require("./commands/RequestOrganisationCommand");
const ServeReleaseCommand_1 = require("./commands/ServeReleaseCommand");
const ServeReleaseV2Command_1 = require("./commands/ServeReleaseV2Command");
const UpdateDimensionCommand_1 = require("./commands/UpdateDimensionCommand");
const UpdatePackageGroupNameCommand_1 = require("./commands/UpdatePackageGroupNameCommand");
const UploadFileCommand_1 = require("./commands/UploadFileCommand");
const smithy_client_1 = require("@smithy/smithy-client");
const commands = {
    CreateApplicationCommand: CreateApplicationCommand_1.CreateApplicationCommand,
    CreateDimensionCommand: CreateDimensionCommand_1.CreateDimensionCommand,
    CreateFileCommand: CreateFileCommand_1.CreateFileCommand,
    CreateOrganisationCommand: CreateOrganisationCommand_1.CreateOrganisationCommand,
    CreatePackageCommand: CreatePackageCommand_1.CreatePackageCommand,
    CreatePackageGroupCommand: CreatePackageGroupCommand_1.CreatePackageGroupCommand,
    CreatePackageV2Command: CreatePackageV2Command_1.CreatePackageV2Command,
    CreateReleaseCommand: CreateReleaseCommand_1.CreateReleaseCommand,
    DeleteDimensionCommand: DeleteDimensionCommand_1.DeleteDimensionCommand,
    GetPackageGroupCommand: GetPackageGroupCommand_1.GetPackageGroupCommand,
    GetPackageV2ByTagCommand: GetPackageV2ByTagCommand_1.GetPackageV2ByTagCommand,
    GetPackageV2ByVersionCommand: GetPackageV2ByVersionCommand_1.GetPackageV2ByVersionCommand,
    GetReleaseCommand: GetReleaseCommand_1.GetReleaseCommand,
    GetUserCommand: GetUserCommand_1.GetUserCommand,
    ListDimensionsCommand: ListDimensionsCommand_1.ListDimensionsCommand,
    ListFilesCommand: ListFilesCommand_1.ListFilesCommand,
    ListOrganisationsCommand: ListOrganisationsCommand_1.ListOrganisationsCommand,
    ListPackageGroupsCommand: ListPackageGroupsCommand_1.ListPackageGroupsCommand,
    ListPackagesCommand: ListPackagesCommand_1.ListPackagesCommand,
    ListPackagesV2Command: ListPackagesV2Command_1.ListPackagesV2Command,
    ListReleasesCommand: ListReleasesCommand_1.ListReleasesCommand,
    PostLoginCommand: PostLoginCommand_1.PostLoginCommand,
    RequestOrganisationCommand: RequestOrganisationCommand_1.RequestOrganisationCommand,
    ServeReleaseCommand: ServeReleaseCommand_1.ServeReleaseCommand,
    ServeReleaseV2Command: ServeReleaseV2Command_1.ServeReleaseV2Command,
    UpdateDimensionCommand: UpdateDimensionCommand_1.UpdateDimensionCommand,
    UpdatePackageGroupNameCommand: UpdatePackageGroupNameCommand_1.UpdatePackageGroupNameCommand,
    UploadFileCommand: UploadFileCommand_1.UploadFileCommand,
};
class Airborne extends AirborneClient_1.AirborneClient {
}
exports.Airborne = Airborne;
(0, smithy_client_1.createAggregatedClient)(commands, Airborne);
