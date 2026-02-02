// smithy-typescript generated code
import {
  AirborneClient,
  AirborneClientConfig,
} from "./AirborneClient";
import {
  CreateApplicationCommand,
  CreateApplicationCommandInput,
  CreateApplicationCommandOutput,
} from "./commands/CreateApplicationCommand";
import {
  CreateDimensionCommand,
  CreateDimensionCommandInput,
  CreateDimensionCommandOutput,
} from "./commands/CreateDimensionCommand";
import {
  CreateFileCommand,
  CreateFileCommandInput,
  CreateFileCommandOutput,
} from "./commands/CreateFileCommand";
import {
  CreateOrganisationCommand,
  CreateOrganisationCommandInput,
  CreateOrganisationCommandOutput,
} from "./commands/CreateOrganisationCommand";
import {
  CreatePackageCommand,
  CreatePackageCommandInput,
  CreatePackageCommandOutput,
} from "./commands/CreatePackageCommand";
import {
  CreatePackageGroupCommand,
  CreatePackageGroupCommandInput,
  CreatePackageGroupCommandOutput,
} from "./commands/CreatePackageGroupCommand";
import {
  CreatePackageV2Command,
  CreatePackageV2CommandInput,
  CreatePackageV2CommandOutput,
} from "./commands/CreatePackageV2Command";
import {
  CreateReleaseCommand,
  CreateReleaseCommandInput,
  CreateReleaseCommandOutput,
} from "./commands/CreateReleaseCommand";
import {
  DeleteDimensionCommand,
  DeleteDimensionCommandInput,
  DeleteDimensionCommandOutput,
} from "./commands/DeleteDimensionCommand";
import {
  GetPackageGroupCommand,
  GetPackageGroupCommandInput,
  GetPackageGroupCommandOutput,
} from "./commands/GetPackageGroupCommand";
import {
  GetPackageV2ByTagCommand,
  GetPackageV2ByTagCommandInput,
  GetPackageV2ByTagCommandOutput,
} from "./commands/GetPackageV2ByTagCommand";
import {
  GetPackageV2ByVersionCommand,
  GetPackageV2ByVersionCommandInput,
  GetPackageV2ByVersionCommandOutput,
} from "./commands/GetPackageV2ByVersionCommand";
import {
  GetReleaseCommand,
  GetReleaseCommandInput,
  GetReleaseCommandOutput,
} from "./commands/GetReleaseCommand";
import {
  GetUserCommand,
  GetUserCommandInput,
  GetUserCommandOutput,
} from "./commands/GetUserCommand";
import {
  ListDimensionsCommand,
  ListDimensionsCommandInput,
  ListDimensionsCommandOutput,
} from "./commands/ListDimensionsCommand";
import {
  ListFilesCommand,
  ListFilesCommandInput,
  ListFilesCommandOutput,
} from "./commands/ListFilesCommand";
import {
  ListOrganisationsCommand,
  ListOrganisationsCommandInput,
  ListOrganisationsCommandOutput,
} from "./commands/ListOrganisationsCommand";
import {
  ListPackageGroupsCommand,
  ListPackageGroupsCommandInput,
  ListPackageGroupsCommandOutput,
} from "./commands/ListPackageGroupsCommand";
import {
  ListPackagesCommand,
  ListPackagesCommandInput,
  ListPackagesCommandOutput,
} from "./commands/ListPackagesCommand";
import {
  ListPackagesV2Command,
  ListPackagesV2CommandInput,
  ListPackagesV2CommandOutput,
} from "./commands/ListPackagesV2Command";
import {
  ListReleasesCommand,
  ListReleasesCommandInput,
  ListReleasesCommandOutput,
} from "./commands/ListReleasesCommand";
import {
  PostLoginCommand,
  PostLoginCommandInput,
  PostLoginCommandOutput,
} from "./commands/PostLoginCommand";
import {
  RequestOrganisationCommand,
  RequestOrganisationCommandInput,
  RequestOrganisationCommandOutput,
} from "./commands/RequestOrganisationCommand";
import {
  ServeReleaseCommand,
  ServeReleaseCommandInput,
  ServeReleaseCommandOutput,
} from "./commands/ServeReleaseCommand";
import {
  ServeReleaseV2Command,
  ServeReleaseV2CommandInput,
  ServeReleaseV2CommandOutput,
} from "./commands/ServeReleaseV2Command";
import {
  UpdateDimensionCommand,
  UpdateDimensionCommandInput,
  UpdateDimensionCommandOutput,
} from "./commands/UpdateDimensionCommand";
import {
  UpdatePackageGroupNameCommand,
  UpdatePackageGroupNameCommandInput,
  UpdatePackageGroupNameCommandOutput,
} from "./commands/UpdatePackageGroupNameCommand";
import {
  UploadFileCommand,
  UploadFileCommandInput,
  UploadFileCommandOutput,
} from "./commands/UploadFileCommand";
import { createAggregatedClient } from "@smithy/smithy-client";
import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";

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
}

