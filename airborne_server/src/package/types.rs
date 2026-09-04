use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Package {
    pub index: String,
    pub tag: Option<String>,
    pub version: i32,
    pub files: Vec<String>,
    /// File groups this package was built from, snapshotted at creation
    #[serde(default)]
    pub file_groups: Vec<PackageFileGroup>,
}

/// Snapshot of one file group's contribution to a package.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageFileGroup {
    pub name: String,
    pub version: i32,
    pub files: Vec<String>,
}

/// Reference to a file group version, as supplied by the caller.
#[derive(Debug, Deserialize, Clone)]
pub struct FileGroupRef {
    pub name: String,
    pub version: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageInput {
    pub index: String,
    pub tag: Option<String>,
    /// Individually chosen files (file keys)
    pub files: Vec<String>,
    /// File groups whose files are included, pinned to a group version
    pub file_groups: Option<Vec<FileGroupRef>>,
}

#[derive(Debug, Deserialize)]
pub struct GetPackageQuery {
    pub package_key: String,
}

#[derive(Deserialize)]
pub struct ListPackageQuery {
    pub search: Option<String>,
}
