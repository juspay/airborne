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

    /// Number of files per page
    @httpQuery("per_page")
    per_page: Integer

    /// Search query to filter files
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

    // Name of the organisation
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
