import { AirborneServiceException as __BaseException } from "./AirborneServiceException";
import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import { StreamingBlobTypes, DocumentType as __DocumentType } from "@smithy/types";
/**
 * @public
 */
export interface AcknowledgeEmergencyRollbackInput {
    release_id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
    /**
     * Independent review explanation; must be nonblank.
     * @public
     */
    reason: string | undefined;
}
/**
 * @public
 */
export interface AcknowledgeEmergencyRollbackResponse {
    success: boolean | undefined;
}
/**
 * Bad request error
 * @public
 */
export declare class BadRequestError extends __BaseException {
    readonly name: "BadRequestError";
    readonly $fault: "client";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Airborne error code (AB_005).
     * @public
     */
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<BadRequestError, __BaseException>);
}
/**
 * Conflict error returned when a release is not in a state that allows the requested change: it cannot be rolled back, has already concluded or been discarded, must be ramped before it is concluded, or another release is already ongoing for the same dimensions. Refresh the release state before retrying.
 * @public
 */
export declare class ConflictError extends __BaseException {
    readonly name: "ConflictError";
    readonly $fault: "client";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Airborne error code (AB_007).
     * @public
     */
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ConflictError, __BaseException>);
}
/**
 * @public
 */
export declare class ForbiddenError extends __BaseException {
    readonly name: "ForbiddenError";
    readonly $fault: "client";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Airborne error code (AB_006).
     * @public
     */
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ForbiddenError, __BaseException>);
}
/**
 * Internal server error
 * @public
 */
export declare class InternalServerError extends __BaseException {
    readonly name: "InternalServerError";
    readonly $fault: "server";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Airborne error code (AB_003).
     * @public
     */
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InternalServerError, __BaseException>);
}
/**
 * Not found error
 * @public
 */
export declare class NotFoundError extends __BaseException {
    readonly name: "NotFoundError";
    readonly $fault: "client";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Airborne error code (AB_001).
     * @public
     */
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<NotFoundError, __BaseException>);
}
/**
 * Unauthorized error
 * @public
 */
export declare class Unauthorized extends __BaseException {
    readonly name: "Unauthorized";
    readonly $fault: "client";
    /**
     * Airborne error code (for example, AB_004).
     * @public
     */
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<Unauthorized, __BaseException>);
}
/**
 * @public
 */
export interface ApproveControlCenterDeploymentRequestInput {
    id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
    reason?: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const DeploymentRequestAction: {
    readonly CONCLUDE: "conclude";
    readonly CREATE: "create";
    readonly DISCARD: "discard";
    readonly RAMP: "ramp";
    readonly ROLLBACK: "rollback";
    readonly SET_ROLLBACK_SENSITIVE: "set_rollback_sensitive";
    readonly SET_STRICT_SERVING: "set_strict_serving";
    readonly UPDATE: "update";
};
/**
 * @public
 */
export type DeploymentRequestAction = typeof DeploymentRequestAction[keyof typeof DeploymentRequestAction];
/**
 * Frozen action payload returned by the server, including its resolved immutable snapshot.
 * @public
 */
export interface DeploymentRequestPayload {
    body?: __DocumentType | undefined;
    release_id?: string | undefined;
    snapshot?: __DocumentType | undefined;
}
/**
 * @public
 * @enum
 */
export declare const DeploymentRequestStatus: {
    readonly CANCELLED: "cancelled";
    readonly EXECUTED: "executed";
    readonly EXECUTING: "executing";
    readonly EXPIRED: "expired";
    readonly FAILED: "failed";
    readonly PENDING: "pending";
    readonly REJECTED: "rejected";
    readonly STALE: "stale";
};
/**
 * @public
 */
export type DeploymentRequestStatus = typeof DeploymentRequestStatus[keyof typeof DeploymentRequestStatus];
/**
 * Immutable deployment request and its latest decision/result.
 * @public
 */
export interface ControlCenterDeploymentRequest {
    /**
     * UUID.
     * @public
     */
    id: string | undefined;
    org: string | undefined;
    application: string | undefined;
    /**
     * Supported approved release mutation.
     * @public
     */
    action: DeploymentRequestAction | undefined;
    /**
     * Frozen action payload returned by the server, including its resolved immutable snapshot.
     * @public
     */
    payload: DeploymentRequestPayload | undefined;
    /**
     * Lowercase hexadecimal SHA-256 digest of the immutable approved content.
     * @public
     */
    payload_hash: string | undefined;
    /**
     * Snapshot of application release/config state at request creation. Keep as a document; it is not an editable approval body.
     * @public
     */
    base_state: __DocumentType | undefined;
    requester: string | undefined;
    reason: string | undefined;
    status: DeploymentRequestStatus | undefined;
    expires_at: Date | undefined;
    /**
     * Subject of the latest decision, or JSON null.
     * @public
     */
    decided_by: __DocumentType | undefined;
    /**
     * Decision explanation, or JSON null.
     * @public
     */
    decision_reason: __DocumentType | undefined;
    created_at: Date | undefined;
    updated_at: Date | undefined;
    /**
     * Existing action execution result or JSON null.
     * @public
     */
    result: __DocumentType | undefined;
}
/**
 * @public
 * @enum
 */
export declare const RollbackFailureStage: {
    readonly CONCLUDE: "conclude";
    /**
     * The server is creating or recovering the replacement before recording its identifier.
     */
    readonly CREATE: "create";
    readonly RAMP: "ramp";
};
/**
 * @public
 */
export type RollbackFailureStage = typeof RollbackFailureStage[keyof typeof RollbackFailureStage];
/**
 * Returned when the durable replacement create, ramp, or conclude step needs recovery. Repeat the same rollback after reviewing upstream state.
 * @public
 */
export declare class RollbackPartialFailureError extends __BaseException {
    readonly name: "RollbackPartialFailureError";
    readonly $fault: "server";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Airborne error code (AB_003).
     * @public
     */
    code: string | undefined;
    /**
     * Identifier of the replacement release, or JSON null when no replacement was created.
     * @public
     */
    replacement_release_id: __DocumentType | undefined;
    /**
     * Durable rollback operation identifier.
     * @public
     */
    rollback_operation_id: string | undefined;
    /**
     * Step that failed.
     * @public
     */
    stage: RollbackFailureStage | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<RollbackPartialFailureError, __BaseException>);
}
/**
 * Returned by rollback when no earlier live release exists or the historical package and config cannot be reconciled. Nothing is created.
 * @public
 */
