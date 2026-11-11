import { AcknowledgeEmergencyRollbackCommandInput, AcknowledgeEmergencyRollbackCommandOutput } from "../commands/AcknowledgeEmergencyRollbackCommand";
import { ApproveControlCenterDeploymentRequestCommandInput, ApproveControlCenterDeploymentRequestCommandOutput } from "../commands/ApproveControlCenterDeploymentRequestCommand";
import { CancelControlCenterDeploymentRequestCommandInput, CancelControlCenterDeploymentRequestCommandOutput } from "../commands/CancelControlCenterDeploymentRequestCommand";
import { ConcludeReleaseCommandInput, ConcludeReleaseCommandOutput } from "../commands/ConcludeReleaseCommand";
import { CreateApplicationCommandInput, CreateApplicationCommandOutput } from "../commands/CreateApplicationCommand";
import { CreateCohortRangeCommandInput, CreateCohortRangeCommandOutput } from "../commands/CreateCohortRangeCommand";
import { CreateControlCenterDeploymentRequestCommandInput, CreateControlCenterDeploymentRequestCommandOutput } from "../commands/CreateControlCenterDeploymentRequestCommand";
import { CreateControlCenterGroupCommandInput, CreateControlCenterGroupCommandOutput } from "../commands/CreateControlCenterGroupCommand";
import { CreateDimensionCommandInput, CreateDimensionCommandOutput } from "../commands/CreateDimensionCommand";
import { CreateFileCommandInput, CreateFileCommandOutput } from "../commands/CreateFileCommand";
import { CreateOrganisationCommandInput, CreateOrganisationCommandOutput } from "../commands/CreateOrganisationCommand";
import { CreatePackageCommandInput, CreatePackageCommandOutput } from "../commands/CreatePackageCommand";
import { CreateReleaseCommandInput, CreateReleaseCommandOutput } from "../commands/CreateReleaseCommand";
import { DeleteControlCenterGroupCommandInput, DeleteControlCenterGroupCommandOutput } from "../commands/DeleteControlCenterGroupCommand";
import { DeleteDimensionCommandInput, DeleteDimensionCommandOutput } from "../commands/DeleteDimensionCommand";
import { DiscardReleaseCommandInput, DiscardReleaseCommandOutput } from "../commands/DiscardReleaseCommand";
import { GetControlCenterApprovalPolicyCommandInput, GetControlCenterApprovalPolicyCommandOutput } from "../commands/GetControlCenterApprovalPolicyCommand";
import { GetControlCenterDeploymentRequestCommandInput, GetControlCenterDeploymentRequestCommandOutput } from "../commands/GetControlCenterDeploymentRequestCommand";
import { GetControlCenterDeploymentsCommandInput, GetControlCenterDeploymentsCommandOutput } from "../commands/GetControlCenterDeploymentsCommand";
import { GetControlCenterOverviewCommandInput, GetControlCenterOverviewCommandOutput } from "../commands/GetControlCenterOverviewCommand";
import { GetControlCenterReleaseEventsCommandInput, GetControlCenterReleaseEventsCommandOutput } from "../commands/GetControlCenterReleaseEventsCommand";
import { GetControlCenterRollbackPreviewCommandInput, GetControlCenterRollbackPreviewCommandOutput } from "../commands/GetControlCenterRollbackPreviewCommand";
import { GetReleaseCommandInput, GetReleaseCommandOutput } from "../commands/GetReleaseCommand";
import { GetServingPolicyCommandInput, GetServingPolicyCommandOutput } from "../commands/GetServingPolicyCommand";
import { GetTelemetrySummaryCommandInput, GetTelemetrySummaryCommandOutput } from "../commands/GetTelemetrySummaryCommand";
import { GetUserCommandInput, GetUserCommandOutput } from "../commands/GetUserCommand";
import { IngestTelemetryReportsCommandInput, IngestTelemetryReportsCommandOutput } from "../commands/IngestTelemetryReportsCommand";
import { ListControlCenterDeploymentRequestsCommandInput, ListControlCenterDeploymentRequestsCommandOutput } from "../commands/ListControlCenterDeploymentRequestsCommand";
import { ListControlCenterGroupsCommandInput, ListControlCenterGroupsCommandOutput } from "../commands/ListControlCenterGroupsCommand";
import { ListControlCenterOperationsCommandInput, ListControlCenterOperationsCommandOutput } from "../commands/ListControlCenterOperationsCommand";
import { ListDimensionsCommandInput, ListDimensionsCommandOutput } from "../commands/ListDimensionsCommand";
import { ListFileGroupsCommandInput, ListFileGroupsCommandOutput } from "../commands/ListFileGroupsCommand";
import { ListFilesCommandInput, ListFilesCommandOutput } from "../commands/ListFilesCommand";
import { ListOrganisationsCommandInput, ListOrganisationsCommandOutput } from "../commands/ListOrganisationsCommand";
import { ListPackagesCommandInput, ListPackagesCommandOutput } from "../commands/ListPackagesCommand";
import { ListReleasesCommandInput, ListReleasesCommandOutput } from "../commands/ListReleasesCommand";
import { PostLoginCommandInput, PostLoginCommandOutput } from "../commands/PostLoginCommand";
import { PreviewServingPolicyCommandInput, PreviewServingPolicyCommandOutput } from "../commands/PreviewServingPolicyCommand";
import { PutServingPolicyCommandInput, PutServingPolicyCommandOutput } from "../commands/PutServingPolicyCommand";
import { RampReleaseCommandInput, RampReleaseCommandOutput } from "../commands/RampReleaseCommand";
import { RejectControlCenterDeploymentRequestCommandInput, RejectControlCenterDeploymentRequestCommandOutput } from "../commands/RejectControlCenterDeploymentRequestCommand";
import { RequestOrganisationCommandInput, RequestOrganisationCommandOutput } from "../commands/RequestOrganisationCommand";
import { ResolveControlCenterOperationCommandInput, ResolveControlCenterOperationCommandOutput } from "../commands/ResolveControlCenterOperationCommand";
import { RollbackReleaseCommandInput, RollbackReleaseCommandOutput } from "../commands/RollbackReleaseCommand";
import { ServeReleaseCommandInput, ServeReleaseCommandOutput } from "../commands/ServeReleaseCommand";
import { ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput } from "../commands/ServeReleaseV2Command";
import { UpdateControlCenterApprovalPolicyCommandInput, UpdateControlCenterApprovalPolicyCommandOutput } from "../commands/UpdateControlCenterApprovalPolicyCommand";
import { UpdateControlCenterGroupCommandInput, UpdateControlCenterGroupCommandOutput } from "../commands/UpdateControlCenterGroupCommand";
import { UpdateDimensionCommandInput, UpdateDimensionCommandOutput } from "../commands/UpdateDimensionCommand";
import { UpdateFileCommandInput, UpdateFileCommandOutput } from "../commands/UpdateFileCommand";
import { UploadFileCommandInput, UploadFileCommandOutput } from "../commands/UploadFileCommand";
import { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/protocol-http";
import { SerdeContext as __SerdeContext } from "@smithy/types";
/**
 * serializeAws_restJson1AcknowledgeEmergencyRollbackCommand
 */
export declare const se_AcknowledgeEmergencyRollbackCommand: (input: AcknowledgeEmergencyRollbackCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ApproveControlCenterDeploymentRequestCommand
 */
export declare const se_ApproveControlCenterDeploymentRequestCommand: (input: ApproveControlCenterDeploymentRequestCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CancelControlCenterDeploymentRequestCommand
 */
export declare const se_CancelControlCenterDeploymentRequestCommand: (input: CancelControlCenterDeploymentRequestCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ConcludeReleaseCommand
 */
export declare const se_ConcludeReleaseCommand: (input: ConcludeReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateApplicationCommand
 */
export declare const se_CreateApplicationCommand: (input: CreateApplicationCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateCohortRangeCommand
 */
export declare const se_CreateCohortRangeCommand: (input: CreateCohortRangeCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateControlCenterDeploymentRequestCommand
 */
export declare const se_CreateControlCenterDeploymentRequestCommand: (input: CreateControlCenterDeploymentRequestCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1CreateControlCenterGroupCommand
 */
export declare const se_CreateControlCenterGroupCommand: (input: CreateControlCenterGroupCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
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
 * serializeAws_restJson1DeleteControlCenterGroupCommand
 */
export declare const se_DeleteControlCenterGroupCommand: (input: DeleteControlCenterGroupCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1DeleteDimensionCommand
 */
export declare const se_DeleteDimensionCommand: (input: DeleteDimensionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1DiscardReleaseCommand
 */
export declare const se_DiscardReleaseCommand: (input: DiscardReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetControlCenterApprovalPolicyCommand
 */
export declare const se_GetControlCenterApprovalPolicyCommand: (input: GetControlCenterApprovalPolicyCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetControlCenterDeploymentRequestCommand
 */
export declare const se_GetControlCenterDeploymentRequestCommand: (input: GetControlCenterDeploymentRequestCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetControlCenterDeploymentsCommand
 */
export declare const se_GetControlCenterDeploymentsCommand: (input: GetControlCenterDeploymentsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetControlCenterOverviewCommand
 */
export declare const se_GetControlCenterOverviewCommand: (input: GetControlCenterOverviewCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetControlCenterReleaseEventsCommand
 */
export declare const se_GetControlCenterReleaseEventsCommand: (input: GetControlCenterReleaseEventsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetControlCenterRollbackPreviewCommand
 */
export declare const se_GetControlCenterRollbackPreviewCommand: (input: GetControlCenterRollbackPreviewCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetReleaseCommand
 */
export declare const se_GetReleaseCommand: (input: GetReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetServingPolicyCommand
 */
export declare const se_GetServingPolicyCommand: (input: GetServingPolicyCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetTelemetrySummaryCommand
 */
export declare const se_GetTelemetrySummaryCommand: (input: GetTelemetrySummaryCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1GetUserCommand
 */
export declare const se_GetUserCommand: (input: GetUserCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1IngestTelemetryReportsCommand
 */
export declare const se_IngestTelemetryReportsCommand: (input: IngestTelemetryReportsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListControlCenterDeploymentRequestsCommand
 */
export declare const se_ListControlCenterDeploymentRequestsCommand: (input: ListControlCenterDeploymentRequestsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListControlCenterGroupsCommand
 */
export declare const se_ListControlCenterGroupsCommand: (input: ListControlCenterGroupsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListControlCenterOperationsCommand
 */
export declare const se_ListControlCenterOperationsCommand: (input: ListControlCenterOperationsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListDimensionsCommand
 */
export declare const se_ListDimensionsCommand: (input: ListDimensionsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ListFileGroupsCommand
 */
export declare const se_ListFileGroupsCommand: (input: ListFileGroupsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
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
 * serializeAws_restJson1PostLoginCommand
 */
export declare const se_PostLoginCommand: (input: PostLoginCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1PreviewServingPolicyCommand
 */
export declare const se_PreviewServingPolicyCommand: (input: PreviewServingPolicyCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1PutServingPolicyCommand
 */
export declare const se_PutServingPolicyCommand: (input: PutServingPolicyCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1RampReleaseCommand
 */
export declare const se_RampReleaseCommand: (input: RampReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1RejectControlCenterDeploymentRequestCommand
 */
export declare const se_RejectControlCenterDeploymentRequestCommand: (input: RejectControlCenterDeploymentRequestCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1RequestOrganisationCommand
 */
export declare const se_RequestOrganisationCommand: (input: RequestOrganisationCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ResolveControlCenterOperationCommand
 */
export declare const se_ResolveControlCenterOperationCommand: (input: ResolveControlCenterOperationCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1RollbackReleaseCommand
 */
export declare const se_RollbackReleaseCommand: (input: RollbackReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ServeReleaseCommand
 */
export declare const se_ServeReleaseCommand: (input: ServeReleaseCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1ServeReleaseV2Command
 */
export declare const se_ServeReleaseV2Command: (input: ServeReleaseV2CommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UpdateControlCenterApprovalPolicyCommand
 */
export declare const se_UpdateControlCenterApprovalPolicyCommand: (input: UpdateControlCenterApprovalPolicyCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UpdateControlCenterGroupCommand
 */
export declare const se_UpdateControlCenterGroupCommand: (input: UpdateControlCenterGroupCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UpdateDimensionCommand
 */
export declare const se_UpdateDimensionCommand: (input: UpdateDimensionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UpdateFileCommand
 */
export declare const se_UpdateFileCommand: (input: UpdateFileCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_restJson1UploadFileCommand
 */
export declare const se_UploadFileCommand: (input: UploadFileCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * deserializeAws_restJson1AcknowledgeEmergencyRollbackCommand
 */
export declare const de_AcknowledgeEmergencyRollbackCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<AcknowledgeEmergencyRollbackCommandOutput>;
/**
 * deserializeAws_restJson1ApproveControlCenterDeploymentRequestCommand
 */
export declare const de_ApproveControlCenterDeploymentRequestCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ApproveControlCenterDeploymentRequestCommandOutput>;
/**
 * deserializeAws_restJson1CancelControlCenterDeploymentRequestCommand
 */
export declare const de_CancelControlCenterDeploymentRequestCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CancelControlCenterDeploymentRequestCommandOutput>;
/**
 * deserializeAws_restJson1ConcludeReleaseCommand
 */
export declare const de_ConcludeReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ConcludeReleaseCommandOutput>;
/**
 * deserializeAws_restJson1CreateApplicationCommand
 */
export declare const de_CreateApplicationCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateApplicationCommandOutput>;
/**
 * deserializeAws_restJson1CreateCohortRangeCommand
 */
export declare const de_CreateCohortRangeCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateCohortRangeCommandOutput>;
/**
 * deserializeAws_restJson1CreateControlCenterDeploymentRequestCommand
 */
export declare const de_CreateControlCenterDeploymentRequestCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateControlCenterDeploymentRequestCommandOutput>;
/**
 * deserializeAws_restJson1CreateControlCenterGroupCommand
 */
export declare const de_CreateControlCenterGroupCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateControlCenterGroupCommandOutput>;
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
 * deserializeAws_restJson1DeleteControlCenterGroupCommand
 */
export declare const de_DeleteControlCenterGroupCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DeleteControlCenterGroupCommandOutput>;
/**
 * deserializeAws_restJson1DeleteDimensionCommand
 */
export declare const de_DeleteDimensionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DeleteDimensionCommandOutput>;
/**
 * deserializeAws_restJson1DiscardReleaseCommand
 */
export declare const de_DiscardReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DiscardReleaseCommandOutput>;
/**
 * deserializeAws_restJson1GetControlCenterApprovalPolicyCommand
 */
export declare const de_GetControlCenterApprovalPolicyCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetControlCenterApprovalPolicyCommandOutput>;
/**
 * deserializeAws_restJson1GetControlCenterDeploymentRequestCommand
 */
export declare const de_GetControlCenterDeploymentRequestCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetControlCenterDeploymentRequestCommandOutput>;
/**
 * deserializeAws_restJson1GetControlCenterDeploymentsCommand
 */
export declare const de_GetControlCenterDeploymentsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetControlCenterDeploymentsCommandOutput>;
/**
 * deserializeAws_restJson1GetControlCenterOverviewCommand
 */
export declare const de_GetControlCenterOverviewCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetControlCenterOverviewCommandOutput>;
/**
 * deserializeAws_restJson1GetControlCenterReleaseEventsCommand
 */
export declare const de_GetControlCenterReleaseEventsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetControlCenterReleaseEventsCommandOutput>;
/**
 * deserializeAws_restJson1GetControlCenterRollbackPreviewCommand
 */
export declare const de_GetControlCenterRollbackPreviewCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetControlCenterRollbackPreviewCommandOutput>;
/**
 * deserializeAws_restJson1GetReleaseCommand
 */
export declare const de_GetReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetReleaseCommandOutput>;
/**
 * deserializeAws_restJson1GetServingPolicyCommand
 */
export declare const de_GetServingPolicyCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetServingPolicyCommandOutput>;
/**
 * deserializeAws_restJson1GetTelemetrySummaryCommand
 */
export declare const de_GetTelemetrySummaryCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetTelemetrySummaryCommandOutput>;
/**
 * deserializeAws_restJson1GetUserCommand
 */
export declare const de_GetUserCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetUserCommandOutput>;
/**
 * deserializeAws_restJson1IngestTelemetryReportsCommand
 */
export declare const de_IngestTelemetryReportsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<IngestTelemetryReportsCommandOutput>;
/**
 * deserializeAws_restJson1ListControlCenterDeploymentRequestsCommand
 */
export declare const de_ListControlCenterDeploymentRequestsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListControlCenterDeploymentRequestsCommandOutput>;
/**
 * deserializeAws_restJson1ListControlCenterGroupsCommand
 */
export declare const de_ListControlCenterGroupsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListControlCenterGroupsCommandOutput>;
/**
 * deserializeAws_restJson1ListControlCenterOperationsCommand
 */
export declare const de_ListControlCenterOperationsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListControlCenterOperationsCommandOutput>;
/**
 * deserializeAws_restJson1ListDimensionsCommand
 */
export declare const de_ListDimensionsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListDimensionsCommandOutput>;
/**
 * deserializeAws_restJson1ListFileGroupsCommand
 */
export declare const de_ListFileGroupsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListFileGroupsCommandOutput>;
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
 * deserializeAws_restJson1PostLoginCommand
 */
export declare const de_PostLoginCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<PostLoginCommandOutput>;
/**
 * deserializeAws_restJson1PreviewServingPolicyCommand
 */
export declare const de_PreviewServingPolicyCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<PreviewServingPolicyCommandOutput>;
/**
 * deserializeAws_restJson1PutServingPolicyCommand
 */
export declare const de_PutServingPolicyCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<PutServingPolicyCommandOutput>;
/**
 * deserializeAws_restJson1RampReleaseCommand
 */
export declare const de_RampReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<RampReleaseCommandOutput>;
/**
 * deserializeAws_restJson1RejectControlCenterDeploymentRequestCommand
 */
export declare const de_RejectControlCenterDeploymentRequestCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<RejectControlCenterDeploymentRequestCommandOutput>;
/**
 * deserializeAws_restJson1RequestOrganisationCommand
 */
export declare const de_RequestOrganisationCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<RequestOrganisationCommandOutput>;
/**
 * deserializeAws_restJson1ResolveControlCenterOperationCommand
 */
export declare const de_ResolveControlCenterOperationCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ResolveControlCenterOperationCommandOutput>;
/**
 * deserializeAws_restJson1RollbackReleaseCommand
 */
export declare const de_RollbackReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<RollbackReleaseCommandOutput>;
/**
 * deserializeAws_restJson1ServeReleaseCommand
 */
export declare const de_ServeReleaseCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ServeReleaseCommandOutput>;
/**
 * deserializeAws_restJson1ServeReleaseV2Command
 */
export declare const de_ServeReleaseV2Command: (output: __HttpResponse, context: __SerdeContext) => Promise<ServeReleaseV2CommandOutput>;
/**
 * deserializeAws_restJson1UpdateControlCenterApprovalPolicyCommand
 */
export declare const de_UpdateControlCenterApprovalPolicyCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UpdateControlCenterApprovalPolicyCommandOutput>;
/**
 * deserializeAws_restJson1UpdateControlCenterGroupCommand
 */
export declare const de_UpdateControlCenterGroupCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UpdateControlCenterGroupCommandOutput>;
/**
 * deserializeAws_restJson1UpdateDimensionCommand
 */
export declare const de_UpdateDimensionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UpdateDimensionCommandOutput>;
/**
 * deserializeAws_restJson1UpdateFileCommand
 */
export declare const de_UpdateFileCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UpdateFileCommandOutput>;
/**
 * deserializeAws_restJson1UploadFileCommand
 */
export declare const de_UploadFileCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UploadFileCommandOutput>;
