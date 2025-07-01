use clickhouse::Row;
use serde::Serialize;

#[derive(Row, Serialize)]
pub struct OtaEventRow {
    #[serde(rename = "orgId")]
    pub org_id: String,
    #[serde(rename = "appId")]
    pub app_id: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "eventType")]
    pub event_type: String,
    #[serde(rename = "eventId", with = "clickhouse::serde::uuid")]
    pub event_id: uuid::Uuid,
    pub timestamp: i64,
    #[serde(rename = "eventDate")]
    pub event_date: u16,
    #[serde(rename = "releaseId")]
    pub release_id: Option<String>,
    #[serde(rename = "currentJsVersion")]
    pub current_js_version: Option<String>,
    #[serde(rename = "targetJsVersion")]
    pub target_js_version: Option<String>,
    #[serde(rename = "rolloutPercentage")]
    pub rollout_percentage: Option<u8>,
    #[serde(rename = "osVersion")]
    pub os_version: Option<String>,
    #[serde(rename = "appVersion")]
    pub app_version: Option<String>,
    #[serde(rename = "deviceType")]
    pub device_type: Option<String>,
    #[serde(rename = "networkType")]
    pub network_type: Option<String>,
    #[serde(rename = "errorCode")]
    pub error_code: Option<String>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "stackTrace")]
    pub stack_trace: Option<String>,
    #[serde(rename = "downloadSizeBytes")]
    pub download_size_bytes: Option<u64>,
    #[serde(rename = "downloadTimeMs")]
    pub download_time_ms: Option<u64>,
    #[serde(rename = "applyTimeMs")]
    pub apply_time_ms: Option<u64>,
    pub payload: String, // Changed to Option<String> to match Nullable(String)
    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(rename = "ipAddress")]
    pub ip_address: Option<String>,
    // ingestedAt is removed since it has a DEFAULT value in ClickHouse
}
