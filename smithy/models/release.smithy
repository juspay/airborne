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

/// Details of the experiment backing a release, used to ramp it out gradually.
structure ReleaseExperiment {
    /// Identifier of the experiment.
    experiment_id: String

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

    /// Time allowed for fetching the release config, in seconds.
    @required
    release_config_timeout: Integer

    /// Time allowed for the app to boot, in seconds.
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

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// A created release.
structure CreateReleaseResponse {
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

/// Create a new release. A release points a package (and any resources) at a set of targeting dimensions; ramp it later to roll it out. Pass the organisation and application in the x-organisation and x-application headers. Returns the created release with its resolved config and package. Requires a bearer token.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases")
@requiresauth
operation CreateRelease {
    input: CreateReleaseRequest
    output: CreateReleaseResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// List releases for an application, with pagination and optional filtering by status or targeting dimension. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Releases"])
@http(method: "GET", uri: "/api/releases/list")
@requiresauth
@readonly
operation ListReleases {
    input: ListReleasesRequest
    output: ListReleasesResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Get a single release by its id, including its config, package, resources, targeting dimensions, and experiment details. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Releases"])
@http(method: "GET", uri: "/api/releases/{releaseId}")
@requiresauth
@readonly
operation GetRelease {
    input: GetReleaseRequest
    output: GetReleaseResponse
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// Resolve and return the active release configuration for an application, given the caller's targeting dimensions. This is the endpoint the SDK calls at boot. Public — no auth token required.
@tags(["Release serving"])
@http(method: "GET", uri: "/release/{organisation}/{application}")
@readonly
@requiresauth
operation ServeRelease {
    input: GetServeReleaseInput
    output: ReleaseConfig
    errors: [
        NotFoundError
        InternalServerError
    ]
}

/// Version 2 of the release-resolution endpoint: resolves and returns the active release configuration for an application based on the caller's targeting dimensions. This is the endpoint newer SDKs call at boot. Public — no auth token required.
@tags(["Release serving"])
@http(method: "GET", uri: "/release/v2/{organisation}/{application}")
@readonly
@requiresauth
operation ServeReleaseV2 {
    input: GetServeReleaseInput
    output: ReleaseConfig
    errors: [
        NotFoundError
        InternalServerError
    ]
}
