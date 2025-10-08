$version: "2.0"

namespace io.airborne.server

/// Create package request
structure CreatePackageRequest {
    /// Index file id
    @required
    index: String

    tag: String

    /// Space Separated file ids to be included in the package
    @required
    files: StringList

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Package information
structure Package {
    tag: String

    @required
    version: Integer

    @required
    index: String

    @required
    files: StringList
}

/// List packages request
structure ListPackagesRequest {
    /// Offset for pagination
    @httpQuery("offset")
    offset: Integer

    /// Limit for pagination
    @httpQuery("limit")
    limit: Integer

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// List of packages
list PackageList {
    member: Package
}

/// List packages response
structure ListPackagesResponse {
    /// List of packages
    @required
    packages: PackageList

    /// Number of page
    @required
    page_number: Integer

    /// Next offset for pagination
    next_offset: Integer

    /// Previous offset for pagination
    prev_offset: Integer

    /// Total number of pages
    @required
    total_pages: Integer
}

/// Create package request operation
@http(method: "POST", uri: "/api/packages")
@requiresauth
operation CreatePackage {
    input: CreatePackageRequest
    output: Package
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// List packages request operation
@http(method: "GET", uri: "/api/packages/list")
@requiresauth
@readonly
operation ListPackages {
    input: ListPackagesRequest
    output: ListPackagesResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}
