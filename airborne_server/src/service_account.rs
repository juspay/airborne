pub mod types;

use actix_web::{
    delete, get, post,
    web::{self, Json, ReqData},
    HttpMessage, HttpRequest, Scope,
};
use airborne_authz_macros::authz;
use chrono::Utc;
use diesel::prelude::*;
use log::info;

use crate::{
    middleware::auth::{require_scope_name, AuthResponse},
    run_blocking,
    service_account::types::*,
    types as airborne_types,
    types::{ABError, AppState, ListResponse},
    utils::{
        db::{
            models::ServiceAccountEntry,
            schema::hyperotaserver::service_accounts::{
                client_id as sa_client_id, organisation as sa_org, table as service_accounts_table,
            },
        },
        encryption::generate_random_key,
    },
};

const MAX_SERVICE_ACCOUNT_NAME_LENGTH: usize = 50;
const SERVICE_ACCOUNT_EMAIL_DOMAIN: &str = "service-account.airborne.juspay.in";

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_service_account)
        .service(list_service_accounts)
        .service(delete_service_account)
        .service(rotate_service_account)
}

fn validate_service_account_name(name: &str) -> airborne_types::Result<String> {
    let trimmed = name.trim().to_ascii_lowercase();

    if trimmed.is_empty() {
        return Err(ABError::BadRequest(
            "Service account name cannot be empty".to_string(),
        ));
    }

    if trimmed.len() > MAX_SERVICE_ACCOUNT_NAME_LENGTH {
        return Err(ABError::BadRequest(
            "Service account name is too long".to_string(),
        ));
    }

    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(ABError::BadRequest(
            "Service account name can only contain alphanumeric characters, hyphens, and underscores"
                .to_string(),
        ));
    }

    Ok(trimmed)
}

fn build_service_account_email(name: &str, organisation: &str) -> String {
    let org_sanitized = organisation.trim().to_ascii_lowercase().replace(' ', "-");
    format!(
        "{}.{}@{}",
        name, org_sanitized, SERVICE_ACCOUNT_EMAIL_DOMAIN
    )
}

async fn generate_random_password() -> airborne_types::Result<String> {
    generate_random_key().await
}

async fn get_org_context(req: &HttpRequest) -> airborne_types::Result<(String, AuthResponse)> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    let org_name = require_scope_name(auth.organisation.clone(), "organisation")?;
    Ok((org_name, auth))
}

#[authz(
    resource = "service_account",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = []
)]
#[post("")]
async fn create_service_account(
    req: HttpRequest,
    body: Json<CreateServiceAccountRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateServiceAccountResponse>> {
    if !state.authn_provider.supports_service_accounts() {
        return Err(ABError::BadRequest(
            "Service accounts are not supported for configured AuthN provider".to_string(),
        ));
    }

    let (organisation, auth) = get_org_context(&req).await?;
    let body = body.into_inner();

    let name = validate_service_account_name(&body.name)?;
    let email = build_service_account_email(&name, &organisation);
    let password = generate_random_password().await?;

    // Create user in OIDC provider and get offline refresh token
    let token = state
        .authn_provider
        .create_service_account_user(state.get_ref(), &name, &email, &password)
        .await?;

    // The refresh token IS the client_secret — nothing stored in DB
    let client_secret = token.refresh_token;

    let client_uid = uuid::Uuid::new_v4();
    let entry = ServiceAccountEntry {
        client_id: client_uid,
        name: name.clone(),
        email: email.clone(),
        description: body.description,
        organisation: organisation.clone(),
        created_by: auth.sub.clone(),
        created_at: Utc::now(),
    };

    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::insert_into(service_accounts_table)
            .values(&entry)
            .execute(&mut conn)
            .map_err(|e| {
                log::error!("[CREATE SERVICE ACCOUNT] DB insert failed: {}", e);
                ABError::InternalServerError(format!("Failed to create service account: {}", e))
            })?;
        Ok(())
    })?;

    // Add service account as org member with requested role
    state
        .authz_provider
        .add_organisation_user(
            state.get_ref(),
            &auth.sub,
            &organisation,
            &email,
            &body.role,
        )
        .await?;

    info!(
        "Service account '{}' created in org '{}' by '{}'",
        name, organisation, auth.sub
    );

    Ok(Json(CreateServiceAccountResponse {
        client_id: client_uid,
        client_secret,
        email,
        name,
    }))
}

