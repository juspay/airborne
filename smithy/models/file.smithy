$version: "2.0"

namespace io.airborne.server

/// Update file request
structure UpdateFileRequest {
    /// The file key in the path (e.g., "$file_path@version:$version_number" or "$file_path@tag:$tag")
    @required
    @httpLabel
    file_key: String

    /// New tag to update the file with
    @required
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


/// Update file operation
@http(method: "PATCH", uri: "/api/file/{file_key}")
@requiresauth
operation UpdateFile {
    /// The file key in the path (e.g., "$file_path@version:$version_number" or "$file_path@tag:$tag")
    input: UpdateFileRequest,
    output: CreateFileResponse,
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Create file request
structure CreateFileRequest {
    /// Path where the file will be stored on sdk
    @required
    file_path: String

    /// URL from where the file can be downloaded
    @required
    url: String

    /// Tag to identify the file
    tag: String

    /// Metadata associated with the file in Stringified JSON format or a file attachment
    metadata: Document

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Create file response
structure CreateFileResponse {
    /// id of the file
    @required
    id: String

    /// Path where the file is stored on sdk
    @required
    file_path: String

    /// URL from where the file can be downloaded
    @required
    url: String

    /// Version of the file
    @required
    version: Integer

    /// Tag associated with the file
    tag: String

    /// Size of the file in bytes
    @required
    size: Integer

    /// Checksum of the file
    @required
    checksum: String

    /// Metadata associated with the file
    @required
    metadata: Document

    /// Status of the file
    @required
    status: String

    /// Date of creation of the file
    @required
    created_at: String
}

/// List files request
structure ListFilesRequest {
    /// Page number for pagination
    @httpQuery("page")
    page: Integer

    /// Number of files per page
    @httpQuery("per_page")
    per_page: Integer

    /// Search query to filter files
    @httpQuery("search")
    search: String

    /// Tags to filter files by (comma-separated for multiple values, e.g., "prod,dev,staging")
    @httpQuery("tags")
    tags: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// List of file responses
list FileResponseList {
    /// A file response
    member: CreateFileResponse
}

/// List files response
structure ListFilesResponse {
    /// Name of the organisation
    @required
    organisation: String

    /// Name of the application
    @required
    application: String

    /// List of files
    @required
    files: FileResponseList

    /// Total number of files
    @required
    total: Integer

    /// Current page number
    @required
    page: Integer

    /// Number of files per page
    @required
    per_page: Integer
}

/// Represents a streaming binary blob
@streaming
blob StreamingBlob

/// Upload file request
structure UploadFileRequest {
    /// File path of file to be uploaded
    @httpPayload
    @required
    file: StreamingBlob

    /// Path where the file will be stored on sdk
    @httpQuery("file_path")
    @required
    file_path: String

    /// tag to identify the file
    @httpQuery("tag")
    tag: String

    /// SHA-256 digest of the file, encoded in Base64, used by the server to verify the integrity of the uploaded file
    @httpHeader("x-checksum")
    @required
    checksum: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Create file request operation
@http(method: "POST", uri: "/api/file")
@requiresauth
operation CreateFile {
    input: CreateFileRequest
    output: CreateFileResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// List files request operation
@http(method: "GET", uri: "/api/file/list")
@requiresauth
@readonly
operation ListFiles {
    input: ListFilesRequest
    output: ListFilesResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Upload file request operation
@http(method: "POST", uri: "/api/file/upload")
@requiresauth
operation UploadFile {
    input: UploadFileRequest
    output: CreateFileResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// List file tags request
structure ListFileTagsRequest {
    /// Page number for pagination
    @httpQuery("page")
    page: Integer

    /// Number of tags per page
    @httpQuery("per_page")
    per_page: Integer

    /// Search query to filter tags
    @httpQuery("search")
    search: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// Delete file request
structure DeleteFileRequest {
    /// File key in the format "$file_path@version:$version_number" or "$file_path@tag:$tag"
    @httpQuery("file_id")
    @required
    file_id: String

    /// Whether to delete all versions of the file
    @httpQuery("delete_all_versions")
    delete_all_versions: Boolean

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// File tag response
structure FileTagResponse {
    /// The tag value
    @required
    tag: String

    /// Number of files with this tag
    @required
    count: Integer
}

list FileTagResponseList {
    /// A file tag response
    member: FileTagResponse
}

/// List file tags response
structure ListFileTagsResponse {
    /// List of tags
    @required
    tags: FileTagResponseList

    /// Total number of unique tags
    @required
    total: Integer

    /// Current page number
    @required
    page: Integer

    /// Number of tags per page
    @required
    per_page: Integer
}

/// List file tags operation
@http(method: "GET", uri: "/api/file/tags")
@requiresauth
@readonly
operation ListFileTags {
    input: ListFileTagsRequest
    output: ListFileTagsResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}

/// Represents a version within a file group
structure FileGroupVersion {
    /// The version number
    @required
    version: Integer

    /// URL from where the file can be downloaded
    @required
    url: String

    /// Size of the file in bytes
    @required
    size: Integer

    /// Date when this version was created
    @required
    created_at: String
}

/// List of deleted versions
list DeletedVersionsList {
    /// A deleted version number
    member: Integer
}

/// Delete file response
structure DeleteFileResponse {
    /// id of the file
    @required
    id: String

    /// Path where the file is stored on sdk
    @required
    file_path: String

    /// URL from where the file can be downloaded
    @required
    url: String

    /// List of deleted versions
    @required
    versions: DeletedVersionsList

    /// Tag associated with the file
    tag: String

    /// Size of the file in bytes
    @required
    size: Integer

    /// Checksum of the file
    @required
    checksum: String

    /// Metadata associated with the file
    @required
    metadata: Document

    /// Status of the file
    @required
    status: String

    /// Date of creation of the file
    @required
    created_at: String
}

/// List of file group versions
list FileGroupVersionList {
    /// A file group version
    member: FileGroupVersion
}

/// Represents a tag associated with a specific version
structure FileGroupTag {
    /// The tag value
    @required
    tag: String

    /// The version this tag is associated with
    @required
    version: Integer
}

/// List of file group tags
list FileGroupTagList {
    /// A file group tag
    member: FileGroupTag
}

/// Represents a group of file versions
structure FileGroup {
    /// The file path (unique identifier for the group)
    @required
    file_path: String

    /// Total number of versions for this file
    @required
    total_versions: Integer

    /// List of all versions
    @required
    versions: FileGroupVersionList

    /// List of tags associated with versions
    @required
    tags: FileGroupTagList
}

/// List of file groups
list FileGroupList {
    /// A file group
    member: FileGroup
}

/// List file groups request
structure ListFileGroupsRequest {
    /// Page number for pagination
    @httpQuery("page")
    page: Integer

    /// Number of groups per page
    @httpQuery("count")
    count: Integer

    /// Search query to filter files by path
    @httpQuery("search")
    search: String

    /// Tags to filter files by (comma-separated for multiple values)
    @httpQuery("tags")
    tags: String

    /// Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// List file groups response
structure ListFileGroupsResponse {
    /// List of file groups
    @required
    groups: FileGroupList

    /// Total number of groups matching the query
    @required
    total_items: Integer

    /// Total number of pages
    @required
    total_pages: Integer

    /// Current page number
    @required
    page: Integer

    /// Number of groups per page
    @required
    count: Integer
}

/// List file groups operation
@http(method: "GET", uri: "/api/file/groups")
@requiresauth
@readonly
operation ListFileGroups {
    input: ListFileGroupsRequest
    output: ListFileGroupsResponse
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}

/// Delete file request operation
@http(method: "DELETE", uri: "/api/file")
@requiresauth
@idempotent
operation DeleteFile {
    input: DeleteFileRequest
    output: DeleteFileResponse
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
    ]
}
