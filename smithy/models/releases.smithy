$version: "2"

namespace in.juspay.airborne

use aws.protocols#restJson1
use smithy.api#http
use smithy.api#httpLabel
use smithy.api#httpHeader
use smithy.api#httpQuery
use smithy.api#required
use smithy.api#Document

/// A list of full File objects.
list Files {
    member: File
}

/// Configuration settings for release workflows.
structure Config {
    @required
    boot_timeout: Integer,
    @required
    package_timeout: Integer
}

/// Package details within a release, including JSON properties.
structure PackageRelease {
    @required
    properties: Document,
    @required
    important: Files,
    @required
    lazy: Files
}

/// A key/value dimension pair.
structure Dimension {
    @required
    dim: String,
    @required
    val: String
}

/// A list of Dimension objects.
list Dimensions {
    member: Dimension
}

@restJson1
service PublicReleaseService {
    version: "1.0.0",
    operations: [ReadReleaseConfig]
}

@httpBearerAuth
@restJson1
service AuthenticatedReleaseService {
    version: "1.0.0",
    operations: [CreateRelease]
}

/// Public endpoint: Read current release configuration by organisation and application.
structure ReadReleaseConfigInput {
    @required
    @httpLabel
    organisation: String,
    @required
    @httpLabel
    application: String,
    @required
    @httpHeader("x-dimensions")
    x_dimensions: String
}

structure ReadReleaseConfigOutput {
    @required
    version: String,
    @required
    config: Config,
    @required
    package: PackageRelease,
    @required
    resources: Files
}

@readonly
@http(method: "GET", uri: "/release/{organisation}/{application}", code: 200)
operation ReadReleaseConfig {
    input: ReadReleaseConfigInput,
    output: ReadReleaseConfigOutput
}

/// Authenticated endpoint: Create a new release.
structure CreatePackageInfo {
    @required
    package_id: String,
    @required
    important: FileIds,
    @required
    properties: Document
}

structure CreateReleaseInput {
    @required
    @httpHeader("x-organisation")
    x_organisation: String,
    @required
    @httpHeader("x-application")
    x_application: String,
    @required
    tag: String,
    @required
    config: Config,
    @required
    package: CreatePackageInfo,
    @required
    resources: FileIds,
    @required
    dimensions: Dimensions
}

structure CreateReleaseOutput {
    @required
    release_id: String,
    @required
    dimensions: Dimensions,
    @required
    config: Config,
    @required
    package: PackageRelease,
    @required
    resources: Files
}

@http(method: "POST", uri: "/releases", code: 201)
operation CreateRelease {
    input: CreateReleaseInput,
    output: CreateReleaseOutput
}