#[authz(
    resource = "service_account",
    action = "read",
    org_roles = ["owner", "admin"],
    app_roles = []
)]
#[get("")]
async fn list_service_accounts(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListResponse<Vec<ServiceAccountListEntry>>>> {
    let (organisation, _auth) = get_org_context(&req).await?;

    let pool = state.db_pool.clone();
    let entries = run_blocking!({
        let mut conn = pool.get()?;
        service_accounts_table
            .filter(sa_org.eq(&organisation))
            .load::<ServiceAccountEntry>(&mut conn)
            .map_err(|e| {
                log::error!("[LIST SERVICE ACCOUNTS] DB fetch failed: {}", e);
                ABError::InternalServerError(format!("Failed to list service accounts: {}", e))
            })
    })?;

    let data = entries
        .into_iter()
        .map(|entry| ServiceAccountListEntry {
            client_id: entry.client_id,
            name: entry.name,
            email: entry.email,
            description: entry.description,
            created_by: entry.created_by,
            created_at: entry.created_at,
        })
        .collect();

    Ok(Json(ListResponse { data }))
}

#[authz(
    resource = "service_account",
    action = "delete",
    org_roles = ["owner", "admin"],
    app_roles = []
)]
#[delete("/{client_id}")]
async fn delete_service_account(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DeleteServiceAccountResponse>> {
    let (organisation, auth) = get_org_context(&req).await?;
    let target_client_id = path.into_inner();

    // Load service account from DB
    let pool = state.db_pool.clone();
    let org_filter = organisation.clone();
    let entry = run_blocking!({
        let mut conn = pool.get()?;
        service_accounts_table
            .filter(sa_client_id.eq(&target_client_id))
            .filter(sa_org.eq(&org_filter))
            .first::<ServiceAccountEntry>(&mut conn)
            .map_err(|_| ABError::NotFound("Service account not found".to_string()))
    })?;

    // Remove from AuthZ memberships
    let _ = state
        .authz_provider
        .remove_organisation_user(state.get_ref(), &auth.sub, &organisation, &entry.email)
        .await;

    // Delete user from OIDC provider (best effort — invalidates all tokens)
    let _ = state
        .authn_provider
        .delete_user(state.get_ref(), &entry.name)
        .await;

    // Delete from database
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::delete(service_accounts_table.filter(sa_client_id.eq(&target_client_id)))
            .execute(&mut conn)
            .map_err(|e| {
                log::error!("[DELETE SERVICE ACCOUNT] DB delete failed: {}", e);
                ABError::InternalServerError(format!("Failed to delete service account: {}", e))
            })?;
        Ok(())
    })?;

    info!(
        "Service account '{}' deleted from org '{}' by '{}'",
        entry.name, organisation, auth.sub
    );

    Ok(Json(DeleteServiceAccountResponse { success: true }))
}

#[authz(
    resource = "service_account",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = []
)]
#[post("/{client_id}/rotate")]
async fn rotate_service_account(
    req: HttpRequest,
    path: web::Path<uuid::Uuid>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<RotateServiceAccountResponse>> {
    if !state.authn_provider.supports_service_accounts() {
        return Err(ABError::BadRequest(
            "Service accounts are not supported for configured AuthN provider".to_string(),
        ));
    }

    let (organisation, _auth) = get_org_context(&req).await?;
    let target_client_id = path.into_inner();

    // Load service account from DB
    let pool = state.db_pool.clone();
    let org_filter = organisation.clone();
    let entry = run_blocking!({
        let mut conn = pool.get()?;
        service_accounts_table
            .filter(sa_client_id.eq(&target_client_id))
            .filter(sa_org.eq(&org_filter))
            .first::<ServiceAccountEntry>(&mut conn)
            .map_err(|_| ABError::NotFound("Service account not found".to_string()))
    })?;

    // Delete and recreate the OIDC user with new credentials
    let password = generate_random_password().await?;
    let _ = state
        .authn_provider
        .delete_user(state.get_ref(), &entry.name)
        .await;

    let token = state
        .authn_provider
        .create_service_account_user(state.get_ref(), &entry.name, &entry.email, &password)
        .await?;

    // New refresh token is the new client_secret
    let client_secret = token.refresh_token;

    info!(
        "Service account '{}' credentials rotated in org '{}'",
        entry.name, organisation
    );

    Ok(Json(RotateServiceAccountResponse {
        client_id: target_client_id,
        client_secret,
    }))
}
