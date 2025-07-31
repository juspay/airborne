use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub index: String,
    pub tag: String,
    pub version: i32,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageInput {
    pub index: String,
    pub tag: String,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListPackagesInput {
    pub offset: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ListPackagesOutput {
    pub packages: Vec<Package>,
    pub page_number: i32,
    pub next_offset: Option<i32>,
    pub prev_offset: Option<i32>,
    pub total_pages: i32,
}

#[derive(Debug, Deserialize)]
pub struct GetPackageQuery {
    pub package_key: String,
}