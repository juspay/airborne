import { AirborneClient, } from "./AirborneClient";
import { CreateApplicationCommand, } from "./commands/CreateApplicationCommand";
import { CreateDimensionCommand, } from "./commands/CreateDimensionCommand";
import { CreateFileCommand, } from "./commands/CreateFileCommand";
import { CreateOrganisationCommand, } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommand, } from "./commands/CreatePackageCommand";
import { CreateReleaseCommand, } from "./commands/CreateReleaseCommand";
import { DeleteDimensionCommand, } from "./commands/DeleteDimensionCommand";
import { GetReleaseCommand, } from "./commands/GetReleaseCommand";
import { GetUserCommand, } from "./commands/GetUserCommand";
import { ListDimensionsCommand, } from "./commands/ListDimensionsCommand";
import { ListFilesCommand, } from "./commands/ListFilesCommand";
import { ListOrganisationsCommand, } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommand, } from "./commands/ListPackagesCommand";
import { ListReleasesCommand, } from "./commands/ListReleasesCommand";
import { PostLoginCommand, } from "./commands/PostLoginCommand";
import { RequestOrganisationCommand, } from "./commands/RequestOrganisationCommand";
import { ServeReleaseCommand, } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2Command, } from "./commands/ServeReleaseV2Command";
import { UpdateDimensionCommand, } from "./commands/UpdateDimensionCommand";
import { UploadFileCommand, } from "./commands/UploadFileCommand";
import { createAggregatedClient } from "@smithy/smithy-client";
const commands = {
    CreateApplicationCommand,
    CreateDimensionCommand,
    CreateFileCommand,
    CreateOrganisationCommand,
    CreatePackageCommand,
    CreateReleaseCommand,
    DeleteDimensionCommand,
    GetReleaseCommand,
    GetUserCommand,
    ListDimensionsCommand,
    ListFilesCommand,
    ListOrganisationsCommand,
    ListPackagesCommand,
    ListReleasesCommand,
    PostLoginCommand,
    RequestOrganisationCommand,
    ServeReleaseCommand,
    ServeReleaseV2Command,
    UpdateDimensionCommand,
    UploadFileCommand,
};
export class Airborne extends AirborneClient {
}
createAggregatedClient(commands, Airborne);