export interface Airborne {
  /**
   * @see {@link CreateApplicationCommand}
   */
  createApplication(
    args: CreateApplicationCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreateApplicationCommandOutput>;
  createApplication(
    args: CreateApplicationCommandInput,
    cb: (err: any, data?: CreateApplicationCommandOutput) => void
  ): void;
  createApplication(
    args: CreateApplicationCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreateApplicationCommandOutput) => void
  ): void;

  /**
   * @see {@link CreateDimensionCommand}
   */
  createDimension(
    args: CreateDimensionCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreateDimensionCommandOutput>;
  createDimension(
    args: CreateDimensionCommandInput,
    cb: (err: any, data?: CreateDimensionCommandOutput) => void
  ): void;
  createDimension(
    args: CreateDimensionCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreateDimensionCommandOutput) => void
  ): void;

  /**
   * @see {@link CreateFileCommand}
   */
  createFile(
    args: CreateFileCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreateFileCommandOutput>;
  createFile(
    args: CreateFileCommandInput,
    cb: (err: any, data?: CreateFileCommandOutput) => void
  ): void;
  createFile(
    args: CreateFileCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreateFileCommandOutput) => void
  ): void;

  /**
   * @see {@link CreateOrganisationCommand}
   */
  createOrganisation(
    args: CreateOrganisationCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreateOrganisationCommandOutput>;
  createOrganisation(
    args: CreateOrganisationCommandInput,
    cb: (err: any, data?: CreateOrganisationCommandOutput) => void
  ): void;
  createOrganisation(
    args: CreateOrganisationCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreateOrganisationCommandOutput) => void
  ): void;

  /**
   * @see {@link CreatePackageCommand}
   */
  createPackage(
    args: CreatePackageCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreatePackageCommandOutput>;
  createPackage(
    args: CreatePackageCommandInput,
    cb: (err: any, data?: CreatePackageCommandOutput) => void
  ): void;
  createPackage(
    args: CreatePackageCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreatePackageCommandOutput) => void
  ): void;

  /**
   * @see {@link CreatePackageGroupCommand}
   */
  createPackageGroup(
    args: CreatePackageGroupCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreatePackageGroupCommandOutput>;
  createPackageGroup(
    args: CreatePackageGroupCommandInput,
    cb: (err: any, data?: CreatePackageGroupCommandOutput) => void
  ): void;
  createPackageGroup(
    args: CreatePackageGroupCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreatePackageGroupCommandOutput) => void
  ): void;

  /**
   * @see {@link CreatePackageV2Command}
   */
  createPackageV2(
    args: CreatePackageV2CommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreatePackageV2CommandOutput>;
  createPackageV2(
    args: CreatePackageV2CommandInput,
    cb: (err: any, data?: CreatePackageV2CommandOutput) => void
  ): void;
  createPackageV2(
    args: CreatePackageV2CommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreatePackageV2CommandOutput) => void
  ): void;

  /**
   * @see {@link CreateReleaseCommand}
   */
  createRelease(
    args: CreateReleaseCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<CreateReleaseCommandOutput>;
  createRelease(
    args: CreateReleaseCommandInput,
    cb: (err: any, data?: CreateReleaseCommandOutput) => void
  ): void;
  createRelease(
    args: CreateReleaseCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CreateReleaseCommandOutput) => void
  ): void;

  /**
   * @see {@link DeleteDimensionCommand}
   */
  deleteDimension(
    args: DeleteDimensionCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<DeleteDimensionCommandOutput>;
  deleteDimension(
    args: DeleteDimensionCommandInput,
    cb: (err: any, data?: DeleteDimensionCommandOutput) => void
  ): void;
  deleteDimension(
    args: DeleteDimensionCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: DeleteDimensionCommandOutput) => void
  ): void;

