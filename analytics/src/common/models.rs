use std::{str::FromStr, sync::Arc};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::{common::config::Config, kafka};

use crate::core::clickhouse;
use crate::core::victoria;

#[derive(Clone)]
pub struct AppState {
    pub clickhouse: Option<Arc<clickhouse::Client>>,
    pub victoria: Option<Arc<victoria::Client>>,
    pub kafka: Option<Arc<kafka::Producer>>,
    pub config: Arc<Config>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LoggingInfra {
    VictoriaMetrics,
    KafkaClickhouse,
}

impl ToString for LoggingInfra {
    fn to_string(&self) -> String {
        match self {
            LoggingInfra::VictoriaMetrics => "victoria-metrics".to_string(),
            LoggingInfra::KafkaClickhouse => "kafka-clickhouse".to_string(),
        }
    }
}

impl FromStr for LoggingInfra {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "victoria-metrics" => Ok(LoggingInfra::VictoriaMetrics),
            "kafka-clickhouse" => Ok(LoggingInfra::KafkaClickhouse),
            _ => Err(format!("Unknown logging infrastructure: {}", s)),
        }
    }
}

/// Core OTA event structure following the enterprise schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtaEvent {
    // Core identifiers
    pub org_id: String,
    pub app_id: String,
    pub device_id: String,
    pub session_id: Option<String>,

    // Event metadata
    pub event_type: OtaEventType,
    pub event_id: Option<Uuid>,
    pub timestamp: DateTime<Utc>,

    // Release information
    pub release_id: Option<String>,
    pub current_js_version: Option<String>,
    pub target_js_version: Option<String>,
    pub rollout_percentage: Option<u8>,

    // Device/Environment context
    pub os_version: Option<String>,
    pub app_version: Option<String>,
    pub device_type: Option<String>,
    pub network_type: Option<String>,

    // Error information
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,

    // Performance metrics
    pub download_size_bytes: Option<u64>,
    pub download_time_ms: Option<u64>,
    pub apply_time_ms: Option<u64>,

    // Additional payload
    pub payload: Option<Value>,

    // Request metadata (filled by server)
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
}

/// OTA Event types as defined in the analytics requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OtaEventType {
    UpdateCheck,
    UpdateAvailable,
    UpdateNotAvailable,
    DownloadStarted,
    DownloadProgress,
    DownloadCompleted,
    DownloadFailed,
    ApplyStarted,
    ApplySuccess,
    ApplyFailure,
    RollbackInitiated,
    RollbackCompleted,
    RollbackFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AnalyticsInterval {
    Day,
    Hour,
    Week,
    Month,
}

impl ToString for AnalyticsInterval {
    fn to_string(&self) -> String {
        match self {
            AnalyticsInterval::Day => "DAY".to_string(),
            AnalyticsInterval::Hour => "HOUR".to_string(),
            AnalyticsInterval::Week => "WEEK".to_string(),
            AnalyticsInterval::Month => "MONTH".to_string(),
        }
    }
}

impl ToString for OtaEventType {
    fn to_string(&self) -> String {
        match self {
            OtaEventType::UpdateCheck => "UPDATE_CHECK".to_string(),
            OtaEventType::UpdateAvailable => "UPDATE_AVAILABLE".to_string(),
            OtaEventType::UpdateNotAvailable => "UPDATE_NOT_AVAILABLE".to_string(),
            OtaEventType::DownloadStarted => "DOWNLOAD_STARTED".to_string(),
            OtaEventType::DownloadProgress => "DOWNLOAD_PROGRESS".to_string(),
            OtaEventType::DownloadCompleted => "DOWNLOAD_COMPLETED".to_string(),
            OtaEventType::DownloadFailed => "DOWNLOAD_FAILED".to_string(),
            OtaEventType::ApplyStarted => "APPLY_STARTED".to_string(),
            OtaEventType::ApplySuccess => "APPLY_SUCCESS".to_string(),
            OtaEventType::ApplyFailure => "APPLY_FAILURE".to_string(),
            OtaEventType::RollbackInitiated => "ROLLBACK_INITIATED".to_string(),
            OtaEventType::RollbackCompleted => "ROLLBACK_COMPLETED".to_string(),
            OtaEventType::RollbackFailed => "ROLLBACK_FAILED".to_string(),
        }
    }
}

/// Request structure for ingesting OTA events via API
#[derive(Debug, Serialize, Deserialize)]
pub struct OtaEventIngestRequest {
    pub org_id: String,
    pub app_id: String,
    pub device_id: String,
    pub session_id: Option<String>,
    pub event_type: OtaEventType,

    // Release information
    pub release_id: Option<String>,
    pub current_js_version: Option<String>,
    pub target_js_version: Option<String>,
    pub rollout_percentage: Option<u8>,

    // Device context
    pub os_version: Option<String>,
    pub app_version: Option<String>,
    pub device_type: Option<String>,
    pub network_type: Option<String>,

