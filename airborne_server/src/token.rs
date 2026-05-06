pub mod types;

use crate::{
    middleware::auth::{require_org_and_app, Auth, AuthResponse},
    run_blocking,
    token::types::*,
    types as airborne_types,
    types::{ABError, AppState, ListResponse},
    user::{exchange_code_for_token, types::OAuthLoginRequest, types::UserToken},
    utils::{
        db::{
            models::UserCredentialsEntry,
            schema::hyperotaserver::{
                service_accounts::{client_id as sa_uid, table as service_accounts_table},
                user_credentials::{
                    application as cred_app, client_id as uid, created_at,
                    organisation as cred_org, table as user_credentials_table, username,
                },
            },
        },
        encryption::{decrypt_string, encrypt_string, generate_random_key},
    },
};
use airborne_authz_macros::authz;

use actix_web::{
    delete, get, post,
    web::{self, Json, ReqData},
    HttpRequest, Scope,
};
use chrono::{DateTime, Utc};
use diesel::prelude::*;

pub fn add_scopes(path: &str) -> Scope {
    Scope::new(path).service(issue_token).service(
        Scope::new("")
            .wrap(Auth)
            .service(create_token)
            .service(create_token_oauth)
            .service(list_tokens)
            .service(delete_token),
    )
}

#[authz(
    resource = "token",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("")]
async fn create_token(
    req: Json<UserCredentials>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PersonalAccessToken>> {
    state.authn_provider.ensure_password_login_supported()?;

    let key = generate_random_key().await?;
    let req = req.into_inner();
    let auth_response = auth_response.into_inner();

    if auth_response.username != req.name {
        log::error!("[CREATE TOKEN] Username mismatch detected");
        return Err(ABError::Unauthorized("Username mismatch".to_string()));
    }

    let (org_name, app_name) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let login_credentials = crate::user::types::UserCredentials {
        name: req.name.clone(),
        password: req.password.clone(),
        first_name: None,
        last_name: None,
        email: None,
    };
    let token = state
        .authn_provider
        .login_with_password_for_pat(state.get_ref(), &login_credentials)
        .await?;

    let client_uid = uuid::Uuid::new_v4();
    let encrypted_refresh_token = encrypt_string(&token.refresh_token.clone(), &key).await?;

    let new_cred = UserCredentialsEntry {
        client_id: client_uid,
        username: req.name.clone(),
        password: encrypted_refresh_token,
        organisation: org_name.clone(),
        application: app_name.clone(),
        created_at: Utc::now(),
    };
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::insert_into(user_credentials_table)
            .values(&new_cred)
            .execute(&mut conn)
            .map_err(|e: diesel::result::Error| {
                log::error!("[CREATE TOKEN] DB insert failed: {}", e);
                ABError::InternalServerError(format!("DB insert failed: {}", e))
            })?;
        Ok(())
    })?;

    Ok(Json(PersonalAccessToken {
        client_id: client_uid,
        client_secret: key,
    }))
}

#[authz(
    resource = "token",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("/oauth")]
async fn create_token_oauth(
    req: HttpRequest,
    body: Json<OAuthLoginRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<PersonalAccessToken>, ABError> {
    state
        .authn_provider
        .ensure_oidc_login_enabled(state.get_ref())?;

    let oauth_req = body.into_inner();

    let auth_response = auth_response.into_inner();

    let (org_name, app_name) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let token_response =
        match exchange_code_for_token(&oauth_req.code, oauth_req.state.as_deref(), &req, &state)
            .await
        {
            Ok(response) => response,
            Err(e) => {
                log::error!("[CREATE TOKEN OAUTH] Token exchange failed: {:?}", e);
                return Err(e);
            }
        };

    let token_data = state
        .authn_provider
        .verify_access_token(state.get_ref(), &token_response.access_token)
        .await
        .map_err(|e| {
            log::error!("[CREATE TOKEN OAUTH] Token decode failed: {:?}", e);
            ABError::BadRequest("Invalid token".to_string())
        })?;

    let oauth_subject = state
        .authz_provider
        .subject_from_claims(&token_data.claims)?;

    if oauth_subject != auth_response.sub {
        log::error!("[CREATE TOKEN OAUTH] Subject mismatch");
        return Err(ABError::Unauthorized(
            "OAuth account does not match your logged-in account".to_string(),
        ));
    }

    let refresh_token = token_response.refresh_token.ok_or_else(|| {
        log::error!("[CREATE TOKEN OAUTH] Missing refresh token");
        ABError::InternalServerError("Missing refresh token".to_string())
    })?;

    let key = generate_random_key().await?;
    let client_uid = uuid::Uuid::new_v4();
    let encrypted_pass = encrypt_string(&refresh_token, &key).await?;

    let new_cred = UserCredentialsEntry {
        client_id: client_uid,
        username: auth_response.username,
        password: encrypted_pass,
        organisation: org_name.clone(),
        application: app_name.clone(),
        created_at: Utc::now(),
    };

    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::insert_into(user_credentials_table)
            .values(&new_cred)
            .execute(&mut conn)
            .map_err(|e: diesel::result::Error| {
                log::error!("[CREATE TOKEN OAUTH] DB insert failed: {}", e);
                ABError::InternalServerError(format!("DB insert failed: {}", e))
            })?;
        Ok(())
    })?;

    Ok(Json(PersonalAccessToken {
        client_id: client_uid,
        client_secret: key,
    }))
}