  /**
   * @see {@link GetPackageGroupCommand}
   */
  getPackageGroup(
    args: GetPackageGroupCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<GetPackageGroupCommandOutput>;
  getPackageGroup(
    args: GetPackageGroupCommandInput,
    cb: (err: any, data?: GetPackageGroupCommandOutput) => void
  ): void;
  getPackageGroup(
    args: GetPackageGroupCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetPackageGroupCommandOutput) => void
  ): void;

  /**
   * @see {@link GetPackageV2ByTagCommand}
   */
  getPackageV2ByTag(
    args: GetPackageV2ByTagCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<GetPackageV2ByTagCommandOutput>;
  getPackageV2ByTag(
    args: GetPackageV2ByTagCommandInput,
    cb: (err: any, data?: GetPackageV2ByTagCommandOutput) => void
  ): void;
  getPackageV2ByTag(
    args: GetPackageV2ByTagCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetPackageV2ByTagCommandOutput) => void
  ): void;

  /**
   * @see {@link GetPackageV2ByVersionCommand}
   */
  getPackageV2ByVersion(
    args: GetPackageV2ByVersionCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<GetPackageV2ByVersionCommandOutput>;
  getPackageV2ByVersion(
    args: GetPackageV2ByVersionCommandInput,
    cb: (err: any, data?: GetPackageV2ByVersionCommandOutput) => void
  ): void;
  getPackageV2ByVersion(
    args: GetPackageV2ByVersionCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetPackageV2ByVersionCommandOutput) => void
  ): void;

  /**
   * @see {@link GetReleaseCommand}
   */
  getRelease(
    args: GetReleaseCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<GetReleaseCommandOutput>;
  getRelease(
    args: GetReleaseCommandInput,
    cb: (err: any, data?: GetReleaseCommandOutput) => void
  ): void;
  getRelease(
    args: GetReleaseCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetReleaseCommandOutput) => void
  ): void;

  /**
   * @see {@link GetUserCommand}
   */
  getUser(): Promise<GetUserCommandOutput>;
  getUser(
    args: GetUserCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<GetUserCommandOutput>;
  getUser(
    args: GetUserCommandInput,
    cb: (err: any, data?: GetUserCommandOutput) => void
  ): void;
  getUser(
    args: GetUserCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetUserCommandOutput) => void
  ): void;

  /**
   * @see {@link ListDimensionsCommand}
   */
  listDimensions(
    args: ListDimensionsCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListDimensionsCommandOutput>;
  listDimensions(
    args: ListDimensionsCommandInput,
    cb: (err: any, data?: ListDimensionsCommandOutput) => void
  ): void;
  listDimensions(
    args: ListDimensionsCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListDimensionsCommandOutput) => void
  ): void;

  /**
   * @see {@link ListFilesCommand}
   */
  listFiles(
    args: ListFilesCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListFilesCommandOutput>;
  listFiles(
    args: ListFilesCommandInput,
    cb: (err: any, data?: ListFilesCommandOutput) => void
  ): void;
  listFiles(
    args: ListFilesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListFilesCommandOutput) => void
  ): void;

  /**
   * @see {@link ListOrganisationsCommand}
   */
  listOrganisations(): Promise<ListOrganisationsCommandOutput>;
  listOrganisations(
    args: ListOrganisationsCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListOrganisationsCommandOutput>;
  listOrganisations(
    args: ListOrganisationsCommandInput,
    cb: (err: any, data?: ListOrganisationsCommandOutput) => void
  ): void;
  listOrganisations(
    args: ListOrganisationsCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListOrganisationsCommandOutput) => void
  ): void;

  /**
   * @see {@link ListPackageGroupsCommand}
   */
  listPackageGroups(
    args: ListPackageGroupsCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListPackageGroupsCommandOutput>;
  listPackageGroups(
    args: ListPackageGroupsCommandInput,
    cb: (err: any, data?: ListPackageGroupsCommandOutput) => void
  ): void;
  listPackageGroups(
    args: ListPackageGroupsCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListPackageGroupsCommandOutput) => void
  ): void;

  /**
   * @see {@link ListPackagesCommand}
   */
  listPackages(
    args: ListPackagesCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListPackagesCommandOutput>;
  listPackages(
    args: ListPackagesCommandInput,
    cb: (err: any, data?: ListPackagesCommandOutput) => void
  ): void;
  listPackages(
    args: ListPackagesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListPackagesCommandOutput) => void
  ): void;

