use actix_web::{
    post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use chrono::Utc;
use diesel::prelude::*;
use log::{debug, info};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    middleware::auth::AuthResponse,
    organisation::user::{transaction::add_user_with_transaction, OrgContext, UserContext},
    run_blocking,
    types::{ABError, AppState},
    utils::{
        db::{
            models::{InviteRole, InviteStatus, OrganisationInviteEntry},
            schema::hyperotaserver::organisation_invites,
            DbPool,
        },
        keycloak::{find_org_group, find_user_by_username, prepare_user_action},
    },
};

pub fn add_routes() -> Scope {
    Scope::new("").service(accept_invite)
}

/// Check if there's an existing pending invite for the same org and email
pub async fn find_existing_pending_invite(
    pool: &DbPool,
    org_id: &str,
    email: &str,
    role: &InviteRole,
) -> Result<Option<OrganisationInviteEntry>, ABError> {
    let pool = pool.clone();
    let org_id = org_id.to_string();
    let email = email.to_string();
    let role = role.clone();

    run_blocking!({
        let mut conn = pool.get().map_err(|e| {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UnableToSendCommand,
                Box::new(e.to_string()),
            )
        })?;

        Ok(organisation_invites::table
            .filter(organisation_invites::org_id.eq(&org_id))
            .filter(organisation_invites::email.eq(&email))
            .filter(organisation_invites::role.eq(&role))
            .filter(
                organisation_invites::status.eq(crate::utils::db::models::InviteStatus::Pending),
            )
            .first::<OrganisationInviteEntry>(&mut conn)
            .optional()?)
    })
}

/// Update an existing invite's token and created_at timestamp
pub async fn update_existing_invite(
    pool: &DbPool,
    invite_id: Uuid,
    new_token: String,
) -> Result<OrganisationInviteEntry, ABError> {
    let pool = pool.clone();

    run_blocking!({
        let mut conn = pool.get().map_err(|e| {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UnableToSendCommand,
                Box::new(e.to_string()),
            )
        })?;

        Ok(diesel::update(organisation_invites::table.find(invite_id))
            .set((
                organisation_invites::token.eq(new_token),
                organisation_invites::created_at.eq(Utc::now()),
            ))
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })
}

/// Insert a new invite into the database
pub async fn create_new_invite(
    pool: &DbPool,
    org_id: String,
    email: String,
    role: InviteRole,
    token: String,
) -> Result<OrganisationInviteEntry, ABError> {
    let pool = pool.clone();

    run_blocking!({
        let mut conn = pool.get().map_err(|e| {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UnableToSendCommand,
                Box::new(e.to_string()),
            )
        })?;

        let new_invite = OrganisationInviteEntry {
            id: Uuid::new_v4(),
            org_id,
            email,
            role,
            token,
            status: crate::utils::db::models::InviteStatus::Pending,
            created_at: Utc::now(),
        };

        Ok(diesel::insert_into(organisation_invites::table)
            .values(&new_invite)
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })
}

/// Generate a secure random token for invite links
pub fn generate_invite_token() -> String {
    use rand::{distributions::Alphanumeric, Rng};

    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}

// Request and Response Types for Accept Invite

#[derive(Deserialize)]
pub struct AcceptInviteRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct AcceptInviteResponse {
    pub success: bool,
    pub message: String,
    pub organization: String,
    pub role: String,
}

/// Find invite by token
pub async fn find_invite_by_token(
    pool: &DbPool,
    token: &str,
) -> Result<Option<OrganisationInviteEntry>, ABError> {
    let pool = pool.clone();
    let token = token.to_string();

    run_blocking!({
        let mut conn = pool.get().map_err(|e| {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UnableToSendCommand,
                Box::new(e.to_string()),
            )
        })?;

        Ok(organisation_invites::table
            .filter(organisation_invites::token.eq(&token))
            .filter(organisation_invites::status.eq(InviteStatus::Pending))
            .first::<OrganisationInviteEntry>(&mut conn)
            .optional()?)
    })
}

/// Update invite status to accepted
pub async fn update_invite_status(
    pool: &DbPool,
    invite_id: Uuid,
    status: InviteStatus,
) -> Result<OrganisationInviteEntry, ABError> {
    let pool = pool.clone();

    run_blocking!({
        let mut conn = pool.get().map_err(|e| {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UnableToSendCommand,
                Box::new(e.to_string()),
            )
        })?;

        Ok(diesel::update(organisation_invites::table.find(invite_id))
            .set(organisation_invites::status.eq(status))
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })
}

#[post("/accept")]
pub async fn accept_invite(
    req: HttpRequest,
    body: Json<AcceptInviteRequest>,
    state: web::Data<AppState>,
) -> Result<Json<AcceptInviteResponse>, ABError> {
    let request = body.into_inner();

    // Get authenticated user from request
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    // Extract user email from auth token (assuming it's in the username or a separate field)
    let user_email = auth.username.clone();

    debug!("Processing invite acceptance for user: {}", user_email);

    // 1. Validate invite token and get invite details
    let invite = find_invite_by_token(&state.db_pool, &request.token)
        .await?
        .ok_or_else(|| ABError::BadRequest("Invalid or expired invite token".to_string()))?;

    // Verify the invite is for the authenticated user's email
    if invite.email != user_email {
        return Err(ABError::Unauthorized(
            "Invite token does not match authenticated user".to_string(),
        ));
    }

    debug!(
        "Found valid invite for user {} to join org {} with role {:?}",
        invite.email, invite.org_id, invite.role
    );

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    // Find the target user in Keycloak (the authenticated user)
    let target_user = find_user_by_username(&admin, &realm, &user_email)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Keycloak error: {}", e)))?
        .ok_or_else(|| ABError::NotFound(user_email.clone()))?;

    let target_user_id = target_user
        .id
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("User has no ID".to_string()))?
        .to_string();

    let username = target_user
        .username
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("User has no username".to_string()))?
        .to_string();

    let user_context = UserContext {
        user_id: target_user_id,
        username,
    };

    // Find the organization
    let org_group = find_org_group(&admin, &realm, &invite.org_id)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Keycloak error: {}", e)))?
        .ok_or_else(|| ABError::NotFound(invite.org_id.clone()))?;

    let org_group_id = org_group
        .id
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("Group has no ID".to_string()))?
        .to_string();

    let org_context = OrgContext {
        org_id: invite.org_id.clone(),
        group_id: org_group_id,
    };

    // Convert InviteRole to role string
    let role_name = match invite.role {
        InviteRole::Admin => "admin",
        InviteRole::Write => "write",
        InviteRole::Read => "read",
    };

    // 2. Update invite status to Accepted
    update_invite_status(&state.db_pool, invite.id, InviteStatus::Accepted).await?;

    info!("Updated invite status to accepted for user {}", user_email);

    // 3. Add user to organization with specified role
    add_user_with_transaction(&admin, &realm, &org_context, &user_context, role_name)
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    info!(
        "Successfully added user {} to organization {} with role {}",
        user_email, invite.org_id, role_name
    );

    Ok(Json(AcceptInviteResponse {
        success: true,
        message: format!(
            "Successfully joined organization {} as {}",
            invite.org_id, role_name
        ),
        organization: invite.org_id,
        role: role_name.to_string(),
    }))
}
