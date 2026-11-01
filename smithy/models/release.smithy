$version: "2.0"

namespace io.airborne.server

/// Configuration properties
structure ConfigProperties {
    /// Tenant-specific configuration, as a JSON document.
    @required
    tenant_info: Document
}

/// A file as served to the SDK, with the location and checksum needed to download and verify it.
structure ServeFile {
    /// Path where the file is stored on the SDK.
    file_path: String

    /// URL the SDK downloads the file from.
    url: String

    /// Checksum used to verify the downloaded file.
    checksum: String
    /// Size of the file in bytes
    size: Long
}

/// List of files served to the SDK.
list ServeFileList {
    member: ServeFile
}

/// A package as served to the SDK: the index file plus the files that make up the OTA bundle.
structure ServePackage {
    /// Name of the package.
    name: String

    /// Version of the package.
    version: String

    /// The package's index (entry) file.
    index: ServeFile

    /// Package properties, as a JSON document.
    properties: Document

    /// Files that must be downloaded before boot.
    important: ServeFileList

    /// Files that can be downloaded lazily after boot.
    lazy: ServeFileList
}

/// Variant ids of the experiment backing a release. Pass one of these as chosen_variant when concluding.
structure ExperimentVariants {
    /// Id of the control variant, which keeps the previous release live. The experiment service prefixes it with the release id, for example "7522252134449025024-control".
    control: String

    /// Ids of the experimental variants, which promote this release, for example "7522252134449025024-experimental_1". A release created by Airborne has exactly one.
    experimentals: StringList
}

/// Details of the experiment backing a release, used to ramp it out gradually.
structure ReleaseExperiment {
    /// Identifier of the experiment.
    experiment_id: String

    /// Variant ids that can be chosen when concluding the release.
    experiment_variants: ExperimentVariants

    /// Package version served by the experiment.
    package_version: Integer

    /// Config version served by the experiment.
    config_version: String

    /// Time the experiment was created.
    created_at: String

    /// Percentage of traffic currently routed to this release.
    traffic_percentage: Integer

    /// Current status of the experiment.
    status: String
}

/// Resolved release configuration returned to callers.
structure GetReleaseConfig {
    /// Version identifier of the config.
    @required
    version: String

    /// Time allowed for fetching the release config, in milliseconds.
    @required
    release_config_timeout: Integer

    /// Time allowed for the app to boot, in milliseconds.
    @required
    boot_timeout: Integer

    /// Config properties.
    @required
    properties: ConfigProperties
}

/// Create release request config
structure CreateReleaseRequestConfig {
    /// Timeout for the release config in seconds
    @required
    release_config_timeout: Integer

    /// Timeout for the package in seconds
    @required
    boot_timeout: Integer

    /// Properties of the config in Stringified JSON format
    @required
    properties: Document
}

/// Create release request package
structure CreateReleaseRequestPackage {
    /// Properties of the package in Stringified JSON format or a file attachment
    properties: Document

    /// Important files in the package
    important: StringList

    /// Lazy files in the package
    lazy: StringList
}

