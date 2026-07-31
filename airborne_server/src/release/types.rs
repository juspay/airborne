use std::collections::{BTreeMap, HashMap};

use crate::utils::db::models::{FileEntry, PackageV2Entry};
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
    pub size: i64,
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

#[derive(Serialize, Deserialize)]
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
    pub resources: Vec<Resource>,
    pub experiment: Option<ReleaseExperiment>,
    pub dimensions: HashMap<String, serde_json::Value>,
}

#[derive(Serialize)]
pub struct Resource {
    pub file_id: String,
    pub file_path: String,
    pub url: String,
    pub checksum: String,
    pub size: i64,
}

#[derive(Serialize, Debug)]
pub struct ReleaseExperiment {
    pub experiment_id: String,
    pub experiment_variants: ExperimentVariants,
    pub package_version: i32,
    pub config_version: String,
    pub created_at: String,
    pub traffic_percentage: u32,
    pub status: String,
}

#[derive(Serialize, Debug)]
pub struct ExperimentVariants {
    pub control: String,
    pub experimentals: Vec<String>,
}

#[derive(Debug, Deserialize, Clone)]
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
            ReleaseStatus::Created => Self::Created,
            ReleaseStatus::Inprogress => Self::Inprogress,
            ReleaseStatus::Concluded => Self::Concluded,
            ReleaseStatus::Discarded => Self::Discarded,
        }
    }
}

#[derive(Deserialize)]
pub struct ListReleaseQuery {
    pub status: Option<ReleaseStatus>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unresolved_properties: Option<UnresolvedProperties>,
}

/// The unresolved Superposition bundle for an application's workspace, narrowed to
/// the `config.properties` key space, attached to the serve-release response when
/// `?extended=true`.
///
/// This is the same data the server just resolved against, handed over unresolved
/// so a caller can resolve properties itself. `config` maps onto
/// `ProviderCache::init_config` and the two experiment lists onto
/// `ProviderCache::init_experiments` in `superposition_core`.
///
/// `Deserialize` is required because this is cached in Redis per (org, app); see
/// `release::utils::get_unresolved_properties`.
#[derive(Serialize, Deserialize, Clone)]
pub struct UnresolvedProperties {
    /// `contexts`, `overrides`, `default_configs` and `dimensions`, serialised
    /// exactly as `superposition_types::Config` does, with every config key other
    /// than `config.properties*` filtered out. `dimensions` is *not* filtered, so
    /// cohort dimensions still carry their JsonLogic `definitions` and cohort
    /// membership is derivable from this payload alone.
    pub config: Value,
    pub config_version: String,
    pub config_last_modified: DateTime<Utc>,
    pub experiments: Value,
    pub experiment_groups: Value,
    pub experiments_last_modified: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct ServeReleaseQueryParams {
    pub toss: Option<String>,
    /// Held as a string rather than a `bool` so that a junk value degrades to
    /// "not requested" instead of 400-ing the boot path on a query-parse error.
    pub extended: Option<String>,
}

impl ServeReleaseQueryParams {
    pub fn wants_extended(&self) -> bool {
        self.extended
            .as_deref()
            .is_some_and(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "true" | "1"))
    }
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

#[derive(Debug, Deserialize)]
pub struct DiscardReleaseRequest {
    pub change_reason: Option<String>,
}

#[derive(Serialize)]
pub struct DiscardReleaseResponse {
    pub success: bool,
    pub message: String,
    pub experiment_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct OpenFeaturePackage {
    pub name: String,
    pub version: i32,
    pub index: String,
    pub properties: Value,
    pub important: Vec<String>,
    pub lazy: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct OpenFeatureReleaseConfig {
    pub config: Config,
    pub package: OpenFeaturePackage,
    pub resources: Vec<String>,
}
