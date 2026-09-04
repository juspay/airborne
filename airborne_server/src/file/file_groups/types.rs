use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateFileGroupReq {
    /// Name of the group — its identity, unique within the application
    pub name: String,
    /// File keys for version 1, e.g. "path/to/file@version:3" or "path/to/file@tag:latest"
    pub files: Option<Vec<String>>,
    /// Metadata attached to version 1
    pub metadata: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct CreateFileGroupVersionReq {
    /// File keys this version snapshots
    pub files: Vec<String>,
    /// Metadata for this version (defaults to {})
    pub metadata: Option<serde_json::Value>,
}

/// A member file of a group version, resolved from the files table.
#[derive(Serialize)]
pub struct FileGroupFile {
    pub id: String,
    pub file_path: String,
    pub version: i32,
    pub tag: Option<String>,
    pub url: String,
    pub size: i64,
    pub checksum: String,
}

/// One immutable version of a file group.
#[derive(Serialize)]
pub struct FileGroupVersion {
    pub version: i32,
    pub metadata: serde_json::Value,
    pub files: Vec<FileGroupFile>,
    pub created_at: String,
}

/// Group summary: name plus its latest version.
#[derive(Serialize)]
pub struct FileGroup {
    pub name: String,
    pub total_versions: i64,
    pub latest: Option<FileGroupVersion>,
    pub created_at: String,
    pub updated_at: String,
}

/// Group detail: name plus every version, newest first.
#[derive(Serialize)]
pub struct FileGroupDetail {
    pub name: String,
    pub versions: Vec<FileGroupVersion>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct FileGroupsListQuery {
    #[serde(flatten)]
    pub pagination: crate::types::PaginatedQuery,
    pub search: Option<String>,
}
