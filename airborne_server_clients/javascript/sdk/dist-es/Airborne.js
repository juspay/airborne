import { AirborneClient, } from "./AirborneClient";
import { CreateApplicationCommand, } from "./commands/CreateApplicationCommand";
import { CreateControlCenterGroupCommand, } from "./commands/CreateControlCenterGroupCommand";
import { CreateDimensionCommand, } from "./commands/CreateDimensionCommand";
import { CreateFileCommand, } from "./commands/CreateFileCommand";
import { CreateOrganisationCommand, } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommand, } from "./commands/CreatePackageCommand";
import { CreateReleaseCommand, } from "./commands/CreateReleaseCommand";
import { DeleteControlCenterGroupCommand, } from "./commands/DeleteControlCenterGroupCommand";
import { DeleteDimensionCommand, } from "./commands/DeleteDimensionCommand";
import { GetControlCenterOverviewCommand, } from "./commands/GetControlCenterOverviewCommand";
import { GetControlCenterReleaseEventsCommand, } from "./commands/GetControlCenterReleaseEventsCommand";
import { GetControlCenterRollbackPreviewCommand, } from "./commands/GetControlCenterRollbackPreviewCommand";
import { GetReleaseCommand, } from "./commands/GetReleaseCommand";
import { GetUserCommand, } from "./commands/GetUserCommand";
import { ListControlCenterGroupsCommand, } from "./commands/ListControlCenterGroupsCommand";
import { ListControlCenterOperationsCommand, } from "./commands/ListControlCenterOperationsCommand";
import { ListDimensionsCommand, } from "./commands/ListDimensionsCommand";
import { ListFileGroupsCommand, } from "./commands/ListFileGroupsCommand";
import { ListFilesCommand, } from "./commands/ListFilesCommand";
import { ListOrganisationsCommand, } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommand, } from "./commands/ListPackagesCommand";
import { ListReleasesCommand, } from "./commands/ListReleasesCommand";
import { PostLoginCommand, } from "./commands/PostLoginCommand";
import { RequestOrganisationCommand, } from "./commands/RequestOrganisationCommand";
import { ResolveControlCenterOperationCommand, } from "./commands/ResolveControlCenterOperationCommand";
import { RollbackReleaseCommand, } from "./commands/RollbackReleaseCommand";
import { ServeReleaseCommand, } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2Command, } from "./commands/ServeReleaseV2Command";
import { UpdateControlCenterGroupCommand, } from "./commands/UpdateControlCenterGroupCommand";
import { UpdateDimensionCommand, } from "./commands/UpdateDimensionCommand";
import { UpdateFileCommand, } from "./commands/UpdateFileCommand";
import { UploadFileCommand, } from "./commands/UploadFileCommand";
import { createAggregatedClient } from "@smithy/smithy-client";
const commands = {
    CreateApplicationCommand,
    CreateControlCenterGroupCommand,
    CreateDimensionCommand,
    CreateFileCommand,
    CreateOrganisationCommand,
    CreatePackageCommand,
    CreateReleaseCommand,
    DeleteControlCenterGroupCommand,
    DeleteDimensionCommand,
    GetControlCenterOverviewCommand,
    GetControlCenterReleaseEventsCommand,
    GetControlCenterRollbackPreviewCommand,
    GetReleaseCommand,
    GetUserCommand,
    ListControlCenterGroupsCommand,
    ListControlCenterOperationsCommand,
    ListDimensionsCommand,
    ListFileGroupsCommand,
    ListFilesCommand,
    ListOrganisationsCommand,
    ListPackagesCommand,
    ListReleasesCommand,
    PostLoginCommand,
    RequestOrganisationCommand,
    ResolveControlCenterOperationCommand,
    RollbackReleaseCommand,
    ServeReleaseCommand,
    ServeReleaseV2Command,
    UpdateControlCenterGroupCommand,
    UpdateDimensionCommand,
    UpdateFileCommand,
    UploadFileCommand,
};
export class Airborne extends AirborneClient {
}
createAggregatedClient(commands, Airborne);
