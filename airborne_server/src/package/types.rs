use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Package {
    pub index: String,
    pub tag: Option<String>,
    pub version: i32,
    pub files: Vec<String>,
    /// File sets this package was built from, snapshotted at creation
    #[serde(default)]
    pub file_sets: Vec<PackageFileSet>,
}

/// Snapshot of one file set's contribution to a package.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageFileSet {
    pub name: String,
    pub version: i32,
    pub files: Vec<String>,
}

/// Reference to a file set version, as supplied by the caller.
#[derive(Debug, Deserialize, Clone)]
pub struct FileSetRef {
    pub name: String,
    pub version: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageInput {
    pub index: String,
    pub tag: Option<String>,
    /// Individually chosen files (file keys)
    pub files: Vec<String>,
    /// File sets whose files are included, pinned to a set version
    pub file_sets: Option<Vec<FileSetRef>>,
}

#[derive(Debug, Deserialize)]
pub struct GetPackageQuery {
    pub package_key: String,
}

#[derive(Deserialize)]
pub struct ListPackageQuery {
    pub search: Option<String>,
}
