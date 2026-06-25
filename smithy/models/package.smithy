$version: "2.0"

namespace io.airborne.server

/// Create package request
structure CreatePackageRequest {
    /// Index file id
    @required
    index: String

    /// Optional tag to identify the package.
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
    /// Optional tag identifying the package.
    tag: String

    /// Version number assigned to the package.
    @required
    version: Integer

    /// File id of the package's index (entry) file.
    @required
    index: String

    /// File ids included in the package.
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

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
}

/// Create a package: an index file plus the set of files that make up an OTA bundle. Pass the organisation and application in the x-organisation and x-application headers. Returns the created package with its assigned version. Requires a bearer token.
@tags(["Packages"])
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

/// List packages for an application, with pagination and optional search by index file path. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Packages"])
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
