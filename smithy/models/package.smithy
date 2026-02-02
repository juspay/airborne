$version: "2.0"

namespace io.airborne.server

/// Create package request (legacy - uses primary group)
structure CreatePackageRequest {
    /// Index file id
    @required
    index: String

    /// Optional tag for the package (e.g., latest, v1.0, production)
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

/// Package information (legacy)
structure Package {
    /// Tag of the package
    tag: String

    /// Version number of the package
    @required
    version: Integer

    /// Index file path
    @required
    index: String

    /// List of file ids in the package
    @required
    files: StringList
}

/// List packages request (legacy - uses primary group)
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

// ─── Package Groups ───

/// Package group information
structure PackageGroup {
    /// Unique identifier of the package group
    @required
    id: String

    /// Name of the package group
    @required
    name: String

    /// Whether this is the primary package group
    @required
    is_primary: Boolean
}

/// List of package groups
list PackageGroupList {
    member: PackageGroup
}

/// Create package group request body
structure CreatePackageGroupRequest {
    /// Name of the package group
    @required
    name: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Update package group name request body
structure UpdatePackageGroupRequest {
    /// ID of the package group
    @required
    @httpLabel
    groupId: String

    /// New name for the package group
    @required
    name: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// List package groups request
structure ListPackageGroupsRequest {
    /// Offset for pagination (default: 1)
    @httpQuery("page")
    page: Integer

    /// Limit for pagination (default: 50)
    @httpQuery("count")
    count: Integer

    /// Search term for filtering package groups by name
    @httpQuery("search")
    search: String

    /// If true, fetch all package groups without pagination
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

/// List package groups response
structure ListPackageGroupsResponse {
    /// List of package groups
    @required
    data: PackageGroupList

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
}

/// Get a single package group request
structure GetPackageGroupRequest {
    /// ID of the package group
    @required
    @httpLabel
    groupId: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

// ─── Package V2 (group-scoped) ───

/// Package V2 information (group-scoped)
structure PackageV2 {
    /// Index file path (required for primary groups, absent for non-primary)
    index: String

    /// Tag of the package
    tag: String

    /// Version number of the package
    @required
    version: Integer

    /// List of file ids in the package
    @required
    files: StringList

    /// ID of the package group this package belongs to
    @required
    package_group_id: String
}

/// List of packages v2
list PackageV2List {
    member: PackageV2
}

/// Create package v2 request body
structure CreatePackageV2Request {
    /// ID of the package group
    @required
    @httpLabel
    groupId: String

    /// Index file (required for primary groups, must not be provided for non-primary)
    index: String

    /// Optional tag for the package (e.g., latest, v1.0, production)
    tag: String

    /// File ids to be included in the package
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

/// List packages v2 request (group-scoped)
structure ListPackagesV2Request {
    /// ID of the package group
    @required
    @httpLabel
    groupId: String

    /// Offset for pagination (default: 1)
    @httpQuery("page")
    page: Integer

    /// Limit for pagination (default: 50)
    @httpQuery("count")
    count: Integer

    /// Search term for filtering packages
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

/// List packages v2 response
structure ListPackagesV2Response {
    /// List of packages
    @required
    data: PackageV2List

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
}

/// Get package v2 by version
structure GetPackageV2ByVersionRequest {
    /// ID of the package group
    @required
    @httpLabel
    groupId: String

    /// Version number
    @required
    @httpLabel
    version: Integer

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Get package v2 by tag
structure GetPackageV2ByTagRequest {
    /// ID of the package group
    @required
    @httpLabel
    groupId: String

    /// Tag name
    @required
    @httpLabel
    tag: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

// ─── Operations ───

/// Create package request operation (legacy - uses primary group)
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

/// List packages request operation (legacy - uses primary group)
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

/// Create a new package group
@http(method: "POST", uri: "/api/package-groups")
@requiresauth
operation CreatePackageGroup {
    input: CreatePackageGroupRequest
    output: PackageGroup
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// List all package groups
@http(method: "GET", uri: "/api/package-groups")
@requiresauth
@readonly
operation ListPackageGroups {
    input: ListPackageGroupsRequest
    output: ListPackageGroupsResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Get a single package group by ID
@http(method: "GET", uri: "/api/package-groups/{groupId}")
@requiresauth
@readonly
operation GetPackageGroup {
    input: GetPackageGroupRequest
    output: PackageGroup
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// Update a package group name
@http(method: "PATCH", uri: "/api/package-groups/{groupId}")
@requiresauth
operation UpdatePackageGroupName {
    input: UpdatePackageGroupRequest
    output: PackageGroup
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// List packages within a package group
@http(method: "GET", uri: "/api/package-groups/{groupId}/packages")
@requiresauth
@readonly
operation ListPackagesV2 {
    input: ListPackagesV2Request
    output: ListPackagesV2Response
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Create a package within a package group
@http(method: "POST", uri: "/api/package-groups/{groupId}/packages")
@requiresauth
operation CreatePackageV2 {
    input: CreatePackageV2Request
    output: PackageV2
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Get a package by version within a package group
@http(method: "GET", uri: "/api/package-groups/{groupId}/packages/version/{version}")
@requiresauth
@readonly
operation GetPackageV2ByVersion {
    input: GetPackageV2ByVersionRequest
    output: PackageV2
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// Get a package by tag within a package group
@http(method: "GET", uri: "/api/package-groups/{groupId}/packages/tag/{tag}")
@requiresauth
@readonly
operation GetPackageV2ByTag {
    input: GetPackageV2ByTagRequest
    output: PackageV2
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}
