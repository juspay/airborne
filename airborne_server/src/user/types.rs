use serde::{Deserialize, Serialize};

use crate::organisation::Organisation;

#[derive(Serialize, Deserialize)]
pub struct User {
    pub user_id: String,
    pub organisations: Vec<Organisation>,
    pub user_token: Option<UserToken>,
    pub is_super_admin: bool,
    pub username: String,
}

#[derive(Serialize, Deserialize)]
pub struct OAuthLoginRequest {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub refresh_expires_in: Option<i64>,
    pub id_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthState {
    pub state: String,
    pub code_verifier: String,
    pub redirect_uri: String,
}

#[derive(Serialize, Deserialize)]
pub struct OAuthRequest {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct UserCredentials {
    pub name: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserToken {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: String,
    pub refresh_expires_in: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LoginFailure {
    pub error: String,
    pub error_description: String,
}
