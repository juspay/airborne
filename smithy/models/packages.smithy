$version: "2"

namespace in.juspay.airborne

use aws.protocols#restJson1
use smithy.api#http
use smithy.api#httpLabel
use smithy.api#httpHeader
use smithy.api#httpQuery
use smithy.api#required

@httpBearerAuth
@restJson1
service PackageService {
    version: "1.0.0",
    operations: [CreatePackage, ReadPackage, ListPackages]
}

/// Represents a package with its metadata and files.
structure Package {
    @required
    index: String,
    @required
    org_id: String,
    @required
    app_id: String,
    @required
    tag: String,
    @required
    version: Integer,
    @required
    files: FileIds
}

/// Input for CreatePackage operation.
structure CreatePackageInput {
    @required
    @httpHeader("x-organisation")
    x_organisation: String,
    @required
    @httpHeader("x-application")
    x_application: String,
    @required
    index: String,
    @required
    tag: String,
    @required
    files: FileIds
}

@http(method: "POST", uri: "/packages", code: 201)
operation CreatePackage {
    input: CreatePackageInput,
    output: Package
}

/// Input for ReadPackage operation.
/// The 'package_key' label should be formatted as "version:$version" or "tag:$tag".
structure ReadPackageInput {
    @required
    @httpHeader("x-organisation")
    x_organisation: String,
    @required
    @httpHeader("x-application")
    x_application: String,
    @required
    @httpQuery("package_key")
    package_key: String
}

@http(method: "GET", uri: "/packages", code: 200)
@readonly
operation ReadPackage {
    input: ReadPackageInput,
    output: Package
}

/// Input for ListPackages operation.
structure ListPackagesInput {
    @required
    @httpHeader("x-organisation")
    x_organisation: String,
    @required
    @httpHeader("x-application")
    x_application: String,
    @httpQuery("offset")
    offset: Integer,
    @httpQuery("limit")
    limit: Integer
}

/// Output for ListPackages operation.
structure ListPackagesOutput {
    @required
    packages: PackageList,
    @required
    page_number: Integer,
    next_offset: Integer,
    prev_offset: Integer,
    @required
    total_pages: Integer
}

list PackageList {
    member: Package
}

@http(method: "GET", uri: "/packages/list", code: 200)
@readonly
operation ListPackages {
    input: ListPackagesInput,
    output: ListPackagesOutput
}
