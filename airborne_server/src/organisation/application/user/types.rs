use serde::{Deserialize, Serialize};

// Request and Response Types
#[derive(Deserialize)]
pub struct UserRequest {
    pub user: String,
    pub access: String,
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

#[derive(Serialize, Clone)]
pub struct PermissionInfo {
    pub key: String,
    pub resource: String,
    pub action: String,
}

#[derive(Serialize, Clone)]
pub struct RoleInfo {
    pub role: String,
    pub is_system: bool,
    pub permissions: Vec<PermissionInfo>,
}

#[derive(Serialize)]
pub struct ListRolesResponse {
    pub roles: Vec<RoleInfo>,
}

#[derive(Serialize)]
pub struct ListPermissionsResponse {
    pub permissions: Vec<PermissionInfo>,
}

#[derive(Deserialize)]
pub struct UpsertRoleRequest {
    pub role: String,
    pub permissions: Vec<String>,
}
