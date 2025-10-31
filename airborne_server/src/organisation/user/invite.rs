use actix_web::{
    get, post,
    web::{self, Json, Path, Query},
    HttpMessage, HttpRequest, Scope,
};
use chrono::Utc;
use diesel::{
    dsl::sql,
    prelude::*,
    sql_types::{Bool, Text},
};
use keycloak::KeycloakAdmin;
use log::{debug, info};
use uuid::Uuid;

use crate::{
    middleware::auth::{AuthResponse, ADMIN, WRITE},
    organisation::{
        application::{self, user::find_application},
        types::OrgError,
        user::{
            find_organization, get_org_context,
            invite::types::*,
            transaction::add_user_with_transaction,
            types::{UserOperationResponse, UserRequest},
            utils::validate_access_level,
            AccessLvl, ApplicationAccess, OrgContext, UserContext,
        },
    },
    run_blocking,
    types::{self as airborne_types, ABError, AppState},
    utils::{
        db::{
            models::{InviteRole, InviteStatus, OrganisationInviteEntry},
            schema::hyperotaserver::organisation_invites::{self},
            DbPool,
        },
        keycloak::{find_org_group, find_user_by_username, prepare_user_action},
        mail::Mail,
    },
};

mod types;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(send_invitation)
        .service(accept_invite)
        .service(decline_invite)
        .service(list_invites)
        .service(revoke_invite)
}

pub fn add_public_routes() -> Scope {
    Scope::new("").service(validate_invite)
}

