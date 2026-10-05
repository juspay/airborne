use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateFileSetReq {
    /// Name of the set — its identity, unique within the application
    pub name: String,
    /// File keys for version 1, e.g. "path/to/file@version:3" or "path/to/file@tag:latest";
    /// at least one is required
    pub files: Vec<String>,
    /// Metadata attached to version 1
    pub metadata: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct CreateFileSetVersionReq {
    /// File keys this version snapshots; at least one is required
    pub files: Vec<String>,
    /// Metadata for this version (defaults to {})
    pub metadata: Option<serde_json::Value>,
}

/// One immutable version of a file set. `files` lists file keys
/// (`path@version:N`), ordered by path then version.
#[derive(Serialize)]
pub struct FileSetVersion {
    pub version: i32,
    pub metadata: serde_json::Value,
    pub files: Vec<String>,
    pub created_at: String,
}

/// Set summary: name plus its latest version number. Fetch a version for
/// its files.
#[derive(Serialize, Debug, PartialEq)]
pub struct FileSet {
    pub name: String,
    pub total_versions: i64,
    pub latest_version: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// Set detail: name plus every version, newest first.
#[derive(Serialize)]
pub struct FileSetDetail {
    pub name: String,
    pub versions: Vec<FileSetVersion>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct FileSetsListQuery {
    #[serde(flatten)]
    pub pagination: crate::types::PaginatedQuery,
    pub search: Option<String>,
}