export declare class RollbackUnprocessableError extends __BaseException {
    readonly name: "RollbackUnprocessableError";
    readonly $fault: "client";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    /**
     * Rollback block code: `no_predecessor` or `incompatible`.
     * @public
     */
    code: string | undefined;
    /**
     * The live release for this dimensions context, or JSON null.
     * @public
     */
    current_live_release_id: __DocumentType | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<RollbackUnprocessableError, __BaseException>);
}
/**
 * A write has an unknown upstream outcome. Inspect its real state and change history before resolving it; elapsed time alone does not establish rejection. An upstream 4xx is not proof that nothing was written, because the upstream handler can return it after configuration effects. While the operation is unresolved, writes for the application stay paused. When the 409 comes from a recovery attempt it can name the config keys or contexts that changed and must be restored, or finished and resolved as applied.
 * @public
 */
export declare class UnresolvedOperationError extends __BaseException {
    readonly name: "UnresolvedOperationError";
    readonly $fault: "client";
    code: string | undefined;
    operation_id: string | undefined;
    /**
     * The exact state expected after the upstream write.
     * @public
     */
    expected: __DocumentType | undefined;
    /**
     * The state observed before dispatch.
     * @public
     */
    before: __DocumentType | undefined;
    upstream_workspace: __DocumentType | undefined;
    upstream_org: __DocumentType | undefined;
    /**
     * True when this request itself may have changed upstream state; absent when an earlier write is blocking this request.
     * @public
     */
    own_attempt?: boolean | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<UnresolvedOperationError, __BaseException>);
}
/**
 * @public
 */
export interface CancelControlCenterDeploymentRequestInput {
    id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
    reason?: string | undefined;
}
/**
 * A direct release write was refused because this application requires an approved deployment request.
 * @public
 */
export declare class ApprovalRequiredError extends __BaseException {
    readonly name: "ApprovalRequiredError";
    readonly $fault: "client";
    code: string | undefined;
    application: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ApprovalRequiredError, __BaseException>);
}
/**
 * Request to conclude a release.
 * @public
 */
export interface ConcludeReleaseInput {
    /**
     * ID of the release (the experiment id returned by CreateRelease).
     * @public
     */
    release_id: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Variant to make permanent: the control variant keeps the previous release live, an experimental variant promotes this release. Take the id from experiment.experiment_variants on GetRelease; the experiment service generates the ids, so they cannot be guessed. An unknown variant returns 400 and names the available ones.
     * @public
     */
    chosen_variant: string | undefined;
    /**
     * Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
     * @public
     */
    change_reason?: string | undefined;
}
/**
 * Result of concluding a release.
 * @public
 */
export interface ConcludeReleaseResponse {
    /**
     * Always true; failures are returned as errors.
     * @public
     */
    success: boolean | undefined;
    /**
     * Human-readable summary.
     * @public
     */
    message: string | undefined;
    /**
     * ID of the concluded release.
     * @public
     */
    experiment_id: string | undefined;
    /**
     * Variant that was made permanent.
     * @public
     */
    chosen_variant: string | undefined;
}
/**
 * Application information
 * @public
 */
export interface Application {
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Access levels of the user for the organisation
     * @public
     */
    access: (string)[] | undefined;
}
/**
 * Create application request
 * @public
 */
export interface CreateApplicationRequest {
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
}
/**
 * @public
 */
export interface CreateCohortRangeInput {
    organisation: string | undefined;
    application: string | undefined;
    dimension: string | undefined;
    name: string | undefined;
    lower: string | undefined;
    upper: string | undefined;
    priority: number | undefined;
}
/**
 * @public
 */
export interface CreateCohortRangeOutput {
    name: string | undefined;
    lower: string | undefined;
    upper: string | undefined;
    priority: number | undefined;
}
/**
 * Request payload accepted from the maker. The body is action-specific and is frozen by the server.
 * @public
 */
export interface DeploymentRequestInputPayload {
    body?: __DocumentType | undefined;
    release_id?: string | undefined;
}
/**
 * Create a deployment request. The client may send only action, payload and reason; the server resolves requester, snapshot and base state.
 * @public
 */
