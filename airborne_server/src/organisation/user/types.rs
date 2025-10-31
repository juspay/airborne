use serde::{Deserialize, Serialize};

use crate::utils::db::models::InviteRole;

#[derive(Deserialize, Serialize, Debug)]
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

    pub fn to_invite_role(&self) -> InviteRole {
        match self {
            Self::Admin => InviteRole::Admin,
            Self::Write => InviteRole::Write,
            Self::Read => InviteRole::Read,
        }
    }
}

#[derive(Deserialize, Serialize)]
pub struct ApplicationAccess {
    pub name: String,
    pub level: AccessLvl,
}

#[derive(Deserialize)]
pub struct UserRequest {
    pub user: String,
    pub access: AccessLvl,
    pub applications: Option<Vec<ApplicationAccess>>,
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

pub struct OrgContext {
    pub org_id: String,
    pub group_id: String,
}