  /**
   * @see {@link ListPackagesV2Command}
   */
  listPackagesV2(
    args: ListPackagesV2CommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListPackagesV2CommandOutput>;
  listPackagesV2(
    args: ListPackagesV2CommandInput,
    cb: (err: any, data?: ListPackagesV2CommandOutput) => void
  ): void;
  listPackagesV2(
    args: ListPackagesV2CommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListPackagesV2CommandOutput) => void
  ): void;

  /**
   * @see {@link ListReleasesCommand}
   */
  listReleases(
    args: ListReleasesCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ListReleasesCommandOutput>;
  listReleases(
    args: ListReleasesCommandInput,
    cb: (err: any, data?: ListReleasesCommandOutput) => void
  ): void;
  listReleases(
    args: ListReleasesCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ListReleasesCommandOutput) => void
  ): void;

  /**
   * @see {@link PostLoginCommand}
   */
  postLogin(
    args: PostLoginCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<PostLoginCommandOutput>;
  postLogin(
    args: PostLoginCommandInput,
    cb: (err: any, data?: PostLoginCommandOutput) => void
  ): void;
  postLogin(
    args: PostLoginCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: PostLoginCommandOutput) => void
  ): void;

  /**
   * @see {@link RequestOrganisationCommand}
   */
  requestOrganisation(
    args: RequestOrganisationCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<RequestOrganisationCommandOutput>;
  requestOrganisation(
    args: RequestOrganisationCommandInput,
    cb: (err: any, data?: RequestOrganisationCommandOutput) => void
  ): void;
  requestOrganisation(
    args: RequestOrganisationCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: RequestOrganisationCommandOutput) => void
  ): void;

  /**
   * @see {@link ServeReleaseCommand}
   */
  serveRelease(
    args: ServeReleaseCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ServeReleaseCommandOutput>;
  serveRelease(
    args: ServeReleaseCommandInput,
    cb: (err: any, data?: ServeReleaseCommandOutput) => void
  ): void;
  serveRelease(
    args: ServeReleaseCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ServeReleaseCommandOutput) => void
  ): void;

  /**
   * @see {@link ServeReleaseV2Command}
   */
  serveReleaseV2(
    args: ServeReleaseV2CommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<ServeReleaseV2CommandOutput>;
  serveReleaseV2(
    args: ServeReleaseV2CommandInput,
    cb: (err: any, data?: ServeReleaseV2CommandOutput) => void
  ): void;
  serveReleaseV2(
    args: ServeReleaseV2CommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ServeReleaseV2CommandOutput) => void
  ): void;

  /**
   * @see {@link UpdateDimensionCommand}
   */
  updateDimension(
    args: UpdateDimensionCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<UpdateDimensionCommandOutput>;
  updateDimension(
    args: UpdateDimensionCommandInput,
    cb: (err: any, data?: UpdateDimensionCommandOutput) => void
  ): void;
  updateDimension(
    args: UpdateDimensionCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: UpdateDimensionCommandOutput) => void
  ): void;

  /**
   * @see {@link UpdatePackageGroupNameCommand}
   */
  updatePackageGroupName(
    args: UpdatePackageGroupNameCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<UpdatePackageGroupNameCommandOutput>;
  updatePackageGroupName(
    args: UpdatePackageGroupNameCommandInput,
    cb: (err: any, data?: UpdatePackageGroupNameCommandOutput) => void
  ): void;
  updatePackageGroupName(
    args: UpdatePackageGroupNameCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: UpdatePackageGroupNameCommandOutput) => void
  ): void;

  /**
   * @see {@link UploadFileCommand}
   */
  uploadFile(
    args: UploadFileCommandInput,
    options?: __HttpHandlerOptions,
  ): Promise<UploadFileCommandOutput>;
  uploadFile(
    args: UploadFileCommandInput,
    cb: (err: any, data?: UploadFileCommandOutput) => void
  ): void;
  uploadFile(
    args: UploadFileCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: UploadFileCommandOutput) => void
  ): void;

}

/**
 * Service for managing OTA updates and configurations
 * @public
 */
export class Airborne extends AirborneClient implements Airborne {}
createAggregatedClient(commands, Airborne);
