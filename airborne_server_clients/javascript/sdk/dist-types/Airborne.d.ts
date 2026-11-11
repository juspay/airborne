import { AirborneClient } from "./AirborneClient";
import { AcknowledgeEmergencyRollbackCommandInput, AcknowledgeEmergencyRollbackCommandOutput } from "./commands/AcknowledgeEmergencyRollbackCommand";
import { ApproveControlCenterDeploymentRequestCommandInput, ApproveControlCenterDeploymentRequestCommandOutput } from "./commands/ApproveControlCenterDeploymentRequestCommand";
import { CancelControlCenterDeploymentRequestCommandInput, CancelControlCenterDeploymentRequestCommandOutput } from "./commands/CancelControlCenterDeploymentRequestCommand";
import { ConcludeReleaseCommandInput, ConcludeReleaseCommandOutput } from "./commands/ConcludeReleaseCommand";
import { CreateApplicationCommandInput, CreateApplicationCommandOutput } from "./commands/CreateApplicationCommand";
import { CreateCohortRangeCommandInput, CreateCohortRangeCommandOutput } from "./commands/CreateCohortRangeCommand";
import { CreateControlCenterDeploymentRequestCommandInput, CreateControlCenterDeploymentRequestCommandOutput } from "./commands/CreateControlCenterDeploymentRequestCommand";
import { CreateControlCenterGroupCommandInput, CreateControlCenterGroupCommandOutput } from "./commands/CreateControlCenterGroupCommand";
import { CreateDimensionCommandInput, CreateDimensionCommandOutput } from "./commands/CreateDimensionCommand";
import { CreateFileCommandInput, CreateFileCommandOutput } from "./commands/CreateFileCommand";
import { CreateOrganisationCommandInput, CreateOrganisationCommandOutput } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommandInput, CreatePackageCommandOutput } from "./commands/CreatePackageCommand";
import { CreateReleaseCommandInput, CreateReleaseCommandOutput } from "./commands/CreateReleaseCommand";
import { DeleteControlCenterGroupCommandInput, DeleteControlCenterGroupCommandOutput } from "./commands/DeleteControlCenterGroupCommand";
import { DeleteDimensionCommandInput, DeleteDimensionCommandOutput } from "./commands/DeleteDimensionCommand";
import { DiscardReleaseCommandInput, DiscardReleaseCommandOutput } from "./commands/DiscardReleaseCommand";
import { GetControlCenterApprovalPolicyCommandInput, GetControlCenterApprovalPolicyCommandOutput } from "./commands/GetControlCenterApprovalPolicyCommand";
import { GetControlCenterDeploymentRequestCommandInput, GetControlCenterDeploymentRequestCommandOutput } from "./commands/GetControlCenterDeploymentRequestCommand";
import { GetControlCenterDeploymentsCommandInput, GetControlCenterDeploymentsCommandOutput } from "./commands/GetControlCenterDeploymentsCommand";
import { GetControlCenterOverviewCommandInput, GetControlCenterOverviewCommandOutput } from "./commands/GetControlCenterOverviewCommand";
import { GetControlCenterReleaseEventsCommandInput, GetControlCenterReleaseEventsCommandOutput } from "./commands/GetControlCenterReleaseEventsCommand";
import { GetControlCenterRollbackPreviewCommandInput, GetControlCenterRollbackPreviewCommandOutput } from "./commands/GetControlCenterRollbackPreviewCommand";
import { GetReleaseCommandInput, GetReleaseCommandOutput } from "./commands/GetReleaseCommand";
import { GetServingPolicyCommandInput, GetServingPolicyCommandOutput } from "./commands/GetServingPolicyCommand";
import { GetTelemetrySummaryCommandInput, GetTelemetrySummaryCommandOutput } from "./commands/GetTelemetrySummaryCommand";
import { GetUserCommandInput, GetUserCommandOutput } from "./commands/GetUserCommand";
import { IngestTelemetryReportsCommandInput, IngestTelemetryReportsCommandOutput } from "./commands/IngestTelemetryReportsCommand";
import { ListControlCenterDeploymentRequestsCommandInput, ListControlCenterDeploymentRequestsCommandOutput } from "./commands/ListControlCenterDeploymentRequestsCommand";
import { ListControlCenterGroupsCommandInput, ListControlCenterGroupsCommandOutput } from "./commands/ListControlCenterGroupsCommand";
import { ListControlCenterOperationsCommandInput, ListControlCenterOperationsCommandOutput } from "./commands/ListControlCenterOperationsCommand";
import { ListDimensionsCommandInput, ListDimensionsCommandOutput } from "./commands/ListDimensionsCommand";
import { ListFileGroupsCommandInput, ListFileGroupsCommandOutput } from "./commands/ListFileGroupsCommand";
import { ListFilesCommandInput, ListFilesCommandOutput } from "./commands/ListFilesCommand";
import { ListOrganisationsCommandInput, ListOrganisationsCommandOutput } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommandInput, ListPackagesCommandOutput } from "./commands/ListPackagesCommand";
import { ListReleasesCommandInput, ListReleasesCommandOutput } from "./commands/ListReleasesCommand";
import { PostLoginCommandInput, PostLoginCommandOutput } from "./commands/PostLoginCommand";
import { PreviewServingPolicyCommandInput, PreviewServingPolicyCommandOutput } from "./commands/PreviewServingPolicyCommand";
import { PutServingPolicyCommandInput, PutServingPolicyCommandOutput } from "./commands/PutServingPolicyCommand";
import { RampReleaseCommandInput, RampReleaseCommandOutput } from "./commands/RampReleaseCommand";
import { RejectControlCenterDeploymentRequestCommandInput, RejectControlCenterDeploymentRequestCommandOutput } from "./commands/RejectControlCenterDeploymentRequestCommand";
import { RequestOrganisationCommandInput, RequestOrganisationCommandOutput } from "./commands/RequestOrganisationCommand";
import { ResolveControlCenterOperationCommandInput, ResolveControlCenterOperationCommandOutput } from "./commands/ResolveControlCenterOperationCommand";
import { RollbackReleaseCommandInput, RollbackReleaseCommandOutput } from "./commands/RollbackReleaseCommand";
import { ServeReleaseCommandInput, ServeReleaseCommandOutput } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput } from "./commands/ServeReleaseV2Command";
import { UpdateControlCenterApprovalPolicyCommandInput, UpdateControlCenterApprovalPolicyCommandOutput } from "./commands/UpdateControlCenterApprovalPolicyCommand";
import { UpdateControlCenterGroupCommandInput, UpdateControlCenterGroupCommandOutput } from "./commands/UpdateControlCenterGroupCommand";
import { UpdateDimensionCommandInput, UpdateDimensionCommandOutput } from "./commands/UpdateDimensionCommand";
import { UpdateFileCommandInput, UpdateFileCommandOutput } from "./commands/UpdateFileCommand";
import { UploadFileCommandInput, UploadFileCommandOutput } from "./commands/UploadFileCommand";
import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";
export interface Airborne {
    /**
     * @see {@link AcknowledgeEmergencyRollbackCommand}
     */
    acknowledgeEmergencyRollback(args: AcknowledgeEmergencyRollbackCommandInput, options?: __HttpHandlerOptions): Promise<AcknowledgeEmergencyRollbackCommandOutput>;
    acknowledgeEmergencyRollback(args: AcknowledgeEmergencyRollbackCommandInput, cb: (err: any, data?: AcknowledgeEmergencyRollbackCommandOutput) => void): void;
    acknowledgeEmergencyRollback(args: AcknowledgeEmergencyRollbackCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: AcknowledgeEmergencyRollbackCommandOutput) => void): void;
    /**
     * @see {@link ApproveControlCenterDeploymentRequestCommand}
     */
    approveControlCenterDeploymentRequest(args: ApproveControlCenterDeploymentRequestCommandInput, options?: __HttpHandlerOptions): Promise<ApproveControlCenterDeploymentRequestCommandOutput>;
    approveControlCenterDeploymentRequest(args: ApproveControlCenterDeploymentRequestCommandInput, cb: (err: any, data?: ApproveControlCenterDeploymentRequestCommandOutput) => void): void;
    approveControlCenterDeploymentRequest(args: ApproveControlCenterDeploymentRequestCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ApproveControlCenterDeploymentRequestCommandOutput) => void): void;
    /**
     * @see {@link CancelControlCenterDeploymentRequestCommand}
     */
    cancelControlCenterDeploymentRequest(args: CancelControlCenterDeploymentRequestCommandInput, options?: __HttpHandlerOptions): Promise<CancelControlCenterDeploymentRequestCommandOutput>;
    cancelControlCenterDeploymentRequest(args: CancelControlCenterDeploymentRequestCommandInput, cb: (err: any, data?: CancelControlCenterDeploymentRequestCommandOutput) => void): void;
    cancelControlCenterDeploymentRequest(args: CancelControlCenterDeploymentRequestCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CancelControlCenterDeploymentRequestCommandOutput) => void): void;
    /**
     * @see {@link ConcludeReleaseCommand}
     */
    concludeRelease(args: ConcludeReleaseCommandInput, options?: __HttpHandlerOptions): Promise<ConcludeReleaseCommandOutput>;
    concludeRelease(args: ConcludeReleaseCommandInput, cb: (err: any, data?: ConcludeReleaseCommandOutput) => void): void;
    concludeRelease(args: ConcludeReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ConcludeReleaseCommandOutput) => void): void;
    /**
     * @see {@link CreateApplicationCommand}
     */
    createApplication(args: CreateApplicationCommandInput, options?: __HttpHandlerOptions): Promise<CreateApplicationCommandOutput>;
    createApplication(args: CreateApplicationCommandInput, cb: (err: any, data?: CreateApplicationCommandOutput) => void): void;
    createApplication(args: CreateApplicationCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateApplicationCommandOutput) => void): void;
    /**
     * @see {@link CreateCohortRangeCommand}
     */
    createCohortRange(args: CreateCohortRangeCommandInput, options?: __HttpHandlerOptions): Promise<CreateCohortRangeCommandOutput>;
    createCohortRange(args: CreateCohortRangeCommandInput, cb: (err: any, data?: CreateCohortRangeCommandOutput) => void): void;
    createCohortRange(args: CreateCohortRangeCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateCohortRangeCommandOutput) => void): void;
    /**
     * @see {@link CreateControlCenterDeploymentRequestCommand}
     */
    createControlCenterDeploymentRequest(args: CreateControlCenterDeploymentRequestCommandInput, options?: __HttpHandlerOptions): Promise<CreateControlCenterDeploymentRequestCommandOutput>;
    createControlCenterDeploymentRequest(args: CreateControlCenterDeploymentRequestCommandInput, cb: (err: any, data?: CreateControlCenterDeploymentRequestCommandOutput) => void): void;
    createControlCenterDeploymentRequest(args: CreateControlCenterDeploymentRequestCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateControlCenterDeploymentRequestCommandOutput) => void): void;
    /**
     * @see {@link CreateControlCenterGroupCommand}
     */
    createControlCenterGroup(args: CreateControlCenterGroupCommandInput, options?: __HttpHandlerOptions): Promise<CreateControlCenterGroupCommandOutput>;
    createControlCenterGroup(args: CreateControlCenterGroupCommandInput, cb: (err: any, data?: CreateControlCenterGroupCommandOutput) => void): void;
    createControlCenterGroup(args: CreateControlCenterGroupCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: CreateControlCenterGroupCommandOutput) => void): void;
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
     * @see {@link DeleteControlCenterGroupCommand}
     */
    deleteControlCenterGroup(args: DeleteControlCenterGroupCommandInput, options?: __HttpHandlerOptions): Promise<DeleteControlCenterGroupCommandOutput>;
    deleteControlCenterGroup(args: DeleteControlCenterGroupCommandInput, cb: (err: any, data?: DeleteControlCenterGroupCommandOutput) => void): void;
    deleteControlCenterGroup(args: DeleteControlCenterGroupCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: DeleteControlCenterGroupCommandOutput) => void): void;
    /**
     * @see {@link DeleteDimensionCommand}
     */
    deleteDimension(args: DeleteDimensionCommandInput, options?: __HttpHandlerOptions): Promise<DeleteDimensionCommandOutput>;
    deleteDimension(args: DeleteDimensionCommandInput, cb: (err: any, data?: DeleteDimensionCommandOutput) => void): void;
    deleteDimension(args: DeleteDimensionCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: DeleteDimensionCommandOutput) => void): void;
    /**
     * @see {@link DiscardReleaseCommand}
     */
    discardRelease(args: DiscardReleaseCommandInput, options?: __HttpHandlerOptions): Promise<DiscardReleaseCommandOutput>;
    discardRelease(args: DiscardReleaseCommandInput, cb: (err: any, data?: DiscardReleaseCommandOutput) => void): void;
    discardRelease(args: DiscardReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: DiscardReleaseCommandOutput) => void): void;
    /**
     * @see {@link GetControlCenterApprovalPolicyCommand}
     */
    getControlCenterApprovalPolicy(args: GetControlCenterApprovalPolicyCommandInput, options?: __HttpHandlerOptions): Promise<GetControlCenterApprovalPolicyCommandOutput>;
    getControlCenterApprovalPolicy(args: GetControlCenterApprovalPolicyCommandInput, cb: (err: any, data?: GetControlCenterApprovalPolicyCommandOutput) => void): void;
    getControlCenterApprovalPolicy(args: GetControlCenterApprovalPolicyCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetControlCenterApprovalPolicyCommandOutput) => void): void;
    /**
     * @see {@link GetControlCenterDeploymentRequestCommand}
     */
    getControlCenterDeploymentRequest(args: GetControlCenterDeploymentRequestCommandInput, options?: __HttpHandlerOptions): Promise<GetControlCenterDeploymentRequestCommandOutput>;
    getControlCenterDeploymentRequest(args: GetControlCenterDeploymentRequestCommandInput, cb: (err: any, data?: GetControlCenterDeploymentRequestCommandOutput) => void): void;
    getControlCenterDeploymentRequest(args: GetControlCenterDeploymentRequestCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetControlCenterDeploymentRequestCommandOutput) => void): void;
    /**
     * @see {@link GetControlCenterDeploymentsCommand}
     */
    getControlCenterDeployments(): Promise<GetControlCenterDeploymentsCommandOutput>;
    getControlCenterDeployments(args: GetControlCenterDeploymentsCommandInput, options?: __HttpHandlerOptions): Promise<GetControlCenterDeploymentsCommandOutput>;
    getControlCenterDeployments(args: GetControlCenterDeploymentsCommandInput, cb: (err: any, data?: GetControlCenterDeploymentsCommandOutput) => void): void;
    getControlCenterDeployments(args: GetControlCenterDeploymentsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetControlCenterDeploymentsCommandOutput) => void): void;
    /**
     * @see {@link GetControlCenterOverviewCommand}
     */
    getControlCenterOverview(): Promise<GetControlCenterOverviewCommandOutput>;
    getControlCenterOverview(args: GetControlCenterOverviewCommandInput, options?: __HttpHandlerOptions): Promise<GetControlCenterOverviewCommandOutput>;
    getControlCenterOverview(args: GetControlCenterOverviewCommandInput, cb: (err: any, data?: GetControlCenterOverviewCommandOutput) => void): void;
    getControlCenterOverview(args: GetControlCenterOverviewCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetControlCenterOverviewCommandOutput) => void): void;
    /**
     * @see {@link GetControlCenterReleaseEventsCommand}
     */
    getControlCenterReleaseEvents(args: GetControlCenterReleaseEventsCommandInput, options?: __HttpHandlerOptions): Promise<GetControlCenterReleaseEventsCommandOutput>;
    getControlCenterReleaseEvents(args: GetControlCenterReleaseEventsCommandInput, cb: (err: any, data?: GetControlCenterReleaseEventsCommandOutput) => void): void;
    getControlCenterReleaseEvents(args: GetControlCenterReleaseEventsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetControlCenterReleaseEventsCommandOutput) => void): void;
    /**
     * @see {@link GetControlCenterRollbackPreviewCommand}
     */
    getControlCenterRollbackPreview(args: GetControlCenterRollbackPreviewCommandInput, options?: __HttpHandlerOptions): Promise<GetControlCenterRollbackPreviewCommandOutput>;
    getControlCenterRollbackPreview(args: GetControlCenterRollbackPreviewCommandInput, cb: (err: any, data?: GetControlCenterRollbackPreviewCommandOutput) => void): void;
    getControlCenterRollbackPreview(args: GetControlCenterRollbackPreviewCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetControlCenterRollbackPreviewCommandOutput) => void): void;
    /**
     * @see {@link GetReleaseCommand}
     */
    getRelease(args: GetReleaseCommandInput, options?: __HttpHandlerOptions): Promise<GetReleaseCommandOutput>;
    getRelease(args: GetReleaseCommandInput, cb: (err: any, data?: GetReleaseCommandOutput) => void): void;
    getRelease(args: GetReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetReleaseCommandOutput) => void): void;
    /**
     * @see {@link GetServingPolicyCommand}
     */
    getServingPolicy(args: GetServingPolicyCommandInput, options?: __HttpHandlerOptions): Promise<GetServingPolicyCommandOutput>;
    getServingPolicy(args: GetServingPolicyCommandInput, cb: (err: any, data?: GetServingPolicyCommandOutput) => void): void;
    getServingPolicy(args: GetServingPolicyCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetServingPolicyCommandOutput) => void): void;
    /**
     * @see {@link GetTelemetrySummaryCommand}
     */
    getTelemetrySummary(args: GetTelemetrySummaryCommandInput, options?: __HttpHandlerOptions): Promise<GetTelemetrySummaryCommandOutput>;
    getTelemetrySummary(args: GetTelemetrySummaryCommandInput, cb: (err: any, data?: GetTelemetrySummaryCommandOutput) => void): void;
    getTelemetrySummary(args: GetTelemetrySummaryCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetTelemetrySummaryCommandOutput) => void): void;
    /**
     * @see {@link GetUserCommand}
     */
    getUser(): Promise<GetUserCommandOutput>;
    getUser(args: GetUserCommandInput, options?: __HttpHandlerOptions): Promise<GetUserCommandOutput>;
    getUser(args: GetUserCommandInput, cb: (err: any, data?: GetUserCommandOutput) => void): void;
    getUser(args: GetUserCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetUserCommandOutput) => void): void;
    /**
     * @see {@link IngestTelemetryReportsCommand}
     */
    ingestTelemetryReports(args: IngestTelemetryReportsCommandInput, options?: __HttpHandlerOptions): Promise<IngestTelemetryReportsCommandOutput>;
    ingestTelemetryReports(args: IngestTelemetryReportsCommandInput, cb: (err: any, data?: IngestTelemetryReportsCommandOutput) => void): void;
    ingestTelemetryReports(args: IngestTelemetryReportsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: IngestTelemetryReportsCommandOutput) => void): void;
    /**
     * @see {@link ListControlCenterDeploymentRequestsCommand}
     */
    listControlCenterDeploymentRequests(args: ListControlCenterDeploymentRequestsCommandInput, options?: __HttpHandlerOptions): Promise<ListControlCenterDeploymentRequestsCommandOutput>;
    listControlCenterDeploymentRequests(args: ListControlCenterDeploymentRequestsCommandInput, cb: (err: any, data?: ListControlCenterDeploymentRequestsCommandOutput) => void): void;
    listControlCenterDeploymentRequests(args: ListControlCenterDeploymentRequestsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListControlCenterDeploymentRequestsCommandOutput) => void): void;
    /**
     * @see {@link ListControlCenterGroupsCommand}
     */
    listControlCenterGroups(args: ListControlCenterGroupsCommandInput, options?: __HttpHandlerOptions): Promise<ListControlCenterGroupsCommandOutput>;
    listControlCenterGroups(args: ListControlCenterGroupsCommandInput, cb: (err: any, data?: ListControlCenterGroupsCommandOutput) => void): void;
    listControlCenterGroups(args: ListControlCenterGroupsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListControlCenterGroupsCommandOutput) => void): void;
    /**
     * @see {@link ListControlCenterOperationsCommand}
     */
    listControlCenterOperations(args: ListControlCenterOperationsCommandInput, options?: __HttpHandlerOptions): Promise<ListControlCenterOperationsCommandOutput>;
    listControlCenterOperations(args: ListControlCenterOperationsCommandInput, cb: (err: any, data?: ListControlCenterOperationsCommandOutput) => void): void;
    listControlCenterOperations(args: ListControlCenterOperationsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListControlCenterOperationsCommandOutput) => void): void;
    /**
     * @see {@link ListDimensionsCommand}
     */
    listDimensions(args: ListDimensionsCommandInput, options?: __HttpHandlerOptions): Promise<ListDimensionsCommandOutput>;
    listDimensions(args: ListDimensionsCommandInput, cb: (err: any, data?: ListDimensionsCommandOutput) => void): void;
    listDimensions(args: ListDimensionsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListDimensionsCommandOutput) => void): void;
    /**
     * @see {@link ListFileGroupsCommand}
     */
    listFileGroups(args: ListFileGroupsCommandInput, options?: __HttpHandlerOptions): Promise<ListFileGroupsCommandOutput>;
    listFileGroups(args: ListFileGroupsCommandInput, cb: (err: any, data?: ListFileGroupsCommandOutput) => void): void;
    listFileGroups(args: ListFileGroupsCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ListFileGroupsCommandOutput) => void): void;
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
     * @see {@link PreviewServingPolicyCommand}
     */
    previewServingPolicy(args: PreviewServingPolicyCommandInput, options?: __HttpHandlerOptions): Promise<PreviewServingPolicyCommandOutput>;
    previewServingPolicy(args: PreviewServingPolicyCommandInput, cb: (err: any, data?: PreviewServingPolicyCommandOutput) => void): void;
    previewServingPolicy(args: PreviewServingPolicyCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: PreviewServingPolicyCommandOutput) => void): void;
    /**
     * @see {@link PutServingPolicyCommand}
     */
    putServingPolicy(args: PutServingPolicyCommandInput, options?: __HttpHandlerOptions): Promise<PutServingPolicyCommandOutput>;
    putServingPolicy(args: PutServingPolicyCommandInput, cb: (err: any, data?: PutServingPolicyCommandOutput) => void): void;
    putServingPolicy(args: PutServingPolicyCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: PutServingPolicyCommandOutput) => void): void;
    /**
     * @see {@link RampReleaseCommand}
     */
    rampRelease(args: RampReleaseCommandInput, options?: __HttpHandlerOptions): Promise<RampReleaseCommandOutput>;
    rampRelease(args: RampReleaseCommandInput, cb: (err: any, data?: RampReleaseCommandOutput) => void): void;
    rampRelease(args: RampReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: RampReleaseCommandOutput) => void): void;
    /**
     * @see {@link RejectControlCenterDeploymentRequestCommand}
     */
    rejectControlCenterDeploymentRequest(args: RejectControlCenterDeploymentRequestCommandInput, options?: __HttpHandlerOptions): Promise<RejectControlCenterDeploymentRequestCommandOutput>;
    rejectControlCenterDeploymentRequest(args: RejectControlCenterDeploymentRequestCommandInput, cb: (err: any, data?: RejectControlCenterDeploymentRequestCommandOutput) => void): void;
    rejectControlCenterDeploymentRequest(args: RejectControlCenterDeploymentRequestCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: RejectControlCenterDeploymentRequestCommandOutput) => void): void;
    /**
     * @see {@link RequestOrganisationCommand}
     */
    requestOrganisation(args: RequestOrganisationCommandInput, options?: __HttpHandlerOptions): Promise<RequestOrganisationCommandOutput>;
    requestOrganisation(args: RequestOrganisationCommandInput, cb: (err: any, data?: RequestOrganisationCommandOutput) => void): void;
    requestOrganisation(args: RequestOrganisationCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: RequestOrganisationCommandOutput) => void): void;
    /**
     * @see {@link ResolveControlCenterOperationCommand}
     */
    resolveControlCenterOperation(args: ResolveControlCenterOperationCommandInput, options?: __HttpHandlerOptions): Promise<ResolveControlCenterOperationCommandOutput>;
    resolveControlCenterOperation(args: ResolveControlCenterOperationCommandInput, cb: (err: any, data?: ResolveControlCenterOperationCommandOutput) => void): void;
    resolveControlCenterOperation(args: ResolveControlCenterOperationCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ResolveControlCenterOperationCommandOutput) => void): void;
    /**
     * @see {@link RollbackReleaseCommand}
     */
    rollbackRelease(args: RollbackReleaseCommandInput, options?: __HttpHandlerOptions): Promise<RollbackReleaseCommandOutput>;
    rollbackRelease(args: RollbackReleaseCommandInput, cb: (err: any, data?: RollbackReleaseCommandOutput) => void): void;
    rollbackRelease(args: RollbackReleaseCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: RollbackReleaseCommandOutput) => void): void;
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
     * @see {@link UpdateControlCenterApprovalPolicyCommand}
     */
    updateControlCenterApprovalPolicy(args: UpdateControlCenterApprovalPolicyCommandInput, options?: __HttpHandlerOptions): Promise<UpdateControlCenterApprovalPolicyCommandOutput>;
    updateControlCenterApprovalPolicy(args: UpdateControlCenterApprovalPolicyCommandInput, cb: (err: any, data?: UpdateControlCenterApprovalPolicyCommandOutput) => void): void;
    updateControlCenterApprovalPolicy(args: UpdateControlCenterApprovalPolicyCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UpdateControlCenterApprovalPolicyCommandOutput) => void): void;
    /**
     * @see {@link UpdateControlCenterGroupCommand}
     */
    updateControlCenterGroup(args: UpdateControlCenterGroupCommandInput, options?: __HttpHandlerOptions): Promise<UpdateControlCenterGroupCommandOutput>;
    updateControlCenterGroup(args: UpdateControlCenterGroupCommandInput, cb: (err: any, data?: UpdateControlCenterGroupCommandOutput) => void): void;
    updateControlCenterGroup(args: UpdateControlCenterGroupCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UpdateControlCenterGroupCommandOutput) => void): void;
    /**
     * @see {@link UpdateDimensionCommand}
     */
    updateDimension(args: UpdateDimensionCommandInput, options?: __HttpHandlerOptions): Promise<UpdateDimensionCommandOutput>;
    updateDimension(args: UpdateDimensionCommandInput, cb: (err: any, data?: UpdateDimensionCommandOutput) => void): void;
    updateDimension(args: UpdateDimensionCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UpdateDimensionCommandOutput) => void): void;
    /**
     * @see {@link UpdateFileCommand}
     */
    updateFile(args: UpdateFileCommandInput, options?: __HttpHandlerOptions): Promise<UpdateFileCommandOutput>;
    updateFile(args: UpdateFileCommandInput, cb: (err: any, data?: UpdateFileCommandOutput) => void): void;
    updateFile(args: UpdateFileCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UpdateFileCommandOutput) => void): void;
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
