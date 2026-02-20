import { CreateApplicationCommandInput, CreateApplicationCommandOutput } from "../commands/CreateApplicationCommand";
import { CreateDimensionCommandInput, CreateDimensionCommandOutput } from "../commands/CreateDimensionCommand";
import { CreateFileCommandInput, CreateFileCommandOutput } from "../commands/CreateFileCommand";
import { CreateOrganisationCommandInput, CreateOrganisationCommandOutput } from "../commands/CreateOrganisationCommand";
import { CreatePackageCommandInput, CreatePackageCommandOutput } from "../commands/CreatePackageCommand";
import { CreateReleaseCommandInput, CreateReleaseCommandOutput } from "../commands/CreateReleaseCommand";
import { DeleteDimensionCommandInput, DeleteDimensionCommandOutput } from "../commands/DeleteDimensionCommand";
import { GetReleaseCommandInput, GetReleaseCommandOutput } from "../commands/GetReleaseCommand";
import { GetUserCommandInput, GetUserCommandOutput } from "../commands/GetUserCommand";
import { ListDimensionsCommandInput, ListDimensionsCommandOutput } from "../commands/ListDimensionsCommand";
import { ListFilesCommandInput, ListFilesCommandOutput } from "../commands/ListFilesCommand";
import { ListOrganisationsCommandInput, ListOrganisationsCommandOutput } from "../commands/ListOrganisationsCommand";
import { ListPackagesCommandInput, ListPackagesCommandOutput } from "../commands/ListPackagesCommand";
import { ListReleasesCommandInput, ListReleasesCommandOutput } from "../commands/ListReleasesCommand";
import { ListVersionsCommandInput, ListVersionsCommandOutput } from "../commands/ListVersionsCommand";
import { PostLoginCommandInput, PostLoginCommandOutput } from "../commands/PostLoginCommand";
import { RequestOrganisationCommandInput, RequestOrganisationCommandOutput } from "../commands/RequestOrganisationCommand";
import { ServeReleaseCommandInput, ServeReleaseCommandOutput } from "../commands/ServeReleaseCommand";
import { ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput } from "../commands/ServeReleaseV2Command";
import { UpdateDimensionCommandInput, UpdateDimensionCommandOutput } from "../commands/UpdateDimensionCommand";
import { UploadFileCommandInput, UploadFileCommandOutput } from "../commands/UploadFileCommand";
import { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/protocol-http";
import { SerdeContext as __SerdeContext } from "@smithy/types";
/**
 * serializeAws_restJson1CreateApplicationCommand
 */
export declare const se_CreateApplicationCommand: (input: CreateApplicationCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateDimensionCommand
 */
export declare const se_CreateDimensionCommand: (input: CreateDimensionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateFileCommand
 */
export declare const se_CreateFileCommand: (input: CreateFileCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateOrganisationCommand
 */
export declare const se_CreateOrganisationCommand: (input: CreateOrganisationCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreatePackageCommand
 */
export declare const se_CreatePackageCommand: (input: CreatePackageCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateReleaseCommand
 */
export declare const se_CreateReleaseCommand: (input: CreateReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1DeleteDimensionCommand
 */
export declare const se_DeleteDimensionCommand: (input: DeleteDimensionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetReleaseCommand
 */
export declare const se_GetReleaseCommand: (input: GetReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetUserCommand
 */
export declare const se_GetUserCommand: (input: GetUserCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListDimensionsCommand
 */
export declare const se_ListDimensionsCommand: (input: ListDimensionsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListFilesCommand
 */
export declare const se_ListFilesCommand: (input: ListFilesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListOrganisationsCommand
 */
export declare const se_ListOrganisationsCommand: (input: ListOrganisationsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListPackagesCommand
 */
export declare const se_ListPackagesCommand: (input: ListPackagesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListReleasesCommand
 */
export declare const se_ListReleasesCommand: (input: ListReleasesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListVersionsCommand
 */
export declare const se_ListVersionsCommand: (input: ListVersionsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1PostLoginCommand
 */
export declare const se_PostLoginCommand: (input: PostLoginCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1RequestOrganisationCommand
 */
export declare const se_RequestOrganisationCommand: (input: RequestOrganisationCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ServeReleaseCommand
 */
export declare const se_ServeReleaseCommand: (input: ServeReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ServeReleaseV2Command
 */
export declare const se_ServeReleaseV2Command: (input: ServeReleaseV2CommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UpdateDimensionCommand
 */
export declare const se_UpdateDimensionCommand: (input: UpdateDimensionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UploadFileCommand
 */
export declare const se_UploadFileCommand: (input: UploadFileCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * deserializeAws_restJson1CreateApplicationCommand
 */
export declare const de_CreateApplicationCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateApplicationCommandOutput>;
/**
 * deserializeAws_restJson1CreateDimensionCommand
 */
export declare const de_CreateDimensionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateDimensionCommandOutput>;
/**
 * deserializeAws_restJson1CreateFileCommand
 */
export declare const de_CreateFileCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateFileCommandOutput>;
/**
 * deserializeAws_restJson1CreateOrganisationCommand
 */
export declare const de_CreateOrganisationCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateOrganisationCommandOutput>;
/**
 * deserializeAws_restJson1CreatePackageCommand
 */
export declare const de_CreatePackageCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreatePackageCommandOutput>;
/**
 * deserializeAws_restJson1CreateReleaseCommand
 */
export declare const de_CreateReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateReleaseCommandOutput>;
/**
 * deserializeAws_restJson1DeleteDimensionCommand
 */
export declare const de_DeleteDimensionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DeleteDimensionCommandOutput>;
/**
 * deserializeAws_restJson1GetReleaseCommand
 */
export declare const de_GetReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetReleaseCommandOutput>;
/**
 * deserializeAws_restJson1GetUserCommand
 */
export declare const de_GetUserCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetUserCommandOutput>;
/**
 * deserializeAws_restJson1ListDimensionsCommand
 */
export declare const de_ListDimensionsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListDimensionsCommandOutput>;
/**
 * deserializeAws_restJson1ListFilesCommand
 */
export declare const de_ListFilesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListFilesCommandOutput>;
/**
 * deserializeAws_restJson1ListOrganisationsCommand
 */
export declare const de_ListOrganisationsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListOrganisationsCommandOutput>;
/**
 * deserializeAws_restJson1ListPackagesCommand
 */
export declare const de_ListPackagesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListPackagesCommandOutput>;
/**
 * deserializeAws_restJson1ListReleasesCommand
 */
export declare const de_ListReleasesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListReleasesCommandOutput>;
/**
 * deserializeAws_restJson1ListVersionsCommand
 */
export declare const de_ListVersionsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListVersionsCommandOutput>;
/**
 * deserializeAws_restJson1PostLoginCommand
 */
export declare const de_PostLoginCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<PostLoginCommandOutput>;
/**
 * deserializeAws_restJson1RequestOrganisationCommand
 */
export declare const de_RequestOrganisationCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<RequestOrganisationCommandOutput>;
/**
 * deserializeAws_restJson1ServeReleaseCommand
 */
export declare const de_ServeReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ServeReleaseCommandOutput>;
/**
 * deserializeAws_restJson1ServeReleaseV2Command
 */
export declare const de_ServeReleaseV2Command: (output: __HttpResponse, context: __SerdeContext) => Promise<ServeReleaseV2CommandOutput>;
/**
 * deserializeAws_restJson1UpdateDimensionCommand
 */
export declare const de_UpdateDimensionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UpdateDimensionCommandOutput>;
/**
 * deserializeAws_restJson1UploadFileCommand
 */
export declare const de_UploadFileCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UploadFileCommandOutput>;