#[authz(
    resource = "token",
    action = "delete",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[delete("{client_id}")]
async fn delete_token(
    client_id: web::Path<uuid::Uuid>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DeleteTokenResponse>> {
    let auth_response = auth_response.into_inner();
    let (_organisation, _application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::delete(user_credentials_table.filter(uid.eq(*client_id)))
            .execute(&mut conn)
            .map_err(|e| {
                log::error!("[DELETE TOKEN] Failed to delete token from database: {}", e);
                ABError::InternalServerError(format!("Failed to delete user credentials: {}", e))
            })?;
        Ok(())
    })?;

    Ok(Json(DeleteTokenResponse { success: true }))
}

#[authz(
    resource = "token",
    action = "read",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[get("list")]
async fn list_tokens(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListResponse<Vec<TokenListEntry>>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let pool = state.db_pool.clone();
    let result = run_blocking!({
        let mut conn = pool.get()?;
        let results = user_credentials_table
            .filter(username.eq(&auth_response.username))
            .filter(cred_org.eq(&organisation))
            .filter(cred_app.eq(&application))
            .select((uid, created_at))
            .load::<(uuid::Uuid, DateTime<Utc>)>(&mut conn)
            .map_err(|e| {
                log::error!("[LIST TOKENS] DB fetch failed: {}", e);
                ABError::InternalServerError(format!("DB fetch failed: {}", e))
            })?;
        Ok(results)
    })?;
    let tokens = result
        .into_iter()
        .map(|(id, created)| TokenListEntry {
            client_id: id,
            created_at: created,
        })
        .collect::<Vec<TokenListEntry>>();

    Ok(Json(ListResponse { data: tokens }))
}

#[post("issue")]
async fn issue_token(
    req: Json<PersonalAccessToken>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserToken>> {
    log::info!("[ISSUE TOKEN] Starting token issuance");

    let pool = state.db_pool.clone();
    let client_id = req.client_id;

    // Try user_credentials first (PAT — needs decryption),
    // then fall back to service_accounts (client_secret IS the refresh token).
    let refresh_token = {
        let pat_result = run_blocking!({
            let mut conn = pool.get()?;
            user_credentials_table
                .filter(uid.eq(&client_id))
                .first::<UserCredentialsEntry>(&mut conn)
                .optional()
                .map_err(|e| {
                    log::error!("[ISSUE TOKEN] DB error: {}", e);
                    ABError::InternalServerError("Database error".to_string())
                })
        })?;

        if let Some(user) = pat_result {
            // PAT: decrypt the stored refresh token using client_secret as key
            decrypt_string(&user.password, &req.client_secret)
                .await
                .map_err(|e| {
                    log::error!("[ISSUE TOKEN] Failed to decrypt refresh token: {:?}", e);
                    ABError::Unauthorized("Invalid credentials".to_string())
                })?
        } else {
            // Check if it's a service account — client_secret is the refresh token directly
            let pool2 = state.db_pool.clone();
            let sa_exists = run_blocking!({
                let mut conn = pool2.get()?;
                service_accounts_table
                    .filter(sa_uid.eq(&client_id))
                    .count()
                    .get_result::<i64>(&mut conn)
                    .map_err(|e| {
                        log::error!("[ISSUE TOKEN] DB error: {}", e);
                        ABError::InternalServerError("Database error".to_string())
                    })
            })?;

            if sa_exists > 0 {
                req.client_secret.clone()
            } else {
                log::error!(
                    "[ISSUE TOKEN] No credentials found for client_id: {}",
                    client_id
                );
                return Err(ABError::Unauthorized("Invalid credentials".to_string()));
            }
        }
    };

    log::info!("[ISSUE TOKEN] Credentials resolved successfully");

    let token = state
        .authn_provider
        .refresh_access_token(state.get_ref(), &refresh_token)
        .await?;
    log::info!("[ISSUE TOKEN] Token issued successfully");
    Ok(Json(token))
}
