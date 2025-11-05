use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct UpdateApplicationSettingsRequest {
    pub maven_namespace: Option<String>,
    pub maven_artifact_id: Option<String>,
    pub maven_group_id: Option<String>,
}

#[derive(Serialize)]
pub struct ApplicationSettingsResponse {
    pub maven_namespace: String,
    pub maven_artifact_id: String,
    pub maven_group_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct SettingsHistoryQuery {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
}

#[derive(Serialize)]
pub struct ApplicationSettingsHistoryEntry {
    pub version: i32,
    pub maven_namespace: String,
    pub maven_artifact_id: String,
    pub maven_group_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ApplicationSettingsHistoryResponse {
    pub org_id: String,
    pub app_id: String,
    pub settings: Vec<ApplicationSettingsHistoryEntry>,
    pub total: i64,
    pub page: i32,
    pub per_page: i32,
    pub total_pages: i32,
}
