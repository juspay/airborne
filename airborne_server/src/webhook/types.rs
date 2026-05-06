use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebhookPayload {
    pub success: bool,
    pub action: String,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "resourceType")]
    pub resource_type: String,
    #[serde(rename = "resourceId")]
    pub resource_id: Option<String>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWebhookRequest {
    pub url: String,
    pub actions: Vec<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWebhookRequest {
    pub url: Option<String>,
    pub actions: Option<Vec<String>>,
    pub secret: Option<Option<String>>,
    pub status: Option<String>,
    pub description: Option<Option<String>>,
}

#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub id: uuid::Uuid,
    pub url: String,
    pub status: String,
    pub secret_set: bool,
    pub actions: Vec<String>,
    pub organisation: String,
    pub application: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListWebhooksQuery {
    #[serde(default)]
    pub action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListLogsQuery {
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub success: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct WebhookLogResponse {
    pub id: uuid::Uuid,
    pub webhook_id: uuid::Uuid,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub success: bool,
    pub status_code: Option<i32>,
    pub response: serde_json::Value,
    pub webhook_payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct WebhookMetrics {
    pub total: i64,
    pub success: i64,
    pub failed: i64,
    pub success_rate: f64,
}

#[derive(Debug, Deserialize)]
pub struct TestWebhookRequest {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdhocTestWebhookRequest {
    pub url: String,
    #[serde(default)]
    pub secret: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AdhocTestWebhookResponse {
    pub success: bool,
    pub status_code: Option<i32>,
    pub response: serde_json::Value,
}
