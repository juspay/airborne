use serde::{Deserialize, Serialize};

// Request and Response Types
#[derive(Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum AccessLvl {
    Admin,
    Write,
    Read,
}

impl AccessLvl {
    pub fn as_str(&self) -> String {
        match self {
            Self::Admin => "admin".to_string(),
            Self::Write => "write".to_string(),
            Self::Read => "read".to_string(),
        }
    }
}

#[derive(Deserialize)]
pub struct UserRequest {
    pub user: String,
    pub access: AccessLvl,
}

#[derive(Deserialize)]
pub struct RemoveUserRequest {
    pub user: String,
}

#[derive(Serialize)]
pub struct UserOperationResponse {
    pub user: String,
    pub success: bool,
    pub operation: String,
}

#[derive(Serialize)]
pub struct ListUsersResponse {
    pub users: Vec<UserInfo>,
}

#[derive(Serialize)]
pub struct UserInfo {
    pub username: String,
    pub email: Option<String>,
    pub roles: Vec<String>,
}

// Helper structs

pub struct UserContext {
    pub user_id: String,
    pub username: String,
}

pub struct AppContext {
    pub org_name: String,
    pub app_name: String,
    pub app_group_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserOperation {
    Add,
    Update,
    Remove,
}
