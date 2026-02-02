$version: "2.0"

namespace io.airborne.server

/// Configuration properties
structure ConfigProperties {
    /// Tenant information document
    @required
    tenant_info: Document
}

/// Served file with URL and checksum
structure ServeFile {
    /// Path of the file
    file_path: String

    /// URL to download the file
    url: String

    /// Checksum of the file
    checksum: String
}

list ServeFileList {
    member: ServeFile
}

/// Package served with a release
structure ServePackage {
    /// Name identifier of the package
    name: String

    /// Version of the package
    version: String

    /// Index file of the package
    index: ServeFile

    /// Properties of the package
    properties: Document

    /// Important files loaded eagerly
    important: ServeFileList

    /// Lazy files loaded on demand
    lazy: ServeFileList
}

/// Experiment associated with a release
structure ReleaseExperiment {
    /// Unique identifier of the experiment
    experiment_id: String

    /// Package version used in the experiment
    package_version: Integer

    /// Config version used in the experiment
    config_version: String

    /// Creation timestamp of the experiment
    created_at: String

    /// Percentage of traffic routed to this experiment
    traffic_percentage: Integer

    /// Current status of the experiment
    status: String
}

/// Release configuration details
structure GetReleaseConfig {
    /// Version of the config
    @required
    version: String

    /// Timeout for the release config in seconds
    @required
    release_config_timeout: Integer

    /// Boot timeout in seconds
    @required
    boot_timeout: Integer

    /// Configuration properties
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

structure CreateReleaseRequest {
    /// config for the release
    @required
    config: CreateReleaseRequestConfig

    /// Package ID for the release
    package_id: String

    /// Package details for the release
    package: CreateReleaseRequestPackage

    /// Sub-packages from non-primary groups (format: "groupid@version")
    sub_packages: StringList

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

    /// Resources for the release
    @required
    resources: ServeFileList

    /// Sub-packages for the release
    @required
    sub_packages: StringList

    /// Experiment details of the release
    experiment: ReleaseExperiment

    /// Dimensions associated with the release
    @required
    dimensions: DimensionsMap
}

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

/// Package details for get release response (includes group_id)
structure GetReleasePackage {
    /// Name identifier of the package
    name: String

    /// ID of the package group
    group_id: String

    /// Version of the package
    version: String

    /// Index file of the package
    index: ServeFile

    /// Properties of the package
    properties: Document

    /// Important files loaded eagerly
    important: ServeFileList

    /// Lazy files loaded on demand
    lazy: ServeFileList
}

/// Response for getting a single release
structure GetReleaseResponse {
    /// Unique identifier of the release
    id: String

    /// Creation timestamp of the release
    created_at: String

    /// Release configuration details
    config: GetReleaseConfig

    /// Package details of the release
    package: GetReleasePackage

    /// Sub-packages from non-primary groups
    sub_packages: StringList

    /// Resource files associated with the release
    resources: ServeFileList

    /// Experiment associated with the release
    experiment: ReleaseExperiment

    /// Dimensions associated with the release
    dimensions: DimensionsMap
}

list GetReleaseResponseList {
    member: GetReleaseResponse
}

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
    /// Name of the organisation
    @required
    @httpLabel
    organisation: String

    /// Name of the application
    @required
    @httpLabel
    application: String
}

/// Release configuration
structure ReleaseConfig {
    /// Release configuration details
    @required
    config: GetReleaseConfig

    /// Package details
    @required
    package: Package

    /// Resources associated with the release
    @required
    resources: Document
}

/// Create release request operation
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

/// List Releases request operation
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

/// Release request operation
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

/// Get release request operation
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

/// Get release v2 request operation
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