    // Error info (if applicable)
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,

    // Performance metrics
    pub download_size_bytes: Option<u64>,
    pub download_time_ms: Option<u64>,
    pub apply_time_ms: Option<u64>,

    // Additional payload
    pub payload: Option<Value>,
}

/// Analytics query request for querying events
#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsQuery {
    pub org_id: Option<String>,
    pub app_id: Option<String>,
    pub device_id: Option<String>,
    pub event_type: Option<OtaEventType>,
    pub release_id: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

impl Default for AnalyticsQuery {
    fn default() -> Self {
        Self {
            org_id: None,
            app_id: None,
            device_id: None,
            event_type: None,
            release_id: None,
            start_time: None,
            end_time: None,
            limit: Some(100),
            offset: Some(0),
        }
    }
}

/// Response structure for analytics queries
#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsQueryResult {
    pub events: Vec<Value>,
    pub total_count: usize,
    pub page_info: PageInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageInfo {
    pub limit: u64,
    pub offset: u64,
    pub has_next_page: bool,
}

/// Adoption metrics response
#[derive(Debug, Serialize, Deserialize)]
pub struct AdoptionMetrics {
    pub org_id: String,
    pub app_id: String,
    pub release_id: String,
    // pub total_installs: u64,
    pub time_breakdown: Vec<AdoptionTimeSeries>,
    // pub success_rate: f64,
    // pub failure_rate: f64,
    // pub rollback_rate: f64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AdoptionTimeSeries {
    pub time_slot: DateTime<Utc>,
    pub download_success: u64,
    pub download_failures: u64,
    pub apply_success: u64,
    pub apply_failures: u64,
    pub rollbacks_initiated: u64,
    pub rollbacks_completed: u64,
    pub rollback_failures: u64,
    pub update_checks: u64,
    pub update_available: u64,
}

/// Version distribution metrics
#[derive(Debug, Serialize, Deserialize)]
pub struct VersionDistribution {
    pub org_id: String,
    pub app_id: String,
    pub versions: Vec<VersionMetrics>,
    pub total_devices: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionMetrics {
    pub js_version: String,
    pub device_count: u64,
    pub percentage: f64,
}

/// Active devices metrics
#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveDevicesMetrics {
    pub org_id: String,
    pub app_id: String,
    pub daily_breakdown: Vec<DailyActiveDevices>,
    pub total_active_devices: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyActiveDevices {
    pub date: chrono::NaiveDate,
    pub active_devices: u64,
}

/// Failure analytics response
#[derive(Debug, Serialize, Deserialize)]
pub struct FailureAnalytics {
    pub org_id: String,
    pub app_id: String,
    pub release_id: Option<String>,
    pub total_failures: u64,
    pub total_rollbacks: u64,
    pub common_errors: Vec<ErrorFrequency>,
    pub failure_rate_trend: Vec<DailyFailures>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorFrequency {
    pub error_code: String,
    pub count: u64,
    pub percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyFailures {
    pub date: chrono::NaiveDate,
    pub failures: u64,
    pub rollbacks: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: DateTime<Utc>,
    pub services: ServiceHealthCheck,
    pub metrics: SystemMetrics,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceHealthCheck {
    pub clickhouse: bool,
    pub kafka: bool,
    pub consumer_lag: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub events_processed_last_hour: u64,
    pub storage_size_gb: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub code: u16,
    pub error: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub trace_id: Option<String>,
}

impl ErrorResponse {
    pub fn internal<E>(err: E) -> Self
    where
        E: ToString,
    {
        Self {
            code: 500,
            message: "An internal error occurred".to_string(),
            error: err.to_string(),
            timestamp: Utc::now(),
            trace_id: None,
        }
    }

    pub fn bad_request<E>(err: E) -> Self
    where
        E: ToString,
    {
        Self {
            code: 400,
            message: "There's an error with your input".to_string(),
            error: err.to_string(),
            timestamp: Utc::now(),
            trace_id: None,
        }
    }
}

// so you can just `return ErrorResponse` from handlers or layers
impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}

// Type aliases for backward compatibility and cleaner imports
pub type OtaEventRequest = OtaEventIngestRequest;
pub type EventType = OtaEventType;

// Additional types needed by handlers
#[derive(Debug, Serialize, Deserialize)]
pub struct FailureMetrics {
    pub org_id: String,
    pub app_id: String,
    pub release_id: Option<String>,
    pub total_failures: u64,
    pub failure_rate: f64,
    pub common_errors: Vec<ErrorFrequency>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub org_id: String,
    pub app_id: String,
    pub release_id: Option<String>,
    pub avg_download_time_ms: f64,
    pub avg_apply_time_ms: f64,
    pub avg_download_size_bytes: f64,
}

// Generic analytics response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsResponse<T> {
    pub data: T,
    pub timestamp: DateTime<Utc>,
}
