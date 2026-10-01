use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateServiceAccountRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub role: String,
}

#[derive(Serialize)]
pub struct CreateServiceAccountResponse {
    pub client_id: uuid::Uuid,
    pub client_secret: String,
    pub email: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct ServiceAccountListEntry {
    pub client_id: uuid::Uuid,
    pub name: String,
    pub email: String,
    pub description: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct RotateServiceAccountResponse {
    pub client_id: uuid::Uuid,
    pub client_secret: String,
}

#[derive(Serialize)]
pub struct DeleteServiceAccountResponse {
    pub success: bool,
}