/// Request body for creating a release.
structure CreateReleaseRequest {
    /// config for the release
    @required
    config: CreateReleaseRequestConfig

    /// Package ID for the release
    package_id: String

    /// Package details for the release
    package: CreateReleaseRequestPackage

    /// Dimensions for the release in key-value format
    dimensions: DimensionsMap

    /// Resources for the release
    resources: StringList

    /// Optional declared reason this release needs additional rollback protection.
    rollback_sensitive: RollbackSensitiveReason

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Advisory release warnings.
list ReleaseWarnings {
    member: String
}

/// A created release.
structure CreateReleaseResponse {
    /// Advisory targeting warnings emitted by create, update and list.
    warnings: ReleaseWarnings
    /// ID of the release
    @required
    id: String

    /// Creation time of the release
    @required
    created_at: String

    /// Status of the release
    @required
    config: GetReleaseConfig

    /// Package details of the release
    @required
    package: ServePackage

    /// Experiment details of the release
    experiment: ReleaseExperiment

    /// Dimensions associated with the release
    @required
    dimensions: DimensionsMap
}

/// Query parameters and headers for listing releases.
structure ListReleasesRequest {
    /// dimension to filter releases in format key1=value1;key2=value2
    @httpHeader("x-dimension")
    dimension: String

    /// Page number for pagination (default: 1)
    @httpQuery("page")
    page: Integer

    /// Count of releases per page for pagination (default: 50)
    @httpQuery("count")
    count: Integer

    /// If true, fetch all releases without pagination
    @httpQuery("all")
    all: Boolean

    /// Status to filter releases
    @httpQuery("status")
    status: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// A release with its full details.
structure GetReleaseResponse {
    /// Advisory targeting warnings.
    warnings: ReleaseWarnings

    /// ID of the release.
    id: String

    /// Time the release was created.
    created_at: String

    /// Resolved config of the release.
    config: GetReleaseConfig

    /// Package served by the release.
    package: ServePackage

    /// Additional resources served with the release.
    resources: ServeFileList

    /// Experiment backing the release, when it is being ramped.
    experiment: ReleaseExperiment

    /// Targeting dimensions the release applies to.
    dimensions: DimensionsMap
}

/// List of releases.
list GetReleaseResponseList {
    member: GetReleaseResponse
}

/// Paginated list of releases.
structure ListReleasesResponse {
    /// List of releases
    @required
    data: GetReleaseResponseList

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
}

/// Path and headers for fetching a single release.
structure GetReleaseRequest {
    /// ID of the release
    @required
    @httpLabel
    releaseId: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Input for get release operations
structure GetServeReleaseInput {
    @httpQuery("telemetry_platform")
    telemetry_platform: String
    @httpQuery("native_version")
    native_version: String
    /// Name of the organisation.
    @required
    @httpLabel
    organisation: String

    /// Name of the application.
    @required
    @httpLabel
    application: String
}

/// Release configuration
structure ReleaseConfig {
    blocked_package_versions: StringList
    telemetry: Document
    /// Resolved release config.
    @required
    config: GetReleaseConfig

    /// Package to boot from.
    @required
    package: Package

    /// Additional resources for the release, as a JSON document.
    @required
    resources: Document
}

/// Create a new release. A release points a package (and any resources) at a set of targeting dimensions; ramp it later to roll it out. Pass the organisation and application in the x-organisation and x-application headers. Returns the created release with its resolved config and package. Returns 409 if another release is already ongoing for the same dimensions. Requires a bearer token.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases")
@requiresauth
operation CreateRelease {
    input: CreateReleaseRequest
    output: CreateReleaseResponse
    errors: [Unauthorized BadRequestError ConflictError UnresolvedOperationError NotFoundError InternalServerError ForbiddenError ApprovalRequiredError]
}

/// List releases for an application, with pagination and optional filtering by status or targeting dimension. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Releases"])
@http(method: "GET", uri: "/api/releases/list")
@requiresauth
@readonly
operation ListReleases {
    input: ListReleasesRequest
    output: ListReleasesResponse
    errors: [Unauthorized BadRequestError NotFoundError InternalServerError ForbiddenError]
}

/// Get a single release by its id, including its config, package, resources, targeting dimensions, and experiment details. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Releases"])
@http(method: "GET", uri: "/api/releases/{releaseId}")
@requiresauth
@readonly
operation GetRelease {
    input: GetReleaseRequest
    output: GetReleaseResponse
    errors: [Unauthorized BadRequestError NotFoundError InternalServerError ForbiddenError]
}

/// Resolve and return the active release configuration for an application, given the caller's targeting dimensions. This is the endpoint the SDK calls at boot. Public — no auth token required.
@tags(["Release serving"])
@http(method: "GET", uri: "/release/{organisation}/{application}")
@readonly
@requiresauth
operation ServeRelease {
    input: GetServeReleaseInput
    output: ReleaseConfig
    errors: [NotFoundError InternalServerError Unauthorized BadRequestError ForbiddenError]
}

/// Version 2 of the release-resolution endpoint: resolves and returns the active release configuration for an application based on the caller's targeting dimensions. This is the endpoint newer SDKs call at boot. Public — no auth token required.
@tags(["Release serving"])
@http(method: "GET", uri: "/release/v2/{organisation}/{application}")
@readonly
@requiresauth
operation ServeReleaseV2 {
    input: GetServeReleaseInput
    output: ReleaseConfig
    errors: [NotFoundError InternalServerError Unauthorized BadRequestError ForbiddenError]
}

/// Request to ramp a release's traffic.
structure RampReleaseInput {
    /// ID of the release (the experiment id returned by CreateRelease).
    @required
    @httpLabel
    release_id: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String

    /// Percentage of traffic to route to the release, from 0 to 50. Values outside this range return 400 before any write is attempted. Setting it to 0 pauses the release without discarding it. Lowering it needs no approval, raising it does when approvals are enabled.
    @required
    @range(min: 0, max: 50)
    traffic_percentage: Integer

    /// Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    change_reason: String
}

/// Result of ramping a release.
structure RampReleaseResponse {
    /// Always true; failures are returned as errors.
    @required
    success: Boolean

    /// Human-readable summary.
    @required
    message: String

    /// ID of the ramped release.
    @required
    experiment_id: String

    /// Traffic percentage now routed to the release.
    @required
    traffic_percentage: Integer
}

/// Request to conclude a release.
structure ConcludeReleaseInput {
    /// ID of the release (the experiment id returned by CreateRelease).
    @required
    @httpLabel
    release_id: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String

    /// Variant to make permanent: the control variant keeps the previous release live, an experimental variant promotes this release. Take the id from experiment.experiment_variants on GetRelease; the experiment service generates the ids, so they cannot be guessed. An unknown variant returns 400 and names the available ones.
    @required
    chosen_variant: String

    /// Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    change_reason: String
}

/// Result of concluding a release.
structure ConcludeReleaseResponse {
    /// Always true; failures are returned as errors.
    @required
    success: Boolean

    /// Human-readable summary.
    @required
    message: String

    /// ID of the concluded release.
    @required
    experiment_id: String

    /// Variant that was made permanent.
    @required
    chosen_variant: String
}

/// Request to discard a release.
structure DiscardReleaseInput {
    /// ID of the release (the experiment id returned by CreateRelease).
    @required
    @httpLabel
    release_id: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String

    /// Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    change_reason: String
}

/// Result of discarding a release.
structure DiscardReleaseResponse {
    /// Always true; failures are returned as errors.
    @required
    success: Boolean

    /// Human-readable summary.
    @required
    message: String

    /// ID of the discarded release.
    @required
    experiment_id: String
}

/// Set the share of traffic that receives a release. A release starts at 0% and is not served until it is ramped; the first ramp moves it from created to in progress, and later ramps raise or lower the share. Pass the organisation and application in the x-organisation and x-application headers. Unknown release ids return 404. Values outside 0–50 return 400 before any write is attempted. Explicit upstream 400 and 422 validation rejections for ramps are recorded as not applied and do not pause writes for the application; other uncertain outcomes return 409 with code "unresolved" and own_attempt true, so inspect the real state before retrying and never repeat a committed ramp merely to clear a cache failure. Returns 409 when the release has already concluded or been discarded, and 409 with code "unresolved" when an earlier upstream write for the application still needs recovery; an organisation admin can resolve that operation with ResolveControlCenterOperation. When the application requires approvals, raising traffic (or any ramp of a rollback-sensitive release) is refused with 403 "approval_required"; raise a deployment request instead. Requires a bearer token and release ramp permission.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases/{release_id}/ramp")
@requiresauth
operation RampRelease {
    input: RampReleaseInput
    output: RampReleaseResponse
    errors: [Unauthorized ForbiddenError ApprovalRequiredError BadRequestError ConflictError NotFoundError UnresolvedOperationError InternalServerError]
}

/// Make one variant of a ramped release permanent. Concluding on an experimental variant promotes the release; concluding on the control variant ends it and leaves the previous release live. Read the variant ids from experiment.experiment_variants on GetRelease. The release must have been ramped first. Unknown release ids return 404. Pass the organisation and application in the x-organisation and x-application headers. Returns 409 when the release is still only created (ramp it first) or has already concluded or been discarded, 409 with "code: unresolved" when an upstream outcome is unknown, and 400 when the chosen variant does not exist. When the application requires approvals, every conclude is refused with 403 "approval_required"; raise a deployment request instead. Requires a bearer token and release conclude permission.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases/{release_id}/conclude")
@requiresauth
operation ConcludeRelease {
    input: ConcludeReleaseInput
    output: ConcludeReleaseResponse
    errors: [Unauthorized ForbiddenError ApprovalRequiredError BadRequestError ConflictError NotFoundError UnresolvedOperationError InternalServerError]
}

/// Discard a release that has not been ramped, so it never serves traffic. Only a release in the created state can be discarded; a ramped release must be concluded on "control" or rolled back instead, and a release that is already concluded or discarded returns 409. Unknown release ids return 404. Discarding never needs approval. Pass the organisation and application in the x-organisation and x-application headers. Returns 409 with "code: unresolved" when an upstream outcome is unknown. Requires a bearer token and release discard permission.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases/{release_id}/discard")
@requiresauth
operation DiscardRelease {
    input: DiscardReleaseInput
    output: DiscardReleaseResponse
    errors: [Unauthorized ForbiddenError BadRequestError ConflictError NotFoundError UnresolvedOperationError InternalServerError]
}
