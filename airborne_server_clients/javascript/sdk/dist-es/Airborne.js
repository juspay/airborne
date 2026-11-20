import { AirborneClient, } from "./AirborneClient";
import { AcknowledgeEmergencyRollbackCommand, } from "./commands/AcknowledgeEmergencyRollbackCommand";
import { ApproveControlCenterDeploymentRequestCommand, } from "./commands/ApproveControlCenterDeploymentRequestCommand";
import { CancelControlCenterDeploymentRequestCommand, } from "./commands/CancelControlCenterDeploymentRequestCommand";
import { ConcludeReleaseCommand, } from "./commands/ConcludeReleaseCommand";
import { CreateApplicationCommand, } from "./commands/CreateApplicationCommand";
import { CreateCohortRangeCommand, } from "./commands/CreateCohortRangeCommand";
import { CreateControlCenterDeploymentRequestCommand, } from "./commands/CreateControlCenterDeploymentRequestCommand";
import { CreateControlCenterGroupCommand, } from "./commands/CreateControlCenterGroupCommand";
import { CreateDimensionCommand, } from "./commands/CreateDimensionCommand";
import { CreateFileCommand, } from "./commands/CreateFileCommand";
import { CreateOrganisationCommand, } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommand, } from "./commands/CreatePackageCommand";
import { CreateReleaseCommand, } from "./commands/CreateReleaseCommand";
import { DeleteControlCenterGroupCommand, } from "./commands/DeleteControlCenterGroupCommand";
import { DeleteDimensionCommand, } from "./commands/DeleteDimensionCommand";
import { DiscardReleaseCommand, } from "./commands/DiscardReleaseCommand";
import { GetControlCenterApprovalPolicyCommand, } from "./commands/GetControlCenterApprovalPolicyCommand";
import { GetControlCenterDeploymentRequestCommand, } from "./commands/GetControlCenterDeploymentRequestCommand";
import { GetControlCenterOverviewCommand, } from "./commands/GetControlCenterOverviewCommand";
import { GetControlCenterReleaseEventsCommand, } from "./commands/GetControlCenterReleaseEventsCommand";
import { GetControlCenterRollbackPreviewCommand, } from "./commands/GetControlCenterRollbackPreviewCommand";
import { GetReleaseCommand, } from "./commands/GetReleaseCommand";
import { GetServingPolicyCommand, } from "./commands/GetServingPolicyCommand";
import { GetTelemetrySummaryCommand, } from "./commands/GetTelemetrySummaryCommand";
import { GetUserCommand, } from "./commands/GetUserCommand";
import { IngestTelemetryReportsCommand, } from "./commands/IngestTelemetryReportsCommand";
import { ListControlCenterDeploymentRequestsCommand, } from "./commands/ListControlCenterDeploymentRequestsCommand";
import { ListControlCenterGroupsCommand, } from "./commands/ListControlCenterGroupsCommand";
import { ListControlCenterOperationsCommand, } from "./commands/ListControlCenterOperationsCommand";
import { ListDimensionsCommand, } from "./commands/ListDimensionsCommand";
import { ListFileGroupsCommand, } from "./commands/ListFileGroupsCommand";
import { ListFilesCommand, } from "./commands/ListFilesCommand";
import { ListOrganisationsCommand, } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommand, } from "./commands/ListPackagesCommand";
import { ListReleasesCommand, } from "./commands/ListReleasesCommand";
import { PostLoginCommand, } from "./commands/PostLoginCommand";
import { PreviewServingPolicyCommand, } from "./commands/PreviewServingPolicyCommand";
import { PutServingPolicyCommand, } from "./commands/PutServingPolicyCommand";
import { RampReleaseCommand, } from "./commands/RampReleaseCommand";
import { RejectControlCenterDeploymentRequestCommand, } from "./commands/RejectControlCenterDeploymentRequestCommand";
import { RequestOrganisationCommand, } from "./commands/RequestOrganisationCommand";
import { ResolveControlCenterOperationCommand, } from "./commands/ResolveControlCenterOperationCommand";
import { RollbackReleaseCommand, } from "./commands/RollbackReleaseCommand";
import { ServeReleaseCommand, } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2Command, } from "./commands/ServeReleaseV2Command";
import { UpdateControlCenterApprovalPolicyCommand, } from "./commands/UpdateControlCenterApprovalPolicyCommand";
import { UpdateControlCenterGroupCommand, } from "./commands/UpdateControlCenterGroupCommand";
import { UpdateDimensionCommand, } from "./commands/UpdateDimensionCommand";
import { UpdateFileCommand, } from "./commands/UpdateFileCommand";
import { UploadFileCommand, } from "./commands/UploadFileCommand";
import { createAggregatedClient } from "@smithy/smithy-client";
const commands = {
    AcknowledgeEmergencyRollbackCommand,
    ApproveControlCenterDeploymentRequestCommand,
    CancelControlCenterDeploymentRequestCommand,
    ConcludeReleaseCommand,
    CreateApplicationCommand,
    CreateCohortRangeCommand,
    CreateControlCenterDeploymentRequestCommand,
    CreateControlCenterGroupCommand,
    CreateDimensionCommand,
    CreateFileCommand,
    CreateOrganisationCommand,
    CreatePackageCommand,
    CreateReleaseCommand,
    DeleteControlCenterGroupCommand,
    DeleteDimensionCommand,
    DiscardReleaseCommand,
    GetControlCenterApprovalPolicyCommand,
    GetControlCenterDeploymentRequestCommand,
    GetControlCenterOverviewCommand,
    GetControlCenterReleaseEventsCommand,
    GetControlCenterRollbackPreviewCommand,
    GetReleaseCommand,
    GetServingPolicyCommand,
    GetTelemetrySummaryCommand,
    GetUserCommand,
    IngestTelemetryReportsCommand,
    ListControlCenterDeploymentRequestsCommand,
    ListControlCenterGroupsCommand,
    ListControlCenterOperationsCommand,
    ListDimensionsCommand,
    ListFileGroupsCommand,
    ListFilesCommand,
    ListOrganisationsCommand,
    ListPackagesCommand,
    ListReleasesCommand,
    PostLoginCommand,
    PreviewServingPolicyCommand,
    PutServingPolicyCommand,
    RampReleaseCommand,
    RejectControlCenterDeploymentRequestCommand,
    RequestOrganisationCommand,
    ResolveControlCenterOperationCommand,
    RollbackReleaseCommand,
    ServeReleaseCommand,
    ServeReleaseV2Command,
    UpdateControlCenterApprovalPolicyCommand,
    UpdateControlCenterGroupCommand,
    UpdateDimensionCommand,
    UpdateFileCommand,
    UploadFileCommand,
};
export class Airborne extends AirborneClient {
}
createAggregatedClient(commands, Airborne);
