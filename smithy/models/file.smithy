$version: "2.0"

namespace io.airborne.server

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

    /// Number of versions per page
    @httpQuery("count")
    count: Integer

    /// Fetch all files without pagination
    @httpQuery("all")
    all: Boolean

    /// Search query to filter file versions
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

/// Represents a file entry
structure FileResponseListItem {
    /// Path where the file is stored on sdk
    @required
    file_path: String

    /// id of the latest file
    @required
    id: String

    /// version of the latest file
    @required
    version: Integer

    /// total versions of the file
    @required
    total_versions: Integer
}

/// List of file responses
list FileResponseList {
    /// A file response
    member: FileResponseListItem
}

/// List files response
structure ListFilesResponse {
    /// List of files
    @required
    data: FileResponseList

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
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

    // Name of the organisation
    @httpHeader("x-organisation")
    @required
    organisation: String

    /// Name of the application
    @httpHeader("x-application")
    @required
    application: String
}

/// List versions request
structure ListVersionsRequest {
    @httpLabel
    @required
    filepath: String

    /// Page number for pagination
    @httpQuery("page")
    page: Integer

    /// Number of versions per page
    @httpQuery("count")
    count: Integer

    /// Fetch all file versions without pagination
    @httpQuery("all")
    all: Boolean

    /// Search query to filter file versions
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

structure FileVersionItem {
    /// Version number of the file
    @required
    version: Integer

    /// tag of the version
    tag: String

    /// Date of creation
    @required
    created_at: String

    /// Id of the file
    @required
    id: String
}

list FileVersionItemList {
    member: FileVersionItem
}

/// List of version responses
structure ListVersionResponse {
    /// List of versions
    @required
    data: FileVersionItemList

    /// Total number of pages
    @required
    total_pages: Integer

    /// Total number of items
    @required
    total_items: Integer
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

/// List versions request operation
@http(method: "GET", uri: "/api/file/{filepath}/versions")
@requiresauth
@readonly
operation ListVersions {
    input: ListVersionsRequest
    output: ListVersionResponse
    errors: [
        Unauthorized
        BadRequestError
    ]
}
