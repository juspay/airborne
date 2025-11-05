use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct UserCredentials {
    pub name: String,
    pub password: String,
}

#[derive(Deserialize, Serialize)]
pub struct PersonalAccessToken {
    pub client_id: uuid::Uuid,
    pub client_secret: String,
}

#[derive(Serialize)]
pub struct DeleteTokenResponse {
    pub success: bool,
}

#[derive(Serialize)]
pub struct TokenListEntry {
    pub client_id: uuid::Uuid,
    pub created_at: DateTime<Utc>,
}
