use std::collections::{BTreeMap, HashMap};

use crate::{
    types::PaginatedQuery,
    utils::db::models::{FileEntry, PackageV2Entry},
};
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use superposition_sdk::types::ExperimentStatusType;

#[derive(Debug, Deserialize)]
pub struct CreateReleaseRequest {
    pub config: ConfigRequest,
    pub package_id: Option<String>,
    pub package: Option<PackageRequest>,
    pub dimensions: Option<HashMap<String, serde_json::Value>>,
    pub resources: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ConfigRequest {
    pub boot_timeout: u64,
    pub release_config_timeout: u64,
    pub properties: Option<BTreeMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct PackageRequest {
    pub properties: Option<serde_json::Value>,
    pub important: Option<Vec<String>>,
    pub lazy: Option<Vec<String>>,
}

#[derive(Serialize, Debug)]
pub struct ServeFile {
    pub file_path: String,
    pub url: String,
    pub checksum: String,
}

#[derive(Serialize)]
pub struct ServePackage {
    pub name: String,
    pub version: String,
    pub index: ServeFile,
    pub properties: Value,
    pub important: Vec<ServeFile>,
    pub lazy: Vec<ServeFile>,
}

#[derive(Serialize)]
pub struct Config {
    pub boot_timeout: u32,
    pub release_config_timeout: u32,
    pub version: String,
    pub properties: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct CreateReleaseResponse {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub config: Config,
    pub package: ServePackage,
    pub resources: Vec<ServeFile>,
    pub experiment: Option<ReleaseExperiment>,
    pub dimensions: HashMap<String, serde_json::Value>,
}

#[derive(Serialize)]
pub struct GetReleaseResponse {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub config: Config,
    pub package: ServePackage,
    pub resources: Vec<ServeFile>,
    pub experiment: Option<ReleaseExperiment>,
    pub dimensions: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Debug)]
pub struct ReleaseExperiment {
    pub experiment_id: String,
    pub package_version: i32,
    pub config_version: String,
    pub created_at: String,
    pub traffic_percentage: u32,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReleaseStatus {
    Created,
    Inprogress,
    Concluded,
    Discarded,
}

impl From<ReleaseStatus> for ExperimentStatusType {
    fn from(status: ReleaseStatus) -> Self {
        match status {
            ReleaseStatus::Created => ExperimentStatusType::Created,
            ReleaseStatus::Inprogress => ExperimentStatusType::Inprogress,
            ReleaseStatus::Concluded => ExperimentStatusType::Concluded,
            ReleaseStatus::Discarded => ExperimentStatusType::Discarded,
        }
    }
}

#[derive(Deserialize)]
pub struct ListReleaseQuery {
    #[serde(flatten)]
    pub pagination: PaginatedQuery,
    pub status: Option<ReleaseStatus>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileResource {
    pub url: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
}

#[derive(Debug, Deserialize)]
pub struct RampReleaseRequest {
    pub traffic_percentage: u8,
    pub change_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConcludeReleaseRequest {
    pub chosen_variant: String,
    pub change_reason: Option<String>,
}

#[derive(Serialize)]
pub struct RampReleaseResponse {
    pub success: bool,
    pub message: String,
    pub experiment_id: String,
    pub traffic_percentage: u8,
}

#[derive(Serialize)]
pub struct ConcludeReleaseResponse {
    pub success: bool,
    pub message: String,
    pub experiment_id: String,
    pub chosen_variant: String,
}

#[derive(Serialize)]
pub struct ServeReleaseResponse {
    pub version: String,
    pub config: Config,
    pub package: ServePackage,
    pub resources: Vec<ServeFile>,
}

#[derive(Deserialize)]
pub struct ServeReleaseQueryParams {
    pub toss: Option<String>,
}

pub struct BuildOverrides {
    pub final_important: Option<Vec<String>>,
    pub package_data: PackageV2Entry,
    pub is_first_release: bool,
    pub final_lazy: Option<Vec<String>>,
    pub final_resources: Option<Vec<String>>,
    pub config_version: String,
    pub config_properties: BTreeMap<String, aws_smithy_types::Document>,
    pub pkg_version: i32,
    pub files: Vec<FileEntry>,
    pub final_properties: Option<Value>,
    pub control_overrides: HashMap<String, Document>,
    pub experimental_overrides: HashMap<String, Document>,
}

pub struct ListExperimentsQuery {
    pub superposition_org_id: String,
    pub workspace_name: String,
    pub context: HashMap<String, Value>,
    pub strict_mode: bool,
    pub page: Option<i64>,
    pub count: Option<i64>,
    pub all: bool,
    pub status: Option<ExperimentStatusType>,
}
