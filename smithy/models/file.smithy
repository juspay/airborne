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


/// Update the tag of an existing file, identified by its file key in the path (a file path with a version or tag, e.g. "path/to/file@version:3" or "path/to/file@tag:prod"). Pass the organisation and application in the x-organisation and x-application headers. Returns the updated file. Requires a bearer token.
@tags(["Files"])
@http(method: "PATCH", uri: "/api/file/{file_key}")
@requiresauth
operation UpdateFile {
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

/// Register a file by URL, recording its metadata and assigning it a version. Pass the organisation and application in the x-organisation and x-application headers. Use this when the file is already hosted somewhere the server can reach; to upload the bytes directly, use UploadFile instead. Requires a bearer token.
@tags(["Files"])
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

/// List files for an application, with pagination and optional search and tag filters. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Files"])
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

/// Upload a file's bytes directly as the request body and register it in one step. Send the raw file as the payload, with its Base64-encoded SHA-256 digest in the x-checksum header and the organisation and application in the x-organisation and x-application headers. Returns the created file. Requires a bearer token.
@tags(["Files"])
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

/// File tag response
structure FileTagResponse {
    /// The tag value
    @required
    tag: String

    /// Number of files with this tag
    @required
    count: Integer
}

/// List of file tag responses
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

/// List files grouped by path, so that all versions and tags of a file appear together. Supports pagination and optional search and tag filters. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.
@tags(["Files"])
@http(method: "GET", uri: "/api/file/groups")
@requiresauth
@readonly
operation ListFileGroups {
    input: ListFileGroupsRequest
    output: ListFileGroupsResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}
