use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub index: String,
    pub tag: Option<String>,
    pub version: i32,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageInput {
    pub index: String,
    pub tag: Option<String>,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GetPackageQuery {
    pub package_key: String,
}

#[derive(Deserialize)]
pub struct ListPackageQuery {
    pub search: Option<String>,
}

#[derive(Deserialize)]
pub struct CreatePackageGroupReq {
    pub name: String,
}

#[derive(Serialize)]
pub struct PackageGroup {
    pub name: String,
    pub is_primary: bool,
    pub id: uuid::Uuid,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub search: Option<String>,
}

#[derive(Serialize)]
pub struct PackageV2 {
    pub index: Option<String>,
    pub tag: Option<String>,
    pub version: i32,
    pub files: Vec<String>,
    pub package_group_id: uuid::Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageInputV2 {
    pub index: Option<String>,
    pub tag: Option<String>,
    pub files: Vec<String>,
}
