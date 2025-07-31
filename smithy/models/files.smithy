$version: "2.0"

namespace hyper.ota.files

use aws.protocols#restJson1

@title("Hyper OTA Files API")
@httpBearerAuth
@restJson1
service FilesService {
    version: "2025-08-08",
    operations: [
        CreateFile,
        BulkCreateFiles,
        GetFile,
        ListFiles,
        UpdateFile
    ]
}

enum FileStatus {
    PENDING = "pending"
    READY   = "ready"
}

structure FileRequest {
    @required
    file_path: String,
    @required
    url: String,
    @required
    tag: String,
    metadata: Document
}

list FileRequestList {
    member: FileRequest
}

structure BulkFileRequest {
    @required
    files: FileRequestList,
    @required
    skip_duplicates: Boolean
}

structure UpdateFileRequest {
    @required
    tag: String
}

structure FileResponse {
    @required
    id: String,
    @required
    file_path: String,
    @required
    url: String,
    @required
    version: Integer,
    @required
    tag: String,
    @required
    size: Long,
    @required
    checksum: String,
    @required
    metadata: Document,
    @required
    status: FileStatus,
    @required
    @timestampFormat("date-time")
    created_at: Timestamp
}

list FileResponseList {
    member: FileResponse
}

structure FileListResponse {
    @required
    files: FileResponseList,
    @required
    total: Integer,
    page: Integer,
    per_page: Integer
}

structure BulkFileResponse {
    @required
    created_files: FileResponseList,
    @required
    skipped_files: StringList,
    @required
    total_created: Integer,
    @required
    total_skipped: Integer
}

list StringList {
    member: String
}

@http(method: "POST", uri: "/files/create", code: 200)
operation CreateFile {
    input: CreateFileInput,
    output: CreateFileOutput,
    errors: [BadRequestError, UnauthorizedError, ConflictError, InternalServerError]
}

structure CreateFileInput {
    @required
    @httpPayload
    payload: FileRequest
}

structure CreateFileOutput {
    @required
    @httpPayload
    result: FileResponse
}

@http(method: "POST", uri: "/files/bulk", code: 202)
operation BulkCreateFiles {
    input: BulkCreateFilesInput,
    output: BulkCreateFilesOutput,
    errors: [BadRequestError, UnauthorizedError, ConflictError, InternalServerError]
}

structure BulkCreateFilesInput {
    @required
    @httpPayload
    payload: BulkFileRequest
}

structure BulkCreateFilesOutput {
    @required
    @httpPayload
    result: BulkFileResponse
}

@readonly
@http(method: "GET", uri: "/files", code: 200)
operation GetFile {
    input: GetFileInput,
    output: GetFileOutput,
    errors: [BadRequestError, UnauthorizedError, NotFoundError, InternalServerError]
}

structure GetFileInput {
    @required
    @httpQuery("file_key")
    file_key: String
}

structure GetFileOutput {
    @required
    @httpPayload
    result: FileResponse
}

@readonly
@http(method: "GET", uri: "/files/list", code: 200)
operation ListFiles {
    input: ListFilesInput,
    output: ListFilesOutput,
    errors: [BadRequestError, UnauthorizedError, InternalServerError]
}

structure ListFilesInput {
    @httpQuery("page")
    page: Integer,
    @httpQuery("per_page")
    per_page: Integer,
    @httpQuery("search")
    search: String
}

structure ListFilesOutput {
    @required
    @httpPayload
    result: FileListResponse
}

@http(method: "PATCH", uri: "/files/{fileKey}", code: 200)
operation UpdateFile {
    input: UpdateFileInput,
    output: UpdateFileOutput,
    errors: [BadRequestError, UnauthorizedError, NotFoundError, InternalServerError]
}

structure UpdateFileInput {
    @required
    @httpLabel
    fileKey: String,
    @required
    @httpPayload
    payload: UpdateFileRequest
}

structure UpdateFileOutput {
    @required
    @httpPayload
    result: FileResponse
}


@error("client")
@httpError(400)
structure BadRequestError { message: String }

@error("client")
@httpError(401)
structure UnauthorizedError { message: String }

@error("client")
@httpError(404)
structure NotFoundError { message: String }

@error("client")
@httpError(409)
structure ConflictError { message: String }

@error("server")
@httpError(500)
structure InternalServerError { message: String }
