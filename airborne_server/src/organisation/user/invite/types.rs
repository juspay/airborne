use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct AcceptInviteRequest {
    pub token: String,
}

pub type DeclineInviteRequest = AcceptInviteRequest;

#[derive(Serialize)]
pub struct InviteRSVPResponse {
    pub success: bool,
    pub message: String,
    pub organization: String,
    pub role: String,
    pub action: InviteAction,
}

#[derive(Serialize, PartialEq, Debug)]
pub enum InviteAction {
    Accepted,
    Declined,
}

#[derive(Deserialize)]
pub struct ListInvitesQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Serialize)]
pub struct InviteListItem {
    pub id: String,
    pub email: String,
    pub role: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct ListInvitesResponse {
    pub invites: Vec<InviteListItem>,
    pub pagination: PaginationInfo,
}

#[derive(Serialize)]
pub struct PaginationInfo {
    pub current_page: u32,
    pub per_page: u32,
    pub total_items: i64,
    pub total_pages: u32,
}

#[derive(Deserialize)]
pub struct ValidateInviteRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct ValidateInviteResponse {
    pub invite_id: String,
    pub valid: bool,
    pub email: String,
    pub organization: String,
    pub role: String,
    pub status: String,
    pub created_at: String,
    pub inviter: Option<String>,
}
