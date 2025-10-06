use std::fmt::Display;

use actix_multipart::form::{tempfile::TempFile, MultipartForm};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct FileRequest {
    pub file_path: String,
    pub url: String,
    pub tag: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Serialize, Deserialize)]
pub struct BulkFileRequest {
    pub files: Vec<FileRequest>,
    pub skip_duplicates: bool,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateFileRequest {
    pub tag: String,
}

#[derive(Serialize, Deserialize)]
pub enum FileStatus {
    Pending,
    Ready,
}

impl Display for FileStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            FileStatus::Pending => write!(f, "pending"),
            FileStatus::Ready => write!(f, "ready"),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct FileResponse {
    pub id: String,
    pub file_path: String,
    pub url: String,
    pub version: i32,
    pub tag: Option<String>,
    pub size: i64,
    pub checksum: String,
    pub metadata: Value,
    pub status: FileStatus,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct FileListResponse {
    pub files: Vec<FileResponse>,
    pub total: usize,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Serialize, Deserialize)]
pub struct BulkFileResponse {
    pub created_files: Vec<FileResponse>,
    pub skipped_files: Vec<String>,
    pub total_created: usize,
    pub total_skipped: usize,
}

#[derive(Deserialize)]
pub struct FileListQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub search: Option<String>,
}

#[derive(Deserialize)]
pub struct GetFileQuery {
    pub file_key: String,
}

#[derive(MultipartForm)]
pub struct UploadFileRequest {
    pub file: TempFile,
    pub file_path: actix_multipart::form::text::Text<String>,
    pub version: actix_multipart::form::text::Text<i32>,
}

#[derive(MultipartForm)]
pub struct UploadBulkFilesRequest {
    pub file: TempFile,
    pub skip_duplicates: actix_multipart::form::text::Text<bool>,
}

#[derive(Deserialize)]
pub struct UploadBulkMapping {
    pub file_name: String,
    pub file_path: String,
    pub version: i32,
    pub metadata: Option<Value>,
}

#[derive(Serialize)]
pub struct BulkFileUploadResponse {
    pub uploaded: Vec<FileResponse>,
    pub skipped: Vec<String>,
}
