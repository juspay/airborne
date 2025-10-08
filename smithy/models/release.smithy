$version: "2.0"

namespace io.airborne.server

/// Configuration properties
structure ConfigProperties {
    @required
    tenant_info: Document
}

structure ServeFile {
    file_path: String
    url: String
    checksum: String
}

list ServeFileList {
    member: ServeFile
}

structure ServePackage {
    name: String
    version: String
    index: ServeFile
    properties: Document
    important: ServeFileList
    lazy: ServeFileList
}

structure ReleaseExperiment {
    experiment_id: String
    package_version: Integer
    config_version: String
    created_at: String
    traffic_percentage: Integer
    status: String
}

structure GetReleaseConfig {
    @required
    version: String

    @required
    release_config_timeout: Integer

    @required
    boot_timeout: Integer

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

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

structure GetReleaseResponse {
    id: String
    created_at: String
    config: GetReleaseConfig
    package: ServePackage
    resources: ServeFileList
    experiment: ReleaseExperiment
    dimensions: DimensionsMap
}

list GetReleaseResponseList {
    member: GetReleaseResponse
}

structure ListReleasesResponse {
    /// List of releases
    @required
    releases: GetReleaseResponseList
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
    @required
    @httpLabel
    organisation: String

    @required
    @httpLabel
    application: String
}

/// Release configuration
structure ReleaseConfig {
    @required
    config: GetReleaseConfig

    @required
    package: Package

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
