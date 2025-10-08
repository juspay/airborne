use actix_multipart::form::{tempfile::TempFile, MultipartForm};
use actix_web::error::PayloadError;
use bytes::Bytes;
use http_body::Frame;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::Display;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::sync::mpsc;

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
#[derive(Deserialize)]
pub struct UploadFileQuery {
    pub file_path: String,
    pub tag: Option<String>,
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

pub type ReadResult = Result<Bytes, PayloadError>;
pub struct FileStream(pub mpsc::UnboundedReceiver<ReadResult>);

impl http_body::Body for FileStream {
    type Data = Bytes;
    type Error = std::io::Error;

    fn poll_frame(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        match self.0.poll_recv(cx) {
            Poll::Pending => {
                // No new data in stream, awaiting...
                Poll::Pending
            }
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Ready(Some(result)) => match result {
                Ok(bytes) => Poll::Ready(Some(Ok(Frame::data(bytes)))),
                Err(e) => Poll::Ready(Some(Err(std::io::Error::other(e)))),
            },
        }
    }
}
