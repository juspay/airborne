// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use serde::{Deserialize, Serialize};

use crate::utils::db::models::WebhookEntry;

pub const DEFAULT_PAYLOAD_VERSION: &str = "v1";
pub const DEFAULT_METHOD: &str = "POST";

/// Methods a webhook may be delivered with. The payload is sent as the request body for
/// all of them, including `GET` — which is why GET is discouraged in the dashboard and
/// the docs: many servers and proxies drop a GET body, and a dropped body also breaks
/// signature verification.
pub const ALLOWED_METHODS: &[&str] = &["POST", "PUT", "PATCH", "GET"];

#[derive(Debug, Deserialize)]
pub struct CreateWebhookRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    pub events: Vec<String>,
    #[serde(default)]
    pub custom_headers: Option<serde_json::Value>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub max_retries: Option<i32>,
    /// Optional HMAC signing secret. If omitted/empty the webhook is unsigned.
    #[serde(default)]
    pub secret: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWebhookRequest {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub custom_headers: Option<serde_json::Value>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub max_retries: Option<i32>,
    /// Optional HMAC signing secret. If omitted/empty the webhook is unsigned.
    #[serde(default)]
    pub secret: Option<String>,
}

/// A webhook config as returned to clients — never includes the signing secret.
#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub id: String,
    /// `"org"` or `"app"` — fixed at creation.
    pub scope: String,
    /// The application this webhook is scoped to; `null` for an org-scoped webhook.
    pub application: Option<String>,
    pub name: String,
    pub description: String,
    pub url: String,
    pub method: String,
    pub events: Vec<String>,
    pub custom_headers: serde_json::Value,
    pub enabled: bool,
    pub payload_version: String,
    pub max_retries: i32,
    /// Whether a signing secret is configured (payloads are HMAC-signed).
    pub signed: bool,
    pub created_at: String,
    pub created_by: String,
    pub updated_at: String,
    pub updated_by: String,
}

impl WebhookResponse {
    pub fn from_entry(e: &WebhookEntry) -> Self {
        let events = serde_json::from_value::<Vec<String>>(e.events.clone()).unwrap_or_default();
        Self {
            id: e.id.to_string(),
            scope: if e.app_id.is_some() { "app" } else { "org" }.to_string(),
            application: e.app_id.clone(),
            name: e.name.clone(),
            description: e.description.clone(),
            url: e.url.clone(),
            method: e.method.clone(),
            events,
            custom_headers: e.custom_headers.clone(),
            enabled: e.enabled,
            payload_version: e.payload_version.clone(),
            max_retries: e.max_retries,
            signed: e.secret_encrypted.is_some(),
            created_at: e.created_at.to_rfc3339(),
            created_by: e.created_by.clone(),
            updated_at: e.updated_at.to_rfc3339(),
            updated_by: e.updated_by.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RotateSecretResponse {
    pub secret: String,
}

#[derive(Debug, Deserialize)]
pub struct TestWebhookRequest {
    #[serde(default)]
    pub event: Option<String>,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct EventCatalogItem {
    pub key: String,
    pub resource: String,
    pub action: String,
    pub default_delay_seconds: i64,
}

#[derive(Debug, Serialize)]
pub struct EventsResponse {
    pub events: Vec<EventCatalogItem>,
}

/// One delivery attempt, stored in the `attempts` JSONB array on a delivery row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookAttempt {
    pub attempt_number: i32,
    pub request_url: String,
    pub request_headers: serde_json::Value,
    pub request_body: String,
    pub response_status: Option<i32>,
    pub response_headers: Option<serde_json::Value>,
    pub response_body: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<i32>,
    pub attempted_at: String,
}

/// The signed envelope sent to the customer URL.
#[derive(Debug, Serialize)]
pub struct WebhookEnvelope {
    pub id: String,
    pub event: String,
    pub api_version: String,
    pub created_at: String,
    pub organisation: String,
    /// The application the event happened in. `null` for org-level events
    /// (`application.create`, `organisation_user.*`), which belong to no application.
    pub application: Option<String>,
    pub data: serde_json::Value,
}