/// Check if there's an existing pending invite for the same org and email
async fn find_existing_pending_invite(
    pool: &DbPool,
    org_id: &str,
    email: &str,
    role: &InviteRole,
) -> airborne_types::Result<Option<OrganisationInviteEntry>> {
    let pool = pool.clone();
    let org_id = org_id.to_string();
    let email = email.to_string();
    let role = role.clone();

    run_blocking!({
        let mut conn = pool.get()?;

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
async fn update_existing_invite(
    pool: &DbPool,
    invite_id: Uuid,
    new_token: String,
    apps: Vec<ApplicationAccess>,
) -> airborne_types::Result<OrganisationInviteEntry> {
    let pool = pool.clone();

    run_blocking!({
        let mut conn = pool.get()?;

        Ok(diesel::update(organisation_invites::table.find(invite_id))
            .set((
                organisation_invites::token.eq(new_token),
                organisation_invites::created_at.eq(Utc::now()),
                organisation_invites::applications
                    .eq(serde_json::to_value(apps).unwrap_or_default()),
            ))
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })
}

/// Insert a new invite into the database
async fn create_new_invite(
    pool: &DbPool,
    org_id: String,
    apps: Vec<ApplicationAccess>,
    email: String,
    role: InviteRole,
    token: String,
) -> airborne_types::Result<OrganisationInviteEntry> {
    let pool = pool.clone();

    run_blocking!({
        let mut conn = pool.get()?;

        let new_invite = OrganisationInviteEntry {
            id: Uuid::new_v4(),
            org_id,
            email,
            role,
            token,
            status: crate::utils::db::models::InviteStatus::Pending,
            created_at: Utc::now(),
            applications: serde_json::to_value(apps).unwrap_or_default(),
        };

        Ok(diesel::insert_into(organisation_invites::table)
            .values(&new_invite)
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })
}

/// Generate a secure random token for invite links
fn generate_invite_token() -> String {
    use rand::{distributions::Alphanumeric, Rng};

    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}

/// Find invite by token
async fn find_invite_by_token(
    pool: &DbPool,
    token: &str,
) -> airborne_types::Result<Option<OrganisationInviteEntry>> {
    let pool = pool.clone();
    let token = token.to_string();

    run_blocking!({
        let mut conn = pool.get()?;

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
) -> airborne_types::Result<OrganisationInviteEntry> {
    let pool = pool.clone();

    run_blocking!({
        let mut conn = pool.get()?;

        Ok(diesel::update(organisation_invites::table.find(invite_id))
            .set(organisation_invites::status.eq(status))
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })
}

/// List invites for an organization with search and pagination
pub async fn list_organization_invites(
    pool: &DbPool,
    org_id: &str,
    search_term: Option<&str>,
    status_filter: Option<InviteStatus>,
    page: u32,
    per_page: u32,
) -> airborne_types::Result<(Vec<OrganisationInviteEntry>, i64)> {
    let pool = pool.clone();
    let org_id = org_id.to_string();
    let search_term = search_term.map(|s| s.to_string());

    let status_filter = status_filter.to_owned();
    let search_pattern = if let Some(search) = &search_term {
        debug!("Searching invites with term: {}", search);
        Some(format!("%{}%", search.to_lowercase()))
    } else {
        None
    };
    run_blocking!({
        let build_query = |org_id: String| {
            let mut q = organisation_invites::table
                .filter(organisation_invites::org_id.eq(org_id))
                .into_boxed();

            if let Some(search) = &search_pattern {
                q =
                    q.filter(organisation_invites::email.ilike(search.clone()).or(
                        sql::<Bool>("LOWER(role::text) LIKE ").bind::<Text, _>(search.clone()),
                    ));
            }

            if let Some(status) = status_filter.as_ref() {
                q = q.filter(organisation_invites::status.eq(status));
            }

            q
        };

        let mut conn = pool.get()?;

        let total_count: i64 = build_query(org_id.clone()).count().get_result(&mut conn)?;

        let invites = build_query(org_id.clone())
            .order(organisation_invites::created_at.desc())
            .limit(per_page as i64)
            .offset(((page - 1) * per_page) as i64)
            .load::<OrganisationInviteEntry>(&mut conn)?;

        Ok((invites, total_count))
    })
}

#[post("/{invite_id}/accept")]
pub async fn accept_invite(
    req: HttpRequest,
    body: Json<AcceptInviteRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<InviteRSVPResponse>> {
    check_invite_feature_enabled(&state.env)?;
    let request = body.into_inner();

    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    let user_email = auth.username.clone();

    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    rsvp_invitation(
        admin,
        realm,
        &state.db_pool,
        &request.token,
        &user_email,
        InviteAction::Accepted,
    )
    .await
    .map(Json)
}

#[post("/{invite_id}/decline")]
pub async fn decline_invite(
    req: HttpRequest,
    body: Json<DeclineInviteRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<InviteRSVPResponse>> {
    check_invite_feature_enabled(&state.env)?;
    let request = body.into_inner();

    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    let user_email = auth.username.clone();

    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    rsvp_invitation(
        admin,
        realm,
        &state.db_pool,
        &request.token,
        &user_email,
        InviteAction::Declined,
    )
    .await
    .map(Json)
}

pub async fn rsvp_invitation(
    admin: KeycloakAdmin,
    realm: String,
    db_pool: &DbPool,
    token: &str,
    user_email: &str,
    action: InviteAction,
) -> airborne_types::Result<InviteRSVPResponse> {
    debug!("Processing invite RSVP");

    let invite = find_invite_by_token(db_pool, token)
        .await?
        .ok_or_else(|| ABError::BadRequest("Invalid or expired invite token".to_string()))?;

    if invite.email != user_email {
        return Err(ABError::Unauthorized(
            "Invite token does not match authenticated user".to_string(),
        ));
    }

    let invite_age = Utc::now().signed_duration_since(invite.created_at);
    if invite_age.num_days() > 7 {
        return Err(ABError::BadRequest("Invite token has expired".to_string()));
    }

    debug!(
        "Found valid invite for user to join org {} with role {:?}",
        invite.org_id, invite.role
    );

    let target_user = find_user_by_username(&admin, &realm, user_email)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Keycloak error: {}", e)))?
        .ok_or_else(|| ABError::NotFound(user_email.to_string()))?;

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

    let role_name = match invite.role {
        InviteRole::Admin => "admin",
        InviteRole::Write => "write",
        InviteRole::Read => "read",
    };

    if action == InviteAction::Accepted {
        debug!(
            "Adding user to organization {} with role {}",
            invite.org_id, role_name
        );
        update_invite_status(db_pool, invite.id, InviteStatus::Accepted).await?;

        if let Err(e) =
            add_user_with_transaction(&admin, &realm, &org_context, &user_context, role_name).await
        {
            // Revert the invite status back to pending on failure
            update_invite_status(db_pool, invite.id, InviteStatus::Pending).await?;
            info!(
                "Failed to add user to organization {}: {}, reverting invitation status",
                invite.org_id, e
            );
            return Err(ABError::InternalServerError(e.to_string()));
        }

        let req_applications: Vec<ApplicationAccess> = invite
            .applications
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|app_value| serde_json::from_value(app_value.clone()).ok())
            .collect();

        for app_access in req_applications {
            let app_context =
                find_application(&admin, &realm, &org_context.org_id, &app_access.name)
                    .await
                    .map_err(|e| {
                        ABError::NotFound(format!(
                            "Failed to find application {}: {}",
                            app_access.name, e
                        ))
                    })?;

            application::user::add_user_with_transaction(
                &admin,
                &realm,
                &app_context,
                &user_context,
                match app_access.level {
                    AccessLvl::Admin => "admin",
                    AccessLvl::Write => "write",
                    AccessLvl::Read => "read",
                },
            )
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!(
                    "Failed to add user to application {}: {}",
                    app_access.name, e
                ))
            })?;
        }

        info!("User accepted invite to organization {}", invite.org_id);
    } else {
        debug!("User is declining invite to organization {}", invite.org_id);
        update_invite_status(db_pool, invite.id, InviteStatus::Declined).await?;

        info!("User declined invite to organization {}", invite.org_id);
    }

    Ok(InviteRSVPResponse {
        success: true,
        message: if action == InviteAction::Accepted {
            format!(
                "Successfully joined organization {} as {}",
                invite.org_id, role_name
            )
        } else {
            format!("Declined invitation to organization {}", invite.org_id)
        },
        organization: invite.org_id,
        role: role_name.to_string(),
        action,
    })
}

#[post("/validate")]
pub async fn validate_invite(
    body: Json<ValidateInviteRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ValidateInviteResponse>> {
    check_invite_feature_enabled(&state.env)?;

    let request = body.into_inner();

    let invite = find_invite_by_token(&state.db_pool, &request.token)
        .await?
        .ok_or_else(|| ABError::NotFound("Invalid or expired invite token".to_string()))?;

    let invite_age = Utc::now().signed_duration_since(invite.created_at);
    if invite_age.num_days() > 7 {
        return Err(ABError::BadRequest("Invite token has expired".to_string()));
    }

    let role_str = match invite.role {
        InviteRole::Admin => "admin",
        InviteRole::Write => "write",
        InviteRole::Read => "read",
    };

    let status_str = match invite.status {
        InviteStatus::Pending => "pending",
        InviteStatus::Accepted => "accepted",
        InviteStatus::Declined => "declined",
        InviteStatus::Expired => "expired",
    };

    Ok(Json(ValidateInviteResponse {
        invite_id: invite.id.to_string(),
        valid: true,
        email: invite.email,
        organization: invite.org_id,
        role: role_str.to_string(),
        status: status_str.to_string(),
        created_at: invite.created_at.to_rfc3339(),
        inviter: None,
    }))
}

#[get("/list")]
pub async fn list_invites(
    req: HttpRequest,
    query: Query<ListInvitesQuery>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListInvitesResponse>> {
    check_invite_feature_enabled(&state.env)?;

    // Get organization context and validate requester's permissions
    let (organisation, _) = get_org_context(&req, WRITE, "list invites")
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let query = query.into_inner();

    // Validate and set pagination defaults
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(10).clamp(1, 100);

    // Parse status filter if provided
    let status_filter = if let Some(status_str) = &query.status {
        match status_str.to_lowercase().as_str() {
            "pending" => Some(InviteStatus::Pending),
            "accepted" => Some(InviteStatus::Accepted),
            "declined" => Some(InviteStatus::Declined),
            "expired" => Some(InviteStatus::Expired),
            _ => {
                return Err(ABError::BadRequest(format!(
                    "Invalid status filter: {}",
                    status_str
                )))
            }
        }
    } else {
        None
    };

    debug!(
        "Listing invites for org {} with search: {:?}, status: {:?}, page: {}, per_page: {}",
        organisation, query.search, query.status, page, per_page
    );

    // Get invites from database
    let (invites, total_count) = list_organization_invites(
        &state.db_pool,
        &organisation,
        query.search.as_deref(),
        status_filter,
        page,
        per_page,
    )
    .await?;

    // Convert to response format
    let invite_items: Vec<InviteListItem> = invites
        .into_iter()
        .map(|invite| {
            let role_str = match invite.role {
                InviteRole::Admin => "admin",
                InviteRole::Write => "write",
                InviteRole::Read => "read",
            };

            let status_str = match invite.status {
                InviteStatus::Pending => "pending",
                InviteStatus::Accepted => "accepted",
                InviteStatus::Declined => "declined",
                InviteStatus::Expired => "expired",
            };

            InviteListItem {
                id: invite.id.to_string(),
                email: invite.email,
                role: role_str.to_string(),
                status: status_str.to_string(),
                created_at: invite.created_at.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            }
        })
        .collect();

    // Calculate pagination info
    let total_pages = ((total_count as f64) / (per_page as f64)).ceil() as u32;

    let pagination = PaginationInfo {
        current_page: page,
        per_page,
        total_items: total_count,
        total_pages,
    };

    debug!(
        "Found {} invites for organization {} (page {} of {})",
        invite_items.len(),
        organisation,
        page,
        total_pages
    );

    Ok(Json(ListInvitesResponse {
        invites: invite_items,
        pagination,
    }))
}

#[post("/{invite_id}/revoke")]
pub async fn revoke_invite(
    req: HttpRequest,
    invite_id: Path<String>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<OrganisationInviteEntry>> {
    check_invite_feature_enabled(&state.env)?;

    let (organisation, _) = get_org_context(&req, WRITE, "add user")
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let pool = state.db_pool.clone();
    let invite_id = Uuid::parse_str(&invite_id.into_inner())
        .map_err(|e| ABError::BadRequest(format!("Invalid invite ID: {}", e)))?;
    let invite = run_blocking!({
        let mut conn = pool.get()?;

        let invite = organisation_invites::table
            .find(invite_id)
            .first::<OrganisationInviteEntry>(&mut conn)?;

        if invite.org_id != organisation {
            return Err(ABError::Forbidden(
                "You do not have permission to revoke this invite".to_string(),
            ));
        }

        Ok(diesel::update(organisation_invites::table.find(invite_id))
            .set(organisation_invites::status.eq(InviteStatus::Expired))
            .get_result::<OrganisationInviteEntry>(&mut conn)?)
    })?;

    Ok(Json(invite))
}

#[post("")]
async fn send_invitation(
    req: HttpRequest,
    body: Json<UserRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let body = body.into_inner();

    check_invite_feature_enabled(&state.env)?;

    let mailer = state.mailer.as_ref().ok_or_else(|| {
        ABError::InternalServerError(
            "Mailer not configured, check your SMTP configuration".to_string(),
        )
    })?;

    let tera = state.tera.as_ref().ok_or_else(|| {
        ABError::InternalServerError("Template engine not configured".to_string())
    })?;

    // Get organization context and validate requester's permissions
    let (organisation, auth) = get_org_context(&req, WRITE, "add user").await?;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone())
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    // Validate access level
    let (role_name, role_level) = validate_access_level(&body.access.as_str())?;

    // Additional permission check for admin/owner assignments
    if role_level >= ADMIN.access {
        if let Some(org_access) = &auth.organisation {
            if org_access.level < ADMIN.access {
                return Err(OrgError::PermissionDenied(
                    "Admin permission required to assign admin or owner roles".into(),
                )
                .into());
            }
        } else {
            return Err(ABError::Forbidden("No organization access".to_string()));
        }
    }

    let _ = find_organization(&admin, &realm, &organisation).await?;

    let invite_role = body.access.to_invite_role();

    // Check if there's an existing pending invite for same org, email, and role
    match find_existing_pending_invite(&state.db_pool, &organisation, &body.user, &invite_role)
        .await
    {
        Ok(Some(existing_invite)) => {
            // Update existing invite with new token and timestamp
            let new_token = generate_invite_token();
            match update_existing_invite(
                &state.db_pool,
                existing_invite.id,
                new_token.clone(),
                body.applications.unwrap_or_default(),
            )
            .await
            {
                Ok(_updated_invite) => {
                    info!(
                        "Updated existing invite for {} in org {}",
                        &body.user, &organisation
                    );

                    let invitation_url =
                        format!("{}/invitation/{}", &state.env.public_url, &new_token);

                    // Send email with updated invite
                    let mut context = tera::Context::new();
                    context.insert("name", &body.user);
                    context.insert("organization", &organisation);
                    context.insert("role", &role_name);
                    context.insert("invitation_url", &invitation_url);

                    let mail = Mail::new(
                        mailer,
                        tera,
                        context,
                        body.user.clone(),
                        "You're invited to join an Airborne organization".to_string(),
                        "org_invitation.txt".to_string(),
                        Some("org_invitation.html".to_string()),
                    );

                    mail.send().await?;

                    Ok(Json(UserOperationResponse {
                        user: body.user,
                        success: true,
                        operation: "invite_updated".to_string(),
                    }))
                }
                Err(e) => Err(e),
            }
        }
        Ok(None) => {
            // No existing invite - create new one
            let new_token = generate_invite_token();
            match create_new_invite(
                &state.db_pool,
                organisation.clone(),
                body.applications.unwrap_or_default(),
                body.user.clone(),
                invite_role,
                new_token.clone(),
            )
            .await
            {
                Ok(_new_invite) => {
                    info!(
                        "Created new invite for {} in org {}",
                        &body.user, &organisation
                    );

                    let invitation_url =
                        format!("{}/invitation/{}", &state.env.public_url, &new_token);

                    // Send email with new invite
                    let mut context = tera::Context::new();
                    context.insert("name", &body.user);
                    context.insert("organization", &organisation);
                    context.insert("role", &role_name);
                    context.insert("invitation_url", &invitation_url);

                    let mail = Mail::new(
                        mailer,
                        tera,
                        context,
                        body.user.clone(),
                        "You're invited to join an Airborne organization".to_string(),
                        "org_invitation.txt".to_string(),
                        Some("org_invitation.html".to_string()),
                    );

                    if let Err(e) = mail.send().await {
                        info!("Failed to send invitation email to {}: {}", &body.user, e);
                        // Remove this invite from db if email sending fails
                        let _ = run_blocking!({
                            let mut conn = state.db_pool.get()?;

                            Ok(
                                diesel::delete(organisation_invites::table.find(_new_invite.id))
                                    .execute(&mut conn)?,
                            )
                        });
                        return Err(e);
                    }

                    Ok(Json(UserOperationResponse {
                        user: body.user,
                        success: true,
                        operation: "invite_created".to_string(),
                    }))
                }
                Err(e) => Err(e),
            }
        }
        Err(e) => Err(e),
    }
}

pub fn check_invite_feature_enabled(
    env: &airborne_types::Environment,
) -> airborne_types::Result<()> {
    if !env.enable_organisation_invite {
        return Err(ABError::Forbidden(
            "Organization invitations are disabled".to_string(),
        ));
    }
    Ok(())
}
