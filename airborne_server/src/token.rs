pub mod types;

use crate::{
    middleware::auth::{validate_user, Auth, AuthResponse, ADMIN, READ},
    run_blocking,
    token::types::*,
    types as airborne_types,
    types::{ABError, AppState, ListResponse},
    user::{exchange_code_for_token, types::OAuthLoginRequest, types::UserToken},
    utils::{
        db::{
            models::UserCredentialsEntry,
            schema::hyperotaserver::user_credentials::{
                application as cred_app, client_id as uid, created_at, organisation as cred_org,
                table as user_credentials_table, username,
            },
        },
        encryption::{decrypt_string, encrypt_string, generate_random_key},
        keycloak::decode_jwt_token,
    },
};

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

#[post("")]
async fn create_token(
    req: Json<UserCredentials>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PersonalAccessToken>> {
    let key = generate_random_key().await?;
    let auth_response = auth_response.into_inner();

    if auth_response.username != req.name {
        log::error!("[CREATE TOKEN] Username mismatch detected");
        return Err(ABError::Unauthorized("Username mismatch".to_string()));
    }

    let (org_name, app_name) = match validate_user(auth_response.organisation.clone(), ADMIN) {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), ADMIN)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let url = state.env.keycloak_url.clone();
    let client_id = state.env.client_id.clone();
    let secret = state.env.secret.clone();
    let realm = state.env.realm.clone();
    let url = format!("{}/realms/{}/protocol/openid-connect/token", url, realm);
    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id),
        ("client_secret", secret),
        ("grant_type", "password".to_string()),
        ("username", req.name.clone()),
        ("password", req.password.clone()),
        ("scope", "offline_access".to_string()), // so that refresh token never expire
    ];

    let response = client.post(&url).form(&params).send().await.map_err(|e| {
        log::error!("[CREATE TOKEN] Keycloak request failed: {}", e);
        ABError::InternalServerError(e.to_string())
    })?;

    if response.status().is_success() {
        let token: UserToken = response.json().await.map_err(|e| {
            log::error!("[CREATE TOKEN] Failed to parse Keycloak response: {}", e);
            ABError::InternalServerError(e.to_string())
        })?;

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
    } else {
        log::error!("[CREATE TOKEN] Keycloak authentication failed: wrong password");
        Err(ABError::Forbidden("Invalid Credentials".to_string()))
    }
}

#[post("/oauth")]
async fn create_token_oauth(
    req: HttpRequest,
    body: Json<OAuthLoginRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<PersonalAccessToken>, ABError> {
    let oauth_req = body.into_inner();

    let auth_response = auth_response.into_inner();

    let (org_name, app_name) = match validate_user(auth_response.organisation.clone(), ADMIN) {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| {
                log::error!("[CREATE TOKEN OAUTH] Access denied: no application access");
                ABError::Unauthorized("No Access".to_string())
            })
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), ADMIN)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let token_response = match exchange_code_for_token(&oauth_req.code, &req, &state).await {
        Ok(response) => response,
        Err(e) => {
            log::error!("[CREATE TOKEN OAUTH] Token exchange failed: {:?}", e);
            return Err(e);
        }
    };

    let token_data = decode_jwt_token(
        &token_response.access_token,
        &state.env.keycloak_public_key,
        &state.env.client_id,
    )
    .map_err(|e| {
        log::error!("[CREATE TOKEN OAUTH] Token decode failed: {:?}", e);
        ABError::BadRequest("Invalid token".to_string())
    })?;

    let oauth_username = token_data.claims.preferred_username.ok_or_else(|| {
        log::error!("[CREATE TOKEN OAUTH] No username in OAuth token");
        ABError::Unauthorized("Invalid OAuth token".to_string())
    })?;

    if oauth_username != auth_response.username {
        log::error!("[CREATE TOKEN OAUTH] Username mismatch",);
        return Err(ABError::Unauthorized(
            "Google account does not match your logged-in account".to_string(),
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

#[delete("{client_id}")]
async fn delete_token(
    client_id: web::Path<uuid::Uuid>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DeleteTokenResponse>> {
    let auth_response = auth_response.into_inner();
    let (_organisation, _application) =
        match validate_user(auth_response.organisation.clone(), ADMIN) {
            Ok(org_name) => auth_response
                .application
                .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
                .map(|access| (org_name, access.name)),
            Err(_) => {
                validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
                    validate_user(auth_response.application.clone(), ADMIN)
                        .map(|app_name| (org_name, app_name))
                })
            }
        }?;
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

#[get("list")]
async fn list_tokens(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListResponse<Vec<TokenListEntry>>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), ADMIN)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let pool = state.db_pool.clone();
    let result = run_blocking!({
        let mut conn = pool.get()?;
        let results = user_credentials_table
            .filter(
                username
                    .eq(&auth_response.username)
                    .and(cred_org.eq(&organisation))
                    .and(cred_app.eq(&application)),
            )
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
    let pool = state.db_pool.clone();
    let client_id = req.client_id;
    let user = run_blocking!({
        let mut conn = pool.get()?;
        let user = user_credentials_table
            .filter(uid.eq(&client_id))
            .first::<UserCredentialsEntry>(&mut conn)
            .map_err(|e| {
                log::error!("[ISSUE TOKEN] Failed to load user credentials: {}", e);
                ABError::InternalServerError(format!("Failed to load user credentials: {}", e))
            })?;
        Ok(user)
    })?;

    let decrypted_refresh_token = decrypt_string(&user.password, &req.client_secret).await?;

    let url = state.env.keycloak_url.clone();
    let client_id = state.env.client_id.clone();
    let secret = state.env.secret.clone();
    let realm = state.env.realm.clone();
    let url = format!("{}/realms/{}/protocol/openid-connect/token", url, realm);
    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id),
        ("client_secret", secret),
        ("grant_type", "refresh_token".to_string()),
        ("refresh_token", decrypted_refresh_token),
    ];

    let response = client.post(&url).form(&params).send().await.map_err(|e| {
        log::error!("[ISSUE TOKEN] Keycloak request failed: {}", e);
        ABError::InternalServerError(e.to_string())
    })?;

    if response.status().is_success() {
        let token: UserToken = response.json().await.map_err(|e| {
            log::error!("[ISSUE TOKEN] Failed to parse Keycloak response: {}", e);
            ABError::InternalServerError(e.to_string())
        })?;
        Ok(Json(token))
    } else {
        log::error!("[ISSUE TOKEN] Keycloak authentication failed: invalid refresh token");
        Err(ABError::Unauthorized(
            "Login failed: Wrong Token".to_string(),
        ))
    }
}