export interface CreateControlCenterDeploymentRequestInput {
    organisation: string | undefined;
    application: string | undefined;
    /**
     * Supported approved release mutation.
     * @public
     */
    action: DeploymentRequestAction | undefined;
    /**
     * Request payload accepted from the maker. The body is action-specific and is frozen by the server.
     * @public
     */
    payload: DeploymentRequestInputPayload | undefined;
    /**
     * Nonblank maker explanation. Reserved "Airborne operation" text is refused.
     * @public
     */
    reason: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ControlCenterPlatform: {
    readonly ANDROID: "android";
    readonly IOS: "ios";
    readonly OTHER: "other";
    readonly WEB: "web";
};
/**
 * @public
 */
export type ControlCenterPlatform = typeof ControlCenterPlatform[keyof typeof ControlCenterPlatform];
/**
 * A group member identifies an application and the platform label shown in Control Center.
 * @public
 */
export interface ControlCenterGroupMember {
    application: string | undefined;
    /**
     * Supported application platforms for a Control Center group member.
     * @public
     */
    platform: ControlCenterPlatform | undefined;
}
/**
 * A configured application group.
 * @public
 */
export interface ControlCenterGroup {
    /**
     * UUID identifying the group.
     * @public
     */
    id: string | undefined;
    name: string | undefined;
    members: (ControlCenterGroupMember)[] | undefined;
}
/**
 * Input for creating a group.
 * @public
 */
export interface CreateControlCenterGroupInput {
    organisation: string | undefined;
    name: string | undefined;
    members: (ControlCenterGroupMember)[] | undefined;
}
/**
 * @public
 * @enum
 */
export declare const DimensionType: {
    /**
     * A cohort dimension whose values depend on another dimension.
     */
    readonly COHORT: "cohort";
    /**
     * A standard dimension with independent values.
     */
    readonly STANDARD: "standard";
};
/**
 * @public
 */
export type DimensionType = typeof DimensionType[keyof typeof DimensionType];
/**
 * Create dimension request type
 * @public
 */
export interface CreateDimensionRequest {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Description of the dimension
     * @public
     */
    description: string | undefined;
    /**
     * Type of the dimension
     * @public
     */
    dimension_type: DimensionType | undefined;
    /**
     * Identifier of the dimension this depends on (required for cohort dimensions, ignored for standard dimensions)
     * @public
     */
    depends_on?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * A created dimension.
 * @public
 */
export interface CreateDimensionResponse {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Description of the dimension
     * @public
     */
    description: __DocumentType | undefined;
    /**
     * Position of the dimension
     * @public
     */
    position: number | undefined;
    /**
     * Schema of the dimension
     * @public
     */
    schema?: __DocumentType | undefined;
    /**
     * Reason for the change
     * @public
     */
    change_reason: string | undefined;
}
/**
 * Create file request
 * @public
 */
export interface CreateFileRequest {
    /**
     * Path where the file will be stored on sdk
     * @public
     */
    file_path: string | undefined;
    /**
     * URL from where the file can be downloaded
     * @public
     */
    url: string | undefined;
    /**
     * Tag to identify the file
     * @public
     */
    tag?: string | undefined;
    /**
     * Metadata associated with the file in Stringified JSON format or a file attachment
     * @public
     */
    metadata?: __DocumentType | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Create file response
 * @public
 */
export interface CreateFileResponse {
    /**
     * id of the file
     * @public
     */
    id: string | undefined;
    /**
     * Path where the file is stored on sdk
     * @public
     */
    file_path: string | undefined;
    /**
     * URL from where the file can be downloaded
     * @public
     */
    url: string | undefined;
    /**
     * Version of the file
     * @public
     */
    version: number | undefined;
    /**
     * Tag associated with the file
     * @public
     */
    tag?: string | undefined;
    /**
     * Size of the file in bytes
     * @public
     */
    size: number | undefined;
    /**
     * Checksum of the file
     * @public
     */
    checksum: string | undefined;
    /**
     * Metadata associated with the file
     * @public
     */
    metadata: __DocumentType | undefined;
    /**
     * Status of the file
     * @public
     */
    status: string | undefined;
    /**
     * Date of creation of the file
     * @public
     */
    created_at: string | undefined;
}
/**
 * Organisation creation request
 * @public
 */
export interface CreateOrganisationRequest {
    /**
     * Name for the new organisation.
     * @public
     */
    name: string | undefined;
}
/**
 * Organisation information
 * @public
 */
export interface Organisation {
    /**
     * Name of the organisation
     * @public
     */
    name: string | undefined;
    /**
     * List of applications under the organisation
     * @public
     */
    applications: (Application)[] | undefined;
    /**
     * Access levels of the user for the organisation
     * @public
     */
    access: (string)[] | undefined;
}
/**
 * Create package request
 * @public
 */
export interface CreatePackageRequest {
    /**
     * Index file id
     * @public
     */
    index: string | undefined;
    /**
     * Optional tag to identify the package.
     * @public
     */
    tag?: string | undefined;
    /**
     * Space Separated file ids to be included in the package
     * @public
     */
    files: (string)[] | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Package information
 * @public
 */
export interface Package {
    /**
     * Optional tag identifying the package.
     * @public
     */
    tag?: string | undefined;
    /**
     * Version number assigned to the package.
     * @public
     */
    version: number | undefined;
    /**
     * File id of the package's index (entry) file.
     * @public
     */
    index: string | undefined;
    /**
     * File ids included in the package.
     * @public
     */
    files: (string)[] | undefined;
}
/**
 * Create release request config
 * @public
 */
export interface CreateReleaseRequestConfig {
    /**
     * Timeout for the release config in seconds
     * @public
     */
    release_config_timeout: number | undefined;
    /**
     * Timeout for the package in seconds
     * @public
     */
    boot_timeout: number | undefined;
    /**
     * Properties of the config in Stringified JSON format
     * @public
     */
    properties: __DocumentType | undefined;
}
/**
 * Create release request package
 * @public
 */
export interface CreateReleaseRequestPackage {
    /**
     * Properties of the package in Stringified JSON format or a file attachment
     * @public
     */
    properties?: __DocumentType | undefined;
    /**
     * Important files in the package
     * @public
     */
    important?: (string)[] | undefined;
    /**
     * Lazy files in the package
     * @public
     */
    lazy?: (string)[] | undefined;
}
/**
 * @public
 * @enum
 */
export declare const RollbackSensitiveReason: {
    readonly ONE_WAY_MIGRATION: "one_way_migration";
    readonly SECURITY: "security";
};
/**
 * @public
 */
export type RollbackSensitiveReason = typeof RollbackSensitiveReason[keyof typeof RollbackSensitiveReason];
/**
 * Request body for creating a release.
 * @public
 */
export interface CreateReleaseRequest {
    /**
     * config for the release
     * @public
     */
    config: CreateReleaseRequestConfig | undefined;
    /**
     * Package ID for the release
     * @public
     */
    package_id?: string | undefined;
    /**
     * Package details for the release
     * @public
     */
    package?: CreateReleaseRequestPackage | undefined;
    /**
     * Dimensions for the release in key-value format
     * @public
     */
    dimensions?: Record<string, __DocumentType> | undefined;
    /**
     * Resources for the release
     * @public
     */
    resources?: (string)[] | undefined;
    /**
     * Audited operator declaration for custom native compatibility targeting; at least 20 characters. Does not permit empty targeting.
     * @public
     */
    compatibility_exception?: string | undefined;
    /**
     * Optional declared reason this release needs additional rollback protection.
     * @public
     */
    rollback_sensitive?: RollbackSensitiveReason | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Configuration properties
 * @public
 */
export interface ConfigProperties {
    /**
     * Tenant-specific configuration, as a JSON document.
     * @public
     */
    tenant_info: __DocumentType | undefined;
}
/**
 * Resolved release configuration returned to callers.
 * @public
 */
export interface GetReleaseConfig {
    /**
     * Version identifier of the config.
     * @public
     */
    version: string | undefined;
    /**
     * Time allowed for fetching the release config, in milliseconds.
     * @public
     */
    release_config_timeout: number | undefined;
    /**
     * Time allowed for the app to boot, in milliseconds.
     * @public
     */
    boot_timeout: number | undefined;
    /**
     * Config properties.
     * @public
     */
    properties: ConfigProperties | undefined;
}
/**
 * Variant ids of the experiment backing a release. Pass one of these as chosen_variant when concluding.
 * @public
 */
export interface ExperimentVariants {
    /**
     * Id of the control variant, which keeps the previous release live. The experiment service prefixes it with the release id, for example "7522252134449025024-control".
     * @public
     */
    control?: string | undefined;
    /**
     * Ids of the experimental variants, which promote this release, for example "7522252134449025024-experimental_1". A release created by Airborne has exactly one.
     * @public
     */
    experimentals?: (string)[] | undefined;
}
/**
 * Details of the experiment backing a release, used to ramp it out gradually.
 * @public
 */
export interface ReleaseExperiment {
    /**
     * Identifier of the experiment.
     * @public
     */
    experiment_id?: string | undefined;
    /**
     * Variant ids that can be chosen when concluding the release.
     * @public
     */
    experiment_variants?: ExperimentVariants | undefined;
    /**
     * Package version served by the experiment.
     * @public
     */
    package_version?: number | undefined;
    /**
     * Config version served by the experiment.
     * @public
     */
    config_version?: string | undefined;
    /**
     * Time the experiment was created.
     * @public
     */
    created_at?: string | undefined;
    /**
     * Percentage of traffic currently routed to this release.
     * @public
     */
    traffic_percentage?: number | undefined;
    /**
     * Current status of the experiment.
     * @public
     */
    status?: string | undefined;
}
/**
 * A file as served to the SDK, with the location and checksum needed to download and verify it.
 * @public
 */
export interface ServeFile {
    /**
     * Path where the file is stored on the SDK.
     * @public
     */
    file_path?: string | undefined;
    /**
     * URL the SDK downloads the file from.
     * @public
     */
    url?: string | undefined;
    /**
     * Checksum used to verify the downloaded file.
     * @public
     */
    checksum?: string | undefined;
    /**
     * Size of the file in bytes
     * @public
     */
    size?: number | undefined;
}
/**
 * A package as served to the SDK: the index file plus the files that make up the OTA bundle.
 * @public
 */
export interface ServePackage {
    /**
     * Name of the package.
     * @public
     */
    name?: string | undefined;
    /**
     * Version of the package.
     * @public
     */
    version?: string | undefined;
    /**
     * The package's index (entry) file.
     * @public
     */
    index?: ServeFile | undefined;
    /**
     * Package properties, as a JSON document.
     * @public
     */
    properties?: __DocumentType | undefined;
    /**
     * Files that must be downloaded before boot.
     * @public
     */
    important?: (ServeFile)[] | undefined;
    /**
     * Files that can be downloaded lazily after boot.
     * @public
     */
    lazy?: (ServeFile)[] | undefined;
}
/**
 * A created release.
 * @public
 */
export interface CreateReleaseResponse {
    /**
     * Advisory targeting warnings emitted by create, update and list.
     * @public
     */
    warnings?: (string)[] | undefined;
    /**
     * ID of the release
     * @public
     */
    id: string | undefined;
    /**
     * Creation time of the release
     * @public
     */
    created_at: string | undefined;
    /**
     * Status of the release
     * @public
     */
    config: GetReleaseConfig | undefined;
    /**
     * Package details of the release
     * @public
     */
    package: ServePackage | undefined;
    /**
     * Experiment details of the release
     * @public
     */
    experiment?: ReleaseExperiment | undefined;
    /**
     * Dimensions associated with the release
     * @public
     */
    dimensions: Record<string, __DocumentType> | undefined;
}
/**
 * A group UUID path parameter and the organisation whose group is being changed.
 * @public
 */
export interface ControlCenterGroupPath {
    id: string | undefined;
    organisation: string | undefined;
}
/**
 * @public
 */
export interface DeleteControlCenterGroupResponse {
    success: boolean | undefined;
}
/**
 * @public
 */
export interface DeleteDimensionRequest {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Request to discard a release.
 * @public
 */
export interface DiscardReleaseInput {
    /**
     * ID of the release (the experiment id returned by CreateRelease).
     * @public
     */
    release_id: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
     * @public
     */
    change_reason?: string | undefined;
}
/**
 * Result of discarding a release.
 * @public
 */
export interface DiscardReleaseResponse {
    /**
     * Always true; failures are returned as errors.
     * @public
     */
    success: boolean | undefined;
    /**
     * Human-readable summary.
     * @public
     */
    message: string | undefined;
    /**
     * ID of the discarded release.
     * @public
     */
    experiment_id: string | undefined;
}
/**
 * Complete application approval policy. PUT replaces the policy; omitted fields use server defaults.
 * @public
 */
export interface ControlCenterApprovalPolicy {
    enabled: boolean | undefined;
    /**
     * Sorted unique canonical identity subjects.
     * @public
     */
    makers: (string)[] | undefined;
    /**
     * Sorted unique canonical identity subjects.
     * @public
     */
    checkers: (string)[] | undefined;
    /**
     * Request lifetime in hours, from 1 through 720.
     * @public
     */
    request_ttl_hours: number | undefined;
    emergency_rollback: boolean | undefined;
}
/**
 * @public
 */
export interface GetControlCenterApprovalPolicyInput {
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * @public
 */
export interface GetControlCenterDeploymentRequestInput {
    id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * Overview is user-scoped and does not require organisation/application scope headers.
 * @public
 */
export interface GetControlCenterOverviewInput {
}
/**
 * A release that is created or currently in progress.
 * @public
 */
export interface ControlCenterActiveRelease {
    release_id: string | undefined;
    package_version: number | undefined;
    status: string | undefined;
    traffic_percentage: number | undefined;
    /**
     * Exact variant identifier of the experimental variant; conclude requires this value.
     * @public
     */
    experimental_variant: string | undefined;
    dimensions: __DocumentType | undefined;
    created_at: Date | undefined;
    created_by: string | undefined;
}
/**
 * A pending emergency rollback awaiting an independent review.
 * @public
 */
export interface EmergencyReview {
    /**
     * Present for new successful emergencies; absent on legacy rows.
     * @public
     */
    rollback_finished?: boolean | undefined;
    rolled_back_to_package_version?: __DocumentType | undefined;
    rollback_result?: __DocumentType | undefined;
    new_release_id?: __DocumentType | undefined;
    id: string | undefined;
    release_id: string | undefined;
    actor: string | undefined;
    acknowledged_by: __DocumentType | undefined;
    reason: string | undefined;
    confirm_sensitive_risk: boolean | undefined;
    plan: __DocumentType | undefined;
    created_at: Date | undefined;
}
/**
 * A release that is currently live for one dimensions context.
 * @public
 */
export interface ControlCenterLiveRelease {
    release_id: string | undefined;
    package_version: number | undefined;
    config_version: string | undefined;
    dimensions: __DocumentType | undefined;
    /**
     * RFC 3339 timestamp for the concluded live release.
     * @public
     */
    concluded_at: Date | undefined;
}
/**
 * @public
 */
export interface ReleaseProtection {
    release_id: string | undefined;
    /**
     * Explicitly cleared markers are represented as JSON null.
     * @public
     */
    rollback_sensitive: __DocumentType | undefined;
}
/**
 * @public
 */
export interface ServingPolicy {
    strict: boolean | undefined;
    deployment_override: boolean | undefined;
    effective_strict: boolean | undefined;
}
/**
 * An upstream write whose outcome has not been confirmed.
 * @public
 */
export interface ControlCenterUnresolvedOperation {
    operation_id: string | undefined;
    message: string | undefined;
}
/**
 * Release state for one application, including per-application lookup failures.
 * @public
 */
export interface ControlCenterAppStatus {
    /**
     * First unverified public manifest request, independent of telemetry retention.
     * @public
     */
    first_device_seen_at?: string | undefined;
    /**
     * Local auxiliary data unavailable or deadline exceeded; corresponding fields are null.
     * @public
     */
    auxiliary_error?: string | undefined;
    telemetry?: __DocumentType | undefined;
    cache_invalidation?: __DocumentType | undefined;
    /**
     * Stored policy plus deployment force-on override.
     * @public
     */
    serving_policy?: ServingPolicy | undefined;
    application: string | undefined;
    /**
     * Platform label from the containing group; JSON null for an ungrouped application.
     * @public
     */
    platform: __DocumentType | undefined;
    live: (ControlCenterLiveRelease)[] | undefined;
    active: (ControlCenterActiveRelease)[] | undefined;
    /**
     * Unresolved upstream writes. While any item exists, writes are paused for this application.
     * @public
     */
    unresolved_operations?: (ControlCenterUnresolvedOperation)[] | undefined;
    /**
     * RFC 3339 timestamp, or JSON null when the application has no release activity.
     * @public
     */
    last_activity_at: __DocumentType | undefined;
    /**
     * Sanitized lookup failure message, or JSON null when lookup succeeded.
     * @public
     */
    error: __DocumentType | undefined;
    /**
     * Whether this application currently requires a separate checker for protected writes.
     * @public
     */
    approval_required?: boolean | undefined;
    /**
     * Number of pending requests. This count is not capped by the queue list limit.
     * @public
     */
    pending_requests?: number | undefined;
    /**
     * Emergency rollbacks waiting for independent checker acknowledgement.
     * @public
     */
    emergency_needs_review?: (EmergencyReview)[] | undefined;
    /**
     * Local rollback sensitivity markers for releases.
     * @public
     */
    release_protections?: (ReleaseProtection)[] | undefined;
}
/**
 * A group and its release status entries in the overview response.
 * @public
 */
export interface ControlCenterOverviewGroup {
    id: string | undefined;
    name: string | undefined;
    members: (ControlCenterAppStatus)[] | undefined;
}
/**
 * @public
 */
export interface ControlCenterOrganisationOverview {
    name: string | undefined;
    groups: (ControlCenterOverviewGroup)[] | undefined;
    ungrouped: (ControlCenterAppStatus)[] | undefined;
}
/**
 * @public
 */
export interface GetControlCenterOverviewResponse {
    generated_at: Date | undefined;
    organisations: (ControlCenterOrganisationOverview)[] | undefined;
}
/**
 * Release identifier, organisation, and application used to fetch a release timeline.
 * @public
 */
export interface ControlCenterReleaseEventsInput {
    release_id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ControlCenterReleaseEventAction: {
    readonly APPROVED: "approved";
    readonly CANCELLED: "cancelled";
    readonly CONCLUDED: "concluded";
    readonly CREATED: "created";
    readonly DISCARDED: "discarded";
    readonly EMERGENCY_ACKNOWLEDGED: "emergency_acknowledged";
    readonly EMERGENCY_ROLLBACK: "emergency_rollback";
    readonly EXECUTED: "executed";
    readonly EXPIRED: "expired";
    readonly FAILED: "failed";
    readonly OPERATION_RESOLVED: "operation_resolved";
    readonly POLICY_CHANGED: "policy_changed";
    readonly RAMPED: "ramped";
    readonly REJECTED: "rejected";
    readonly REQUESTED: "requested";
    readonly ROLLED_BACK: "rolled_back";
    readonly STALE: "stale";
};
/**
 * @public
 */
export type ControlCenterReleaseEventAction = typeof ControlCenterReleaseEventAction[keyof typeof ControlCenterReleaseEventAction];
/**
 * @public
 */
export interface ControlCenterReleaseEvent {
    /**
     * Recorded timeline action. The timeline can also include synthetic created/concluded/discarded entries.
     * @public
     */
    action: ControlCenterReleaseEventAction | undefined;
    actor: string | undefined;
    created_at: Date | undefined;
    payload: __DocumentType | undefined;
    synthetic: boolean | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ControlCenterReleaseOutcome: {
    /**
     * Created or in progress.
     */
    readonly ACTIVE: "active";
    /**
     * Concluded with the control variant, so the experimental variant never went live.
     */
    readonly CONCLUDED_ON_CONTROL: "concluded_on_control";
    /**
     * Discarded before it went live.
     */
    readonly DISCARDED: "discarded";
    /**
     * Concluded on the experimental variant and still the latest live release for its dimensions.
     */
    readonly LIVE: "live";
    /**
     * Concluded on the experimental variant but replaced by a later live release.
     */
    readonly SUPERSEDED: "superseded";
};
/**
 * @public
 */
export type ControlCenterReleaseOutcome = typeof ControlCenterReleaseOutcome[keyof typeof ControlCenterReleaseOutcome];
/**
 * @public
 */
export interface GetControlCenterReleaseEventsResponse {
    events: (ControlCenterReleaseEvent)[] | undefined;
    /**
     * Server-computed outcome of a release. Clients must use this value rather than infer it from the events.
     * @public
     */
    outcome: ControlCenterReleaseOutcome | undefined;
}
/**
 * Read-authorized path and application scope for rollback preview.
 * @public
 */
export interface RollbackPreviewInput {
    release_id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * Side-effect-free rollback decision. Action, resulting package, reconciliation details and blocked are nullable when unavailable.
 * @public
 */
export interface RollbackPreviewResponse {
    /**
     * List of strings
     * @public
     */
    blocked_package_versions?: (string)[] | undefined;
    action: __DocumentType | undefined;
    current_package_version: __DocumentType | undefined;
    resulting_package_version: __DocumentType | undefined;
    reconciled_keys: __DocumentType | undefined;
    blocked: __DocumentType | undefined;
}
/**
 * Path and headers for fetching a single release.
 * @public
 */
export interface GetReleaseRequest {
    /**
     * ID of the release
     * @public
     */
    releaseId: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * A release with its full details.
 * @public
 */
export interface GetReleaseResponse {
    /**
     * Advisory targeting warnings.
     * @public
     */
    warnings?: (string)[] | undefined;
    /**
     * ID of the release.
     * @public
     */
    id?: string | undefined;
    /**
     * Time the release was created.
     * @public
     */
    created_at?: string | undefined;
    /**
     * Resolved config of the release.
     * @public
     */
    config?: GetReleaseConfig | undefined;
    /**
     * Package served by the release.
     * @public
     */
    package?: ServePackage | undefined;
    /**
     * Additional resources served with the release.
     * @public
     */
    resources?: (ServeFile)[] | undefined;
    /**
     * Experiment backing the release, when it is being ramped.
     * @public
     */
    experiment?: ReleaseExperiment | undefined;
    /**
     * Targeting dimensions the release applies to.
     * @public
     */
    dimensions?: Record<string, __DocumentType> | undefined;
}
/**
 * @public
 */
export interface GetServingPolicyInput {
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * Advisory only; reports never change releases. Native versions and rows are bounded.
 * @public
 */
export interface TelemetrySummary {
    window_days?: number | undefined;
    verification?: string | undefined;
    automatic_action?: string | undefined;
    adoption_definition?: string | undefined;
    releases?: __DocumentType | undefined;
    release_totals?: __DocumentType | undefined;
    blocked_package_versions?: __DocumentType | undefined;
}
/**
 * @public
 */
export interface TelemetrySummaryInput {
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * Tokens returned after a successful login.
 * @public
 */
export interface UserToken {
    /**
     * Bearer token to send in the Authorization header on authenticated requests.
     * @public
     */
    access_token: string | undefined;
    /**
     * Type of the token (e.g. "Bearer").
     * @public
     */
    token_type: string | undefined;
    /**
     * Lifetime of the access token, in seconds.
     * @public
     */
    expires_in: number | undefined;
    /**
     * Token used to obtain a new access token once the current one expires.
     * @public
     */
    refresh_token: string | undefined;
    /**
     * Lifetime of the refresh token, in seconds.
     * @public
     */
    refresh_expires_in: number | undefined;
}
/**
 * Information about the authenticated user.
 * @public
 */
export interface User {
    /**
     * Unique identifier of the user.
     * @public
     */
    user_id: string | undefined;
    /**
     * Organisations the user belongs to, with the user's access level in each.
     * @public
     */
    organisations: (Organisation)[] | undefined;
    /**
     * Tokens issued for the user, when available.
     * @public
     */
    user_token?: UserToken | undefined;
}
/**
 * @public
 */
export declare class ServiceUnavailableError extends __BaseException {
    readonly name: "ServiceUnavailableError";
    readonly $fault: "server";
    /**
     * Present when an approved action failed and its failed status was saved.
     * @public
     */
    request_id?: string | undefined;
    request_status?: string | undefined;
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ServiceUnavailableError, __BaseException>);
}
/**
 * @public
 */
export interface TelemetryAccepted {
    accepted: boolean | undefined;
    verification: string | undefined;
}
/**
 * @public
 */
export interface TelemetryEvent {
    id: string | undefined;
    kind: string | undefined;
}
/**
 * @public
 */
export interface TelemetryBatch {
    receipt: string | undefined;
    install_id: string | undefined;
    events: (TelemetryEvent)[] | undefined;
}
/**
 * @public
 */
export declare class TooManyRequestsError extends __BaseException {
    readonly name: "TooManyRequestsError";
    readonly $fault: "client";
    code: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TooManyRequestsError, __BaseException>);
}
/**
 * @public
 */
export interface ListControlCenterDeploymentRequestsInput {
    organisation: string | undefined;
    /**
     * Optional: omit x-application to list readable requests across the organisation. Filter is applied before the 1,000 newest-row cap.
     * @public
     */
    application?: string | undefined;
    status?: DeploymentRequestStatus | undefined;
}
/**
 * @public
 */
export interface ListControlCenterDeploymentRequestsResponse {
    requests: (ControlCenterDeploymentRequest)[] | undefined;
}
/**
 * Path and organisation header for listing groups.
 * @public
 */
export interface ListControlCenterGroupsInput {
    organisation: string | undefined;
}
/**
 * @public
 */
export interface ListControlCenterGroupsResponse {
    groups: (ControlCenterGroup)[] | undefined;
}
/**
 * List unresolved write operations for one application. "status" is currently "unresolved".
 * @public
 */
export interface ListControlCenterOperationsInput {
    organisation: string | undefined;
    application: string | undefined;
    status?: string | undefined;
}
/**
 * @public
 */
export interface ControlCenterUnresolvedOperationDetails {
    code: string | undefined;
    operation_id: string | undefined;
    message: string | undefined;
}
/**
 * @public
 */
export interface ListControlCenterOperationsResponse {
    operations: (ControlCenterUnresolvedOperationDetails)[] | undefined;
}
/**
 * Query parameters and headers for listing dimensions.
 * @public
 */
export interface ListDimensionsRequest {
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Page number for pagination.
     * @public
     */
    page?: number | undefined;
    /**
     * Number of dimensions per page.
     * @public
     */
    count?: number | undefined;
}
/**
 * A targeting dimension.
 * @public
 */
export interface DimensionResponse {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Description of the dimension
     * @public
     */
    description: __DocumentType | undefined;
    /**
     * Position of the dimension
     * @public
     */
    position: number | undefined;
    /**
     * Schema of the dimension
     * @public
     */
    schema?: __DocumentType | undefined;
    /**
     * Reason for the change
     * @public
     */
    change_reason: string | undefined;
    /**
     * Whether a value for this dimension is required when targeting.
     * @public
     */
    mandatory?: boolean | undefined;
}
/**
 * Paginated list of dimensions.
 * @public
 */
export interface ListDimensionsResponse {
    /**
     * Total number of pages.
     * @public
     */
    total_pages?: number | undefined;
    /**
     * Total number of dimensions.
     * @public
     */
    total_items?: number | undefined;
    /**
     * Dimensions on this page.
     * @public
     */
    data?: (DimensionResponse)[] | undefined;
}
/**
 * List file groups request
 * @public
 */
export interface ListFileGroupsRequest {
    /**
     * Page number for pagination
     * @public
     */
    page?: number | undefined;
    /**
     * Number of groups per page
     * @public
     */
    count?: number | undefined;
    /**
     * Search query to filter files by path
     * @public
     */
    search?: string | undefined;
    /**
     * Tags to filter files by (comma-separated for multiple values)
     * @public
     */
    tags?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Represents a tag associated with a specific version
 * @public
 */
export interface FileGroupTag {
    /**
     * The tag value
     * @public
     */
    tag: string | undefined;
    /**
     * The version this tag is associated with
     * @public
     */
    version: number | undefined;
}
/**
 * Represents a version within a file group
 * @public
 */
export interface FileGroupVersion {
    /**
     * The version number
     * @public
     */
    version: number | undefined;
    /**
     * URL from where the file can be downloaded
     * @public
     */
    url: string | undefined;
    /**
     * Size of the file in bytes
     * @public
     */
    size: number | undefined;
    /**
     * Date when this version was created
     * @public
     */
    created_at: string | undefined;
}
/**
 * Represents a group of file versions
 * @public
 */
export interface FileGroup {
    /**
     * The file path (unique identifier for the group)
     * @public
     */
    file_path: string | undefined;
    /**
     * Total number of versions for this file
     * @public
     */
    total_versions: number | undefined;
    /**
     * List of all versions
     * @public
     */
    versions: (FileGroupVersion)[] | undefined;
    /**
     * List of tags associated with versions
     * @public
     */
    tags: (FileGroupTag)[] | undefined;
}
/**
 * List file groups response
 * @public
 */
export interface ListFileGroupsResponse {
    /**
     * List of file groups
     * @public
     */
    groups: (FileGroup)[] | undefined;
    /**
     * Total number of groups matching the query
     * @public
     */
    total_items: number | undefined;
    /**
     * Total number of pages
     * @public
     */
    total_pages: number | undefined;
    /**
     * Current page number
     * @public
     */
    page: number | undefined;
    /**
     * Number of groups per page
     * @public
     */
    count: number | undefined;
}
/**
 * List files request
 * @public
 */
export interface ListFilesRequest {
    /**
     * Page number for pagination
     * @public
     */
    page?: number | undefined;
    /**
     * Number of files per page
     * @public
     */
    per_page?: number | undefined;
    /**
     * Search query to filter files
     * @public
     */
    search?: string | undefined;
    /**
     * Tags to filter files by (comma-separated for multiple values, e.g., "prod,dev,staging")
     * @public
     */
    tags?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * List files response
 * @public
 */
export interface ListFilesResponse {
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * List of files
     * @public
     */
    files: (CreateFileResponse)[] | undefined;
    /**
     * Total number of files
     * @public
     */
    total: number | undefined;
    /**
     * Current page number
     * @public
     */
    page: number | undefined;
    /**
     * Number of files per page
     * @public
     */
    per_page: number | undefined;
}
/**
 * List organisations response
 * @public
 */
export interface ListOrganisationsResponse {
    /**
     * List of organisations
     * @public
     */
    organisations: (Organisation)[] | undefined;
}
/**
 * List packages request
 * @public
 */
export interface ListPackagesRequest {
    /**
     * Offset for pagination (default: 1)
     * @public
     */
    page?: number | undefined;
    /**
     * Limit for pagination (default: 50)
     * @public
     */
    count?: number | undefined;
    /**
     * Search term for filtering packages using index file path
     * @public
     */
    search?: string | undefined;
    /**
     * If true, fetch all packages without pagination
     * @public
     */
    all?: boolean | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * List packages response
 * @public
 */
export interface ListPackagesResponse {
    /**
     * List of packages
     * @public
     */
    data: (Package)[] | undefined;
    /**
     * Total number of pages
     * @public
     */
    total_pages: number | undefined;
    /**
     * Total number of items
     * @public
     */
    total_items: number | undefined;
}
/**
 * Query parameters and headers for listing releases.
 * @public
 */
export interface ListReleasesRequest {
    /**
     * dimension to filter releases in format key1=value1;key2=value2
     * @public
     */
    dimension?: string | undefined;
    /**
     * Page number for pagination (default: 1)
     * @public
     */
    page?: number | undefined;
    /**
     * Count of releases per page for pagination (default: 50)
     * @public
     */
    count?: number | undefined;
    /**
     * If true, fetch all releases without pagination
     * @public
     */
    all?: boolean | undefined;
    /**
     * Status to filter releases
     * @public
     */
    status?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Paginated list of releases.
 * @public
 */
export interface ListReleasesResponse {
    /**
     * List of releases
     * @public
     */
    data: (GetReleaseResponse)[] | undefined;
    /**
     * Total number of pages
     * @public
     */
    total_pages: number | undefined;
    /**
     * Total number of items
     * @public
     */
    total_items: number | undefined;
}
/**
 * User credentials for login
 * @public
 */
export interface UserCredentials {
    /**
     * Gmail of the user
     * @public
     */
    client_id: string | undefined;
    /**
     * Password of the user
     * @public
     */
    client_secret: string | undefined;
}
/**
 * @public
 */
export interface PreviewServingPolicyInput {
    organisation: string | undefined;
    application: string | undefined;
    context: Record<string, string> | undefined;
    toss: string | undefined;
}
/**
 * @public
 */
export interface ServingPreviewOutput {
    serving_policy: ServingPolicy | undefined;
    context: Record<string, string> | undefined;
    toss: string | undefined;
    config_version?: string | undefined;
    package_version?: __DocumentType | undefined;
    targeted: boolean | undefined;
    would_stop_serving: boolean | undefined;
    strict_status: number | undefined;
    scope: string | undefined;
}
/**
 * @public
 */
export interface PutServingPolicyInput {
    organisation: string | undefined;
    application: string | undefined;
    strict: boolean | undefined;
}
/**
 * Request to ramp a release's traffic.
 * @public
 */
export interface RampReleaseInput {
    /**
     * ID of the release (the experiment id returned by CreateRelease).
     * @public
     */
    release_id: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Percentage of traffic to route to the release, from 0 to 50. Values outside this range return 400 before any write is attempted. Setting it to 0 pauses the release without discarding it. Lowering it needs no approval, raising it does when approvals are enabled.
     * @public
     */
    traffic_percentage: number | undefined;
    /**
     * Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
     * @public
     */
    change_reason?: string | undefined;
}
/**
 * Result of ramping a release.
 * @public
 */
export interface RampReleaseResponse {
    /**
     * Always true; failures are returned as errors.
     * @public
     */
    success: boolean | undefined;
    /**
     * Human-readable summary.
     * @public
     */
    message: string | undefined;
    /**
     * ID of the ramped release.
     * @public
     */
    experiment_id: string | undefined;
    /**
     * Traffic percentage now routed to the release.
     * @public
     */
    traffic_percentage: number | undefined;
}
/**
 * @public
 */
export interface RejectControlCenterDeploymentRequestInput {
    id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
    reason: string | undefined;
}
/**
 * Request organisation request
 * @public
 */
export interface RequestOrganisationRequest {
    /**
     * Name of the organisation
     * @public
     */
    organisation_name: string | undefined;
    /**
     * Name of the requester
     * @public
     */
    name: string | undefined;
    /**
     * Email of the requester
     * @public
     */
    email: string | undefined;
    /**
     * Phone number of the requester
     * @public
     */
    phone: string | undefined;
    /**
     * App store link
     * @public
     */
    app_store_link: string | undefined;
    /**
     * Play store link
     * @public
     */
    play_store_link: string | undefined;
}
/**
 * Request organisation response
 * @public
 */
export interface RequestOrganisationResponse {
    /**
     * Name of the organisation
     * @public
     */
    organisation_name: string | undefined;
    /**
     * Message indicating the status of the request
     * @public
     */
    message: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const OperationRecoveryFinding: {
    readonly APPLIED: "applied";
    readonly DID_NOT_APPLY: "did_not_apply";
};
/**
 * @public
 */
export type OperationRecoveryFinding = typeof OperationRecoveryFinding[keyof typeof OperationRecoveryFinding];
/**
 * @public
 */
export interface ResolveControlCenterOperationInput {
    id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
    finding: OperationRecoveryFinding | undefined;
    /**
     * Required and non-blank; the operator's reason is recorded in the audit event. It must not contain the reserved text "Airborne operation"; such a reason returns 400.
     * @public
     */
    reason: string | undefined;
    /**
     * Must be true for did_not_apply. The operator confirms the original request cannot execute later.
     * @public
     */
    request_terminated?: boolean | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ResolvedOperationState: {
    readonly CONFIRMED: "confirmed";
    readonly REJECTED: "rejected";
};
/**
 * @public
 */
export type ResolvedOperationState = typeof ResolvedOperationState[keyof typeof ResolvedOperationState];
/**
 * @public
 */
export interface ResolveControlCenterOperationResponse {
    operation_id: string | undefined;
    state: ResolvedOperationState | undefined;
    finding: OperationRecoveryFinding | undefined;
}
/**
 * Returned by rollback when the release is a concluded release that is no longer the latest live release for its dimensions. Nothing is changed.
 * @public
 */
export declare class ReleaseSupersededError extends __BaseException {
    readonly name: "ReleaseSupersededError";
    readonly $fault: "client";
    /**
     * Rollback block code (`superseded`).
     * @public
     */
    code: string | undefined;
    /**
     * Identifier of the release that is currently live for the same dimensions, or JSON null when no live release exists.
     * @public
     */
    current_live_release_id: __DocumentType | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ReleaseSupersededError, __BaseException>);
}
/**
 * Path, scope headers, and reason for a release rollback request.
 * @public
 */
export interface RollbackReleaseInput {
    release_id: string | undefined;
    organisation: string | undefined;
    application: string | undefined;
    /**
     * The reason must not contain the reserved, case-sensitive text "Airborne operation": Airborne appends a generated suffix made of "[Airborne operation ", a canonical UUID and "]" to the reason it sends upstream, and the combined text must fit Superposition's 255-byte limit, so a reason is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
     * @public
     */
    reason: string | undefined;
    /**
     * Use only for the constrained emergency rollback path.
     * @public
     */
    emergency?: boolean | undefined;
    /**
     * Required when the latest live source is marked rollback-sensitive.
     * @public
     */
    confirm_sensitive_risk?: boolean | undefined;
}
/**
 * @public
 * @enum
 */
export declare const RollbackReleaseAction: {
    readonly CONCLUDED_CONTROL: "concluded_control";
    readonly DISCARDED: "discarded";
    readonly RERELEASED: "rereleased";
};
/**
 * @public
 */
export type RollbackReleaseAction = typeof RollbackReleaseAction[keyof typeof RollbackReleaseAction];
/**
 * How the configuration of a re-released rollback was reconciled with the currently registered keys.
 * @public
 */
export interface ReconciledKeys {
    /**
     * Keys registered after the historical release; they keep their current value.
     * @public
     */
    kept_current: (string)[] | undefined;
    /**
     * Keys in the historical release that are no longer registered; they are dropped.
     * @public
     */
    dropped: (string)[] | undefined;
}
/**
 * @public
 */
export interface RollbackReleaseResponse {
    action: RollbackReleaseAction | undefined;
    release_id: string | undefined;
    /**
     * Control package version, historical package version, or JSON null if unavailable.
     * @public
     */
    rolled_back_to_package_version: __DocumentType | undefined;
    /**
     * Replacement release identifier, or JSON null when rollback does not create one.
     * @public
     */
    new_release_id: __DocumentType | undefined;
    /**
     * Config reconciliation result, sorted. Both lists are empty when the rollback discards or concludes on control.
     * @public
     */
    reconciled_keys: ReconciledKeys | undefined;
    /**
     * Current live release in the same dimensions context, or JSON null.
     * @public
     */
    current_live_release_id?: __DocumentType | undefined;
    /**
     * A later unrelated live release, or JSON null. Completed retries still report the recorded rollback as successful.
     * @public
     */
    later_release_id?: __DocumentType | undefined;
}
/**
 * The rollback replacement was changed outside the durable rollback operation. Human inspection is required; do not resume automatically.
 * @public
 */
export declare class RollbackReplacementChangedError extends __BaseException {
    readonly name: "RollbackReplacementChangedError";
    readonly $fault: "client";
    code: string | undefined;
    operation_id: string | undefined;
    replacement_release_id: __DocumentType | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<RollbackReplacementChangedError, __BaseException>);
}
/**
 * Input for get release operations
 * @public
 */
export interface GetServeReleaseInput {
    telemetry_platform?: string | undefined;
    native_version?: string | undefined;
    /**
     * Name of the organisation.
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application.
     * @public
     */
    application: string | undefined;
}
/**
 * Release configuration
 * @public
 */
export interface ReleaseConfig {
    /**
     * List of strings
     * @public
     */
    blocked_package_versions?: (string)[] | undefined;
    telemetry?: __DocumentType | undefined;
    /**
     * Resolved release config.
     * @public
     */
    config: GetReleaseConfig | undefined;
    /**
     * Package to boot from.
     * @public
     */
    package: Package | undefined;
    /**
     * Additional resources for the release, as a JSON document.
     * @public
     */
    resources: __DocumentType | undefined;
}
/**
 * @public
 */
export interface UpdateControlCenterApprovalPolicyInput {
    organisation: string | undefined;
    application: string | undefined;
    enabled?: boolean | undefined;
    /**
     * List of strings
     * @public
     */
    makers?: (string)[] | undefined;
    /**
     * List of strings
     * @public
     */
    checkers?: (string)[] | undefined;
    request_ttl_hours?: number | undefined;
    emergency_rollback?: boolean | undefined;
}
/**
 * Input for replacing a group's name and members.
 * @public
 */
export interface UpdateControlCenterGroupInput {
    id: string | undefined;
    organisation: string | undefined;
    name: string | undefined;
    members: (ControlCenterGroupMember)[] | undefined;
}
/**
 * @public
 */
export interface UpdateDimensionRequest {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Reason for the change
     * @public
     */
    change_reason: string | undefined;
    /**
     * New position of the dimension
     * @public
     */
    position: number | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Update file request
 * @public
 */
export interface UpdateFileRequest {
    /**
     * The file key in the path (e.g., "$file_path@version:$version_number" or "$file_path@tag:$tag")
     * @public
     */
    file_key: string | undefined;
    /**
     * New tag to update the file with
     * @public
     */
    tag: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Upload file request
 * @public
 */
export interface UploadFileRequest {
    /**
     * File path of file to be uploaded
     * @public
     */
    file: StreamingBlobTypes | undefined;
    /**
     * Path where the file will be stored on sdk
     * @public
     */
    file_path: string | undefined;
    /**
     * tag to identify the file
     * @public
     */
    tag?: string | undefined;
    /**
     * SHA-256 digest of the file, encoded in Base64, used by the server to verify the integrity of the uploaded file
     * @public
     */
    checksum: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * @internal
 */
export declare const UploadFileRequestFilterSensitiveLog: (obj: UploadFileRequest) => any;
