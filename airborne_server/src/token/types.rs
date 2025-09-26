use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct UserCredentials {
    pub name: String,
    pub password: String,
}

#[derive(Deserialize, Serialize)]
pub struct Tokens {
    pub client_id: uuid::Uuid,
    pub client_secret: String,
}

#[derive(Serialize)]
pub struct DeleteTokenResponse {
    pub success: bool,
}
