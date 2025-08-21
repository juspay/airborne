use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

#[derive(Debug, Deserialize)]
pub struct CreateReleaseRequest {
    pub config: Option<HashMap<String, serde_json::Value>>,
    pub package_id: Option<String>,
    pub package: Option<PackageRequest>,
    pub dimensions: Option<HashMap<String, serde_json::Value>>,
    pub resources: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct PackageRequest {
    pub properties: Option<serde_json::Value>,
    pub important: Option<Vec<String>>,
    pub lazy: Option<Vec<String>>,
}

#[derive(Serialize, Debug)]
pub struct File {
    pub file_path: String,
    pub url: String,
    pub checksum: String,
}

#[derive(Serialize)]
pub struct Package {
    pub version: i32,
    pub index: String,
    pub properties: Value,
    pub important: Vec<File>,
    pub lazy: Vec<File>,
}

#[derive(Serialize)]
pub struct Config {
    pub boot_timeout: u64,
    pub package_timeout: u64,
}

#[derive(Serialize)]
pub struct CreateReleaseResponse {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub config: Config,
    pub package: Package,
    pub resources: Vec<File>,
    pub experiment: Option<ReleaseExperiment>
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

#[derive(Serialize)]
pub struct ListReleaseResponse {
    pub releases: Vec<CreateReleaseResponse>
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