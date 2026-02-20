import { AirborneClient, } from "./AirborneClient";
import { CreateApplicationCommand, } from "./commands/CreateApplicationCommand";
import { CreateDimensionCommand, } from "./commands/CreateDimensionCommand";
import { CreateFileCommand, } from "./commands/CreateFileCommand";
import { CreateOrganisationCommand, } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommand, } from "./commands/CreatePackageCommand";
import { CreatePackageGroupCommand, } from "./commands/CreatePackageGroupCommand";
import { CreatePackageV2Command, } from "./commands/CreatePackageV2Command";
import { CreateReleaseCommand, } from "./commands/CreateReleaseCommand";
import { DeleteDimensionCommand, } from "./commands/DeleteDimensionCommand";
import { GetPackageGroupCommand, } from "./commands/GetPackageGroupCommand";
import { GetPackageV2ByTagCommand, } from "./commands/GetPackageV2ByTagCommand";
import { GetPackageV2ByVersionCommand, } from "./commands/GetPackageV2ByVersionCommand";
import { GetReleaseCommand, } from "./commands/GetReleaseCommand";
import { GetUserCommand, } from "./commands/GetUserCommand";
import { ListDimensionsCommand, } from "./commands/ListDimensionsCommand";
import { ListFilesCommand, } from "./commands/ListFilesCommand";
import { ListOrganisationsCommand, } from "./commands/ListOrganisationsCommand";
import { ListPackageGroupsCommand, } from "./commands/ListPackageGroupsCommand";
import { ListPackagesCommand, } from "./commands/ListPackagesCommand";
import { ListPackagesV2Command, } from "./commands/ListPackagesV2Command";
import { ListReleasesCommand, } from "./commands/ListReleasesCommand";
import { PostLoginCommand, } from "./commands/PostLoginCommand";
import { RequestOrganisationCommand, } from "./commands/RequestOrganisationCommand";
import { ServeReleaseCommand, } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2Command, } from "./commands/ServeReleaseV2Command";
import { UpdateDimensionCommand, } from "./commands/UpdateDimensionCommand";
import { UpdatePackageGroupNameCommand, } from "./commands/UpdatePackageGroupNameCommand";
import { UploadFileCommand, } from "./commands/UploadFileCommand";
import { createAggregatedClient } from "@smithy/smithy-client";
const commands = {
    CreateApplicationCommand,
    CreateDimensionCommand,
    CreateFileCommand,
    CreateOrganisationCommand,
    CreatePackageCommand,
    CreatePackageGroupCommand,
    CreatePackageV2Command,
    CreateReleaseCommand,
    DeleteDimensionCommand,
    GetPackageGroupCommand,
    GetPackageV2ByTagCommand,
    GetPackageV2ByVersionCommand,
    GetReleaseCommand,
    GetUserCommand,
    ListDimensionsCommand,
    ListFilesCommand,
    ListOrganisationsCommand,
    ListPackageGroupsCommand,
    ListPackagesCommand,
    ListPackagesV2Command,
    ListReleasesCommand,
    PostLoginCommand,
    RequestOrganisationCommand,
    ServeReleaseCommand,
    ServeReleaseV2Command,
    UpdateDimensionCommand,
    UpdatePackageGroupNameCommand,
    UploadFileCommand,
};
export class Airborne extends AirborneClient {
}
createAggregatedClient(commands, Airborne);
