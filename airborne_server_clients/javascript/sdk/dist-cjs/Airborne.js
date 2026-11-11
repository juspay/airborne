"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Airborne = void 0;
const AirborneClient_1 = require("./AirborneClient");
const AcknowledgeEmergencyRollbackCommand_1 = require("./commands/AcknowledgeEmergencyRollbackCommand");
const ApproveControlCenterDeploymentRequestCommand_1 = require("./commands/ApproveControlCenterDeploymentRequestCommand");
const CancelControlCenterDeploymentRequestCommand_1 = require("./commands/CancelControlCenterDeploymentRequestCommand");
const ConcludeReleaseCommand_1 = require("./commands/ConcludeReleaseCommand");
const CreateApplicationCommand_1 = require("./commands/CreateApplicationCommand");
const CreateCohortRangeCommand_1 = require("./commands/CreateCohortRangeCommand");
const CreateControlCenterDeploymentRequestCommand_1 = require("./commands/CreateControlCenterDeploymentRequestCommand");
const CreateControlCenterGroupCommand_1 = require("./commands/CreateControlCenterGroupCommand");
const CreateDimensionCommand_1 = require("./commands/CreateDimensionCommand");
const CreateFileCommand_1 = require("./commands/CreateFileCommand");
const CreateOrganisationCommand_1 = require("./commands/CreateOrganisationCommand");
const CreatePackageCommand_1 = require("./commands/CreatePackageCommand");
const CreateReleaseCommand_1 = require("./commands/CreateReleaseCommand");
const DeleteControlCenterGroupCommand_1 = require("./commands/DeleteControlCenterGroupCommand");
const DeleteDimensionCommand_1 = require("./commands/DeleteDimensionCommand");
const DiscardReleaseCommand_1 = require("./commands/DiscardReleaseCommand");
const GetControlCenterApprovalPolicyCommand_1 = require("./commands/GetControlCenterApprovalPolicyCommand");
const GetControlCenterDeploymentRequestCommand_1 = require("./commands/GetControlCenterDeploymentRequestCommand");
const GetControlCenterDeploymentsCommand_1 = require("./commands/GetControlCenterDeploymentsCommand");
const GetControlCenterOverviewCommand_1 = require("./commands/GetControlCenterOverviewCommand");
const GetControlCenterReleaseEventsCommand_1 = require("./commands/GetControlCenterReleaseEventsCommand");
const GetControlCenterRollbackPreviewCommand_1 = require("./commands/GetControlCenterRollbackPreviewCommand");
const GetReleaseCommand_1 = require("./commands/GetReleaseCommand");
const GetServingPolicyCommand_1 = require("./commands/GetServingPolicyCommand");
const GetTelemetrySummaryCommand_1 = require("./commands/GetTelemetrySummaryCommand");
const GetUserCommand_1 = require("./commands/GetUserCommand");
const IngestTelemetryReportsCommand_1 = require("./commands/IngestTelemetryReportsCommand");
const ListControlCenterDeploymentRequestsCommand_1 = require("./commands/ListControlCenterDeploymentRequestsCommand");
const ListControlCenterGroupsCommand_1 = require("./commands/ListControlCenterGroupsCommand");
const ListControlCenterOperationsCommand_1 = require("./commands/ListControlCenterOperationsCommand");
const ListDimensionsCommand_1 = require("./commands/ListDimensionsCommand");
const ListFileGroupsCommand_1 = require("./commands/ListFileGroupsCommand");
const ListFilesCommand_1 = require("./commands/ListFilesCommand");
const ListOrganisationsCommand_1 = require("./commands/ListOrganisationsCommand");
const ListPackagesCommand_1 = require("./commands/ListPackagesCommand");
const ListReleasesCommand_1 = require("./commands/ListReleasesCommand");
const PostLoginCommand_1 = require("./commands/PostLoginCommand");
const PreviewServingPolicyCommand_1 = require("./commands/PreviewServingPolicyCommand");
const PutServingPolicyCommand_1 = require("./commands/PutServingPolicyCommand");
const RampReleaseCommand_1 = require("./commands/RampReleaseCommand");
const RejectControlCenterDeploymentRequestCommand_1 = require("./commands/RejectControlCenterDeploymentRequestCommand");
const RequestOrganisationCommand_1 = require("./commands/RequestOrganisationCommand");
const ResolveControlCenterOperationCommand_1 = require("./commands/ResolveControlCenterOperationCommand");
const RollbackReleaseCommand_1 = require("./commands/RollbackReleaseCommand");
const ServeReleaseCommand_1 = require("./commands/ServeReleaseCommand");
const ServeReleaseV2Command_1 = require("./commands/ServeReleaseV2Command");
const UpdateControlCenterApprovalPolicyCommand_1 = require("./commands/UpdateControlCenterApprovalPolicyCommand");
const UpdateControlCenterGroupCommand_1 = require("./commands/UpdateControlCenterGroupCommand");
const UpdateDimensionCommand_1 = require("./commands/UpdateDimensionCommand");
const UpdateFileCommand_1 = require("./commands/UpdateFileCommand");
const UploadFileCommand_1 = require("./commands/UploadFileCommand");
const smithy_client_1 = require("@smithy/smithy-client");
const commands = {
    AcknowledgeEmergencyRollbackCommand: AcknowledgeEmergencyRollbackCommand_1.AcknowledgeEmergencyRollbackCommand,
    ApproveControlCenterDeploymentRequestCommand: ApproveControlCenterDeploymentRequestCommand_1.ApproveControlCenterDeploymentRequestCommand,
    CancelControlCenterDeploymentRequestCommand: CancelControlCenterDeploymentRequestCommand_1.CancelControlCenterDeploymentRequestCommand,
    ConcludeReleaseCommand: ConcludeReleaseCommand_1.ConcludeReleaseCommand,
    CreateApplicationCommand: CreateApplicationCommand_1.CreateApplicationCommand,
    CreateCohortRangeCommand: CreateCohortRangeCommand_1.CreateCohortRangeCommand,
    CreateControlCenterDeploymentRequestCommand: CreateControlCenterDeploymentRequestCommand_1.CreateControlCenterDeploymentRequestCommand,
    CreateControlCenterGroupCommand: CreateControlCenterGroupCommand_1.CreateControlCenterGroupCommand,
    CreateDimensionCommand: CreateDimensionCommand_1.CreateDimensionCommand,
    CreateFileCommand: CreateFileCommand_1.CreateFileCommand,
    CreateOrganisationCommand: CreateOrganisationCommand_1.CreateOrganisationCommand,
    CreatePackageCommand: CreatePackageCommand_1.CreatePackageCommand,
    CreateReleaseCommand: CreateReleaseCommand_1.CreateReleaseCommand,
    DeleteControlCenterGroupCommand: DeleteControlCenterGroupCommand_1.DeleteControlCenterGroupCommand,
    DeleteDimensionCommand: DeleteDimensionCommand_1.DeleteDimensionCommand,
    DiscardReleaseCommand: DiscardReleaseCommand_1.DiscardReleaseCommand,
    GetControlCenterApprovalPolicyCommand: GetControlCenterApprovalPolicyCommand_1.GetControlCenterApprovalPolicyCommand,
    GetControlCenterDeploymentRequestCommand: GetControlCenterDeploymentRequestCommand_1.GetControlCenterDeploymentRequestCommand,
    GetControlCenterDeploymentsCommand: GetControlCenterDeploymentsCommand_1.GetControlCenterDeploymentsCommand,
    GetControlCenterOverviewCommand: GetControlCenterOverviewCommand_1.GetControlCenterOverviewCommand,
    GetControlCenterReleaseEventsCommand: GetControlCenterReleaseEventsCommand_1.GetControlCenterReleaseEventsCommand,
    GetControlCenterRollbackPreviewCommand: GetControlCenterRollbackPreviewCommand_1.GetControlCenterRollbackPreviewCommand,
    GetReleaseCommand: GetReleaseCommand_1.GetReleaseCommand,
    GetServingPolicyCommand: GetServingPolicyCommand_1.GetServingPolicyCommand,
    GetTelemetrySummaryCommand: GetTelemetrySummaryCommand_1.GetTelemetrySummaryCommand,
    GetUserCommand: GetUserCommand_1.GetUserCommand,
    IngestTelemetryReportsCommand: IngestTelemetryReportsCommand_1.IngestTelemetryReportsCommand,
    ListControlCenterDeploymentRequestsCommand: ListControlCenterDeploymentRequestsCommand_1.ListControlCenterDeploymentRequestsCommand,
    ListControlCenterGroupsCommand: ListControlCenterGroupsCommand_1.ListControlCenterGroupsCommand,
    ListControlCenterOperationsCommand: ListControlCenterOperationsCommand_1.ListControlCenterOperationsCommand,
    ListDimensionsCommand: ListDimensionsCommand_1.ListDimensionsCommand,
    ListFileGroupsCommand: ListFileGroupsCommand_1.ListFileGroupsCommand,
    ListFilesCommand: ListFilesCommand_1.ListFilesCommand,
    ListOrganisationsCommand: ListOrganisationsCommand_1.ListOrganisationsCommand,
    ListPackagesCommand: ListPackagesCommand_1.ListPackagesCommand,
    ListReleasesCommand: ListReleasesCommand_1.ListReleasesCommand,
    PostLoginCommand: PostLoginCommand_1.PostLoginCommand,
    PreviewServingPolicyCommand: PreviewServingPolicyCommand_1.PreviewServingPolicyCommand,
    PutServingPolicyCommand: PutServingPolicyCommand_1.PutServingPolicyCommand,
    RampReleaseCommand: RampReleaseCommand_1.RampReleaseCommand,
    RejectControlCenterDeploymentRequestCommand: RejectControlCenterDeploymentRequestCommand_1.RejectControlCenterDeploymentRequestCommand,
    RequestOrganisationCommand: RequestOrganisationCommand_1.RequestOrganisationCommand,
    ResolveControlCenterOperationCommand: ResolveControlCenterOperationCommand_1.ResolveControlCenterOperationCommand,
    RollbackReleaseCommand: RollbackReleaseCommand_1.RollbackReleaseCommand,
    ServeReleaseCommand: ServeReleaseCommand_1.ServeReleaseCommand,
    ServeReleaseV2Command: ServeReleaseV2Command_1.ServeReleaseV2Command,
    UpdateControlCenterApprovalPolicyCommand: UpdateControlCenterApprovalPolicyCommand_1.UpdateControlCenterApprovalPolicyCommand,
    UpdateControlCenterGroupCommand: UpdateControlCenterGroupCommand_1.UpdateControlCenterGroupCommand,
    UpdateDimensionCommand: UpdateDimensionCommand_1.UpdateDimensionCommand,
    UpdateFileCommand: UpdateFileCommand_1.UpdateFileCommand,
    UploadFileCommand: UploadFileCommand_1.UploadFileCommand,
};
class Airborne extends AirborneClient_1.AirborneClient {
}
exports.Airborne = Airborne;
(0, smithy_client_1.createAggregatedClient)(commands, Airborne);
