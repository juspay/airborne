import { AirborneClient } from "./AirborneClient";
import { CreateApplicationCommandInput, CreateApplicationCommandOutput } from "./commands/CreateApplicationCommand";
import { CreateDimensionCommandInput, CreateDimensionCommandOutput } from "./commands/CreateDimensionCommand";
import { CreateFileCommandInput, CreateFileCommandOutput } from "./commands/CreateFileCommand";
import { CreateOrganisationCommandInput, CreateOrganisationCommandOutput } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommandInput, CreatePackageCommandOutput } from "./commands/CreatePackageCommand";
import { CreateReleaseCommandInput, CreateReleaseCommandOutput } from "./commands/CreateReleaseCommand";
import { DeleteDimensionCommandInput, DeleteDimensionCommandOutput } from "./commands/DeleteDimensionCommand";
import { GetReleaseCommandInput, GetReleaseCommandOutput } from "./commands/GetReleaseCommand";
import { GetUserCommandInput, GetUserCommandOutput } from "./commands/GetUserCommand";
import { ListDimensionsCommandInput, ListDimensionsCommandOutput } from "./commands/ListDimensionsCommand";
import { ListFilesCommandInput, ListFilesCommandOutput } from "./commands/ListFilesCommand";
import { ListOrganisationsCommandInput, ListOrganisationsCommandOutput } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommandInput, ListPackagesCommandOutput } from "./commands/ListPackagesCommand";
import { ListReleasesCommandInput, ListReleasesCommandOutput } from "./commands/ListReleasesCommand";
import { PostLoginCommandInput, PostLoginCommandOutput } from "./commands/PostLoginCommand";
import { RequestOrganisationCommandInput, RequestOrganisationCommandOutput } from "./commands/RequestOrganisationCommand";
import { ServeReleaseCommandInput, ServeReleaseCommandOutput } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput } from "./commands/ServeReleaseV2Command";
import { UpdateDimensionCommandInput, UpdateDimensionCommandOutput } from "./commands/UpdateDimensionCommand";
import { UploadFileCommandInput, UploadFileCommandOutput } from "./commands/UploadFileCommand";
import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";
export interface Airborne {
    /**
     * @see {@link CreateApplicationCommand}
     */
    createApplication(args: CreateApplicationCommandInput, options?: __HttpHandlerOptions): Promise<CreateApplicationCommandOutput>;
    createApplication(args: CreateApplicationCommandInput, cb: (err: any, data?: CreateApplicationCommandOutput) => void): void;
    createApplication(args: CreateApplicationCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateApplicationCommandOutput) => void): void;
    /**
     * @see {@link CreateDimensionCommand}
     */
    createDimension(args: CreateDimensionCommandInput, options?: __HttpHandlerOptions): Promise<CreateDimensionCommandOutput>;
    createDimension(args: CreateDimensionCommandInput, cb: (err: any, data?: CreateDimensionCommandOutput) => void): void;
    createDimension(args: CreateDimensionCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateDimensionCommandOutput) => void): void;
    /**
     * @see {@link CreateFileCommand}
     */
    createFile(args: CreateFileCommandInput, options?: __HttpHandlerOptions): Promise<CreateFileCommandOutput>;
    createFile(args: CreateFileCommandInput, cb: (err: any, data?: CreateFileCommandOutput) => void): void;
    createFile(args: CreateFileCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateFileCommandOutput) => void): void;
    /**
     * @see {@link CreateOrganisationCommand}
     */
    createOrganisation(args: CreateOrganisationCommandInput, options?: __HttpHandlerOptions): Promise<CreateOrganisationCommandOutput>;
    createOrganisation(args: CreateOrganisationCommandInput, cb: (err: any, data?: CreateOrganisationCommandOutput) => void): void;
    createOrganisation(args: CreateOrganisationCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateOrganisationCommandOutput) => void): void;
    /**
     * @see {@link CreatePackageCommand}
     */
    createPackage(args: CreatePackageCommandInput, options?: __HttpHandlerOptions): Promise<CreatePackageCommandOutput>;
    createPackage(args: CreatePackageCommandInput, cb: (err: any, data?: CreatePackageCommandOutput) => void): void;
    createPackage(args: CreatePackageCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreatePackageCommandOutput) => void): void;
    /**
     * @see {@link CreateReleaseCommand}
     */
    createRelease(args: CreateReleaseCommandInput, options?: __HttpHandlerOptions): Promise<CreateReleaseCommandOutput>;
    createRelease(args: CreateReleaseCommandInput, cb: (err: any, data?: CreateReleaseCommandOutput) => void): void;
    createRelease(args: CreateReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateReleaseCommandOutput) => void): void;
    /**
     * @see {@link DeleteDimensionCommand}
     */
    deleteDimension(args: DeleteDimensionCommandInput, options?: __HttpHandlerOptions): Promise<DeleteDimensionCommandOutput>;
    deleteDimension(args: DeleteDimensionCommandInput, cb: (err: any, data?: DeleteDimensionCommandOutput) => void): void;
    deleteDimension(args: DeleteDimensionCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: DeleteDimensionCommandOutput) => void): void;
    /**
     * @see {@link GetReleaseCommand}
     */
    getRelease(args: GetReleaseCommandInput, options?: __HttpHandlerOptions): Promise<GetReleaseCommandOutput>;
    getRelease(args: GetReleaseCommandInput, cb: (err: any, data?: GetReleaseCommandOutput) => void): void;
    getRelease(args: GetReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetReleaseCommandOutput) => void): void;
    /**
     * @see {@link GetUserCommand}
     */
    getUser(): Promise<GetUserCommandOutput>;
    getUser(args: GetUserCommandInput, options?: __HttpHandlerOptions): Promise<GetUserCommandOutput>;
    getUser(args: GetUserCommandInput, cb: (err: any, data?: GetUserCommandOutput) => void): void;
    getUser(args: GetUserCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetUserCommandOutput) => void): void;
    /**
     * @see {@link ListDimensionsCommand}
     */
    listDimensions(args: ListDimensionsCommandInput, options?: __HttpHandlerOptions): Promise<ListDimensionsCommandOutput>;
    listDimensions(args: ListDimensionsCommandInput, cb: (err: any, data?: ListDimensionsCommandOutput) => void): void;
    listDimensions(args: ListDimensionsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListDimensionsCommandOutput) => void): void;
    /**
     * @see {@link ListFilesCommand}
     */
    listFiles(args: ListFilesCommandInput, options?: __HttpHandlerOptions): Promise<ListFilesCommandOutput>;
    listFiles(args: ListFilesCommandInput, cb: (err: any, data?: ListFilesCommandOutput) => void): void;
    listFiles(args: ListFilesCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListFilesCommandOutput) => void): void;
    /**
     * @see {@link ListOrganisationsCommand}
     */
    listOrganisations(): Promise<ListOrganisationsCommandOutput>;
    listOrganisations(args: ListOrganisationsCommandInput, options?: __HttpHandlerOptions): Promise<ListOrganisationsCommandOutput>;
    listOrganisations(args: ListOrganisationsCommandInput, cb: (err: any, data?: ListOrganisationsCommandOutput) => void): void;
    listOrganisations(args: ListOrganisationsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListOrganisationsCommandOutput) => void): void;
    /**
     * @see {@link ListPackagesCommand}
     */
    listPackages(args: ListPackagesCommandInput, options?: __HttpHandlerOptions): Promise<ListPackagesCommandOutput>;
    listPackages(args: ListPackagesCommandInput, cb: (err: any, data?: ListPackagesCommandOutput) => void): void;
    listPackages(args: ListPackagesCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListPackagesCommandOutput) => void): void;
    /**
     * @see {@link ListReleasesCommand}
     */
    listReleases(args: ListReleasesCommandInput, options?: __HttpHandlerOptions): Promise<ListReleasesCommandOutput>;
    listReleases(args: ListReleasesCommandInput, cb: (err: any, data?: ListReleasesCommandOutput) => void): void;
    listReleases(args: ListReleasesCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListReleasesCommandOutput) => void): void;
    /**
     * @see {@link PostLoginCommand}
     */
    postLogin(args: PostLoginCommandInput, options?: __HttpHandlerOptions): Promise<PostLoginCommandOutput>;
    postLogin(args: PostLoginCommandInput, cb: (err: any, data?: PostLoginCommandOutput) => void): void;
    postLogin(args: PostLoginCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: PostLoginCommandOutput) => void): void;
    /**
     * @see {@link RequestOrganisationCommand}
     */
    requestOrganisation(args: RequestOrganisationCommandInput, options?: __HttpHandlerOptions): Promise<RequestOrganisationCommandOutput>;
    requestOrganisation(args: RequestOrganisationCommandInput, cb: (err: any, data?: RequestOrganisationCommandOutput) => void): void;
    requestOrganisation(args: RequestOrganisationCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: RequestOrganisationCommandOutput) => void): void;
    /**
     * @see {@link ServeReleaseCommand}
     */
    serveRelease(args: ServeReleaseCommandInput, options?: __HttpHandlerOptions): Promise<ServeReleaseCommandOutput>;
    serveRelease(args: ServeReleaseCommandInput, cb: (err: any, data?: ServeReleaseCommandOutput) => void): void;
    serveRelease(args: ServeReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ServeReleaseCommandOutput) => void): void;
    /**
     * @see {@link ServeReleaseV2Command}
     */
    serveReleaseV2(args: ServeReleaseV2CommandInput, options?: __HttpHandlerOptions): Promise<ServeReleaseV2CommandOutput>;
    serveReleaseV2(args: ServeReleaseV2CommandInput, cb: (err: any, data?: ServeReleaseV2CommandOutput) => void): void;
    serveReleaseV2(args: ServeReleaseV2CommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ServeReleaseV2CommandOutput) => void): void;
    /**
     * @see {@link UpdateDimensionCommand}
     */
    updateDimension(args: UpdateDimensionCommandInput, options?: __HttpHandlerOptions): Promise<UpdateDimensionCommandOutput>;
    updateDimension(args: UpdateDimensionCommandInput, cb: (err: any, data?: UpdateDimensionCommandOutput) => void): void;
    updateDimension(args: UpdateDimensionCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UpdateDimensionCommandOutput) => void): void;
    /**
     * @see {@link UploadFileCommand}
     */
    uploadFile(args: UploadFileCommandInput, options?: __HttpHandlerOptions): Promise<UploadFileCommandOutput>;
    uploadFile(args: UploadFileCommandInput, cb: (err: any, data?: UploadFileCommandOutput) => void): void;
    uploadFile(args: UploadFileCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UploadFileCommandOutput) => void): void;
}
/**
 * Service for managing OTA updates and configurations
 * @public
 */
export declare class Airborne extends AirborneClient implements Airborne {
}
