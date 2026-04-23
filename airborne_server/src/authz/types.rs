use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PermissionCatalogQuery {
    pub scope: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PermissionCatalogItem {
    pub key: String,
    pub resource: String,
    pub action: String,
    pub scope: String,
}

#[derive(Debug, Serialize)]
pub struct PermissionCatalogResponse {
    pub permissions: Vec<PermissionCatalogItem>,
}

#[derive(Debug, Deserialize)]
pub struct PermissionBatchCheckRequest {
    pub resource: String,
    pub action: String,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnforceBatchRequest {
    pub checks: Vec<PermissionBatchCheckRequest>,
}

#[derive(Debug, Serialize)]
pub struct PermissionBatchCheckResult {
    pub key: String,
    pub resource: String,
    pub action: String,
    pub scope: String,
    pub allowed: bool,
}

#[derive(Debug, Serialize)]
pub struct EnforceBatchResponse {
    pub results: Vec<PermissionBatchCheckResult>,
}
