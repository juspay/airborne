use crate::types::PaginatedQuery;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct FileGroupsQuery {
    #[serde(flatten)]
    pub pagination: PaginatedQuery,
    /// Search by file_path (substring match)
    pub search: Option<String>,
    /// Filter by specific tags (comma-separated)
    pub tags: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FileGroupVersion {
    pub version: i32,
    pub url: String,
    pub size: i64,
    pub checksum: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct FileGroupTag {
    pub tag: String,
    pub version: i32,
}

#[derive(Debug, Serialize)]
pub struct FileGroupResponse {
    pub file_path: String,
    pub versions: Vec<FileGroupVersion>,
    pub tags: Vec<FileGroupTag>,
    pub total_versions: i64,
}

#[derive(Debug, Serialize)]
pub struct FileGroupsListResponse {
    pub groups: Vec<FileGroupResponse>,
    pub total_items: u64,
    pub total_pages: u32,
}
