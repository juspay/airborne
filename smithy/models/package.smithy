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
    /// Offset for pagination (default: 1)
    @httpQuery("page")
    page: Integer

    /// Limit for pagination (default: 50)
    @httpQuery("count")
    count: Integer

    /// Search term for filtering packages using index file path
    @httpQuery("search")
    search: String

    /// If true, fetch all packages without pagination
    @httpQuery("all")
    all: Boolean

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
    data: PackageList

    /// Current page number
    @required
    page: Integer

    /// Count of releases per page
    @required
    count: Integer

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
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
