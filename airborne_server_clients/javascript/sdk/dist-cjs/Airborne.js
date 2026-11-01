"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Airborne = void 0;
const AirborneClient_1 = require("./AirborneClient");
const CreateApplicationCommand_1 = require("./commands/CreateApplicationCommand");
const CreateControlCenterGroupCommand_1 = require("./commands/CreateControlCenterGroupCommand");
const CreateDimensionCommand_1 = require("./commands/CreateDimensionCommand");
const CreateFileCommand_1 = require("./commands/CreateFileCommand");
const CreateOrganisationCommand_1 = require("./commands/CreateOrganisationCommand");
const CreatePackageCommand_1 = require("./commands/CreatePackageCommand");
const CreateReleaseCommand_1 = require("./commands/CreateReleaseCommand");
const DeleteControlCenterGroupCommand_1 = require("./commands/DeleteControlCenterGroupCommand");
const DeleteDimensionCommand_1 = require("./commands/DeleteDimensionCommand");
const GetControlCenterOverviewCommand_1 = require("./commands/GetControlCenterOverviewCommand");
const GetControlCenterReleaseEventsCommand_1 = require("./commands/GetControlCenterReleaseEventsCommand");
const GetControlCenterRollbackPreviewCommand_1 = require("./commands/GetControlCenterRollbackPreviewCommand");
const GetReleaseCommand_1 = require("./commands/GetReleaseCommand");
const GetUserCommand_1 = require("./commands/GetUserCommand");
const ListControlCenterGroupsCommand_1 = require("./commands/ListControlCenterGroupsCommand");
const ListControlCenterOperationsCommand_1 = require("./commands/ListControlCenterOperationsCommand");
const ListDimensionsCommand_1 = require("./commands/ListDimensionsCommand");
const ListFileGroupsCommand_1 = require("./commands/ListFileGroupsCommand");
const ListFilesCommand_1 = require("./commands/ListFilesCommand");
const ListOrganisationsCommand_1 = require("./commands/ListOrganisationsCommand");
const ListPackagesCommand_1 = require("./commands/ListPackagesCommand");
const ListReleasesCommand_1 = require("./commands/ListReleasesCommand");
const PostLoginCommand_1 = require("./commands/PostLoginCommand");
const RequestOrganisationCommand_1 = require("./commands/RequestOrganisationCommand");
const ResolveControlCenterOperationCommand_1 = require("./commands/ResolveControlCenterOperationCommand");
const RollbackReleaseCommand_1 = require("./commands/RollbackReleaseCommand");
const ServeReleaseCommand_1 = require("./commands/ServeReleaseCommand");
const ServeReleaseV2Command_1 = require("./commands/ServeReleaseV2Command");
const UpdateControlCenterGroupCommand_1 = require("./commands/UpdateControlCenterGroupCommand");
const UpdateDimensionCommand_1 = require("./commands/UpdateDimensionCommand");
const UpdateFileCommand_1 = require("./commands/UpdateFileCommand");
const UploadFileCommand_1 = require("./commands/UploadFileCommand");
const smithy_client_1 = require("@smithy/smithy-client");
const commands = {
    CreateApplicationCommand: CreateApplicationCommand_1.CreateApplicationCommand,
    CreateControlCenterGroupCommand: CreateControlCenterGroupCommand_1.CreateControlCenterGroupCommand,
    CreateDimensionCommand: CreateDimensionCommand_1.CreateDimensionCommand,
    CreateFileCommand: CreateFileCommand_1.CreateFileCommand,
    CreateOrganisationCommand: CreateOrganisationCommand_1.CreateOrganisationCommand,
    CreatePackageCommand: CreatePackageCommand_1.CreatePackageCommand,
    CreateReleaseCommand: CreateReleaseCommand_1.CreateReleaseCommand,
    DeleteControlCenterGroupCommand: DeleteControlCenterGroupCommand_1.DeleteControlCenterGroupCommand,
    DeleteDimensionCommand: DeleteDimensionCommand_1.DeleteDimensionCommand,
    GetControlCenterOverviewCommand: GetControlCenterOverviewCommand_1.GetControlCenterOverviewCommand,
    GetControlCenterReleaseEventsCommand: GetControlCenterReleaseEventsCommand_1.GetControlCenterReleaseEventsCommand,
    GetControlCenterRollbackPreviewCommand: GetControlCenterRollbackPreviewCommand_1.GetControlCenterRollbackPreviewCommand,
    GetReleaseCommand: GetReleaseCommand_1.GetReleaseCommand,
    GetUserCommand: GetUserCommand_1.GetUserCommand,
    ListControlCenterGroupsCommand: ListControlCenterGroupsCommand_1.ListControlCenterGroupsCommand,
    ListControlCenterOperationsCommand: ListControlCenterOperationsCommand_1.ListControlCenterOperationsCommand,
    ListDimensionsCommand: ListDimensionsCommand_1.ListDimensionsCommand,
    ListFileGroupsCommand: ListFileGroupsCommand_1.ListFileGroupsCommand,
    ListFilesCommand: ListFilesCommand_1.ListFilesCommand,
    ListOrganisationsCommand: ListOrganisationsCommand_1.ListOrganisationsCommand,
    ListPackagesCommand: ListPackagesCommand_1.ListPackagesCommand,
    ListReleasesCommand: ListReleasesCommand_1.ListReleasesCommand,
    PostLoginCommand: PostLoginCommand_1.PostLoginCommand,
    RequestOrganisationCommand: RequestOrganisationCommand_1.RequestOrganisationCommand,
    ResolveControlCenterOperationCommand: ResolveControlCenterOperationCommand_1.ResolveControlCenterOperationCommand,
    RollbackReleaseCommand: RollbackReleaseCommand_1.RollbackReleaseCommand,
    ServeReleaseCommand: ServeReleaseCommand_1.ServeReleaseCommand,
    ServeReleaseV2Command: ServeReleaseV2Command_1.ServeReleaseV2Command,
    UpdateControlCenterGroupCommand: UpdateControlCenterGroupCommand_1.UpdateControlCenterGroupCommand,
    UpdateDimensionCommand: UpdateDimensionCommand_1.UpdateDimensionCommand,
    UpdateFileCommand: UpdateFileCommand_1.UpdateFileCommand,
    UploadFileCommand: UploadFileCommand_1.UploadFileCommand,
};
class Airborne extends AirborneClient_1.AirborneClient {
}
exports.Airborne = Airborne;
(0, smithy_client_1.createAggregatedClient)(commands, Airborne);
