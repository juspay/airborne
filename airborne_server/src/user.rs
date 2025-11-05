// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use crate::{
    middleware::auth::{Auth, AuthResponse},
    organisation::{application::types::Application, Organisation},
    types as airborne_types,
    types::{ABError, AppState},
    user::types::*,
    utils::keycloak::{decode_jwt_token, get_token},
};
use actix_web::{
    get, post,
    web::{self, Json, Query},
    HttpRequest, Scope,
};
use keycloak::{
    types::{CredentialRepresentation, UserRepresentation},
    KeycloakAdmin,
};
use log::info;
use serde_json::json;
use std::collections::HashMap;

pub mod types;

pub fn add_routes(path: &str) -> Scope {
    web::scope(path)
        .service(create_user)
        .service(login)
        .service(oauth_login)
        .service(get_oauth_url)
        .service(oauth_signup)
        .service(Scope::new("").wrap(Auth).service(get_user))
}

/*
 * User DB Schema
 * User Id | User | Password
 * User Id : Unique Identifier for each user, Assigned by the system
 * User : Name of the user provided during account creation
 * Password : Password of the user provided during account creation
 */

/*
 * ACL DB Schema
 * ACL Id | ACL | ACL Level | ACL Owner
 * ACL Id : Unique Identifier for each ACL, Assigned by the system
 * ACL : access control list for this id
 * ACL Level : ACL is applicable for this level; Can be Originisation, Application, User, Server
 * ACL Owner : Id based on level in ACL Level column
 */

#[post("create")]
async fn create_user(
    req: Json<UserCredentials>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    info!("[CREATE_USER] Attempting to create user: {}", req.name);

    // Get Keycloak Admin Token
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client)
        .await
        .map_err(|_| ABError::InternalServerError("Failed to get admin token".to_string()))?;
    info!("[CREATE_USER] Got admin token successfully");

    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    //Extract the user name and password
    let req = req.into_inner();

    // See if there is an API to directly check, rather than getting all users
    let users = admin
        .realm_users_get(
            &realm.clone(),
            None,
            None,
            None,
            Some(true),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(req.name.clone()),
        )
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to fetch users: {}", e)))?;

    info!("[CREATE_USER] Checking if user already exists");
    // Reject if user is present in db
    let exists = users.iter().any(|user| user.id == Some(req.name.clone()));
    if exists {
        info!("[CREATE_USER] User {} already exists", req.name);
        return Err(ABError::BadRequest("User already Exists".to_string()));
    }

    info!("[CREATE_USER] Creating new user in Keycloak: {}", req.name);
    // If not present in keycloak create a new user in keycloak
    let user = UserRepresentation {
        username: Some(req.name.clone()),
        credentials: Some(vec![CredentialRepresentation {
            value: Some(req.password.clone()),
            temporary: Some(false),
            type_: Some("password".to_string()),
            ..Default::default()
        }]),
        enabled: Some(true),
        ..Default::default()
    };
    admin.realm_users_post(&realm, user).await?;

    login_implementation(req, state).await
}

#[post("login")]
async fn login(
    req: Json<UserCredentials>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    login_implementation(req.into_inner(), state).await
}

pub async fn login_implementation(
    req: UserCredentials,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    // Move ENVs to App State
    let url = state.env.keycloak_url.clone();
    let client_id = state.env.client_id.clone();
    let secret = state.env.secret.clone();
    let realm = state.env.realm.clone();

    let url = format!("{}/realms/{}/protocol/openid-connect/token", url, realm);
    info!("[LOGIN] Attempting Keycloak login at URL: {}", url);

    // Keycloak login API
    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id),
        ("client_secret", secret),
        ("grant_type", "password".to_string()),
        ("username", req.name.clone()),
        ("password", req.password.clone()),
    ];

    let response = client.post(&url).form(&params).send().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to send login request: {}", e))
    })?;

    if response.status().is_success() {
        let token: UserToken = response
            .json()
            .await
            .map_err(|e| ABError::InternalServerError(e.to_string()))?;
        let token_data = decode_jwt_token(
            &token.access_token,
            &state.env.keycloak_public_key,
            &state.env.client_id,
        )?;
        let admin_token = get_token(state.env.clone(), client).await?;
        let mut user_resp = get_user_impl(
            AuthResponse {
                is_super_admin: false,
                sub: token_data.claims.sub,
                admin_token,
                organisation: None,
                application: None,
                username: req.name.clone(),
            },
            state,
        )
        .await?;

        user_resp.user_token = Some(token);
        return Ok(user_resp);
    }

    // If response is not successful, extract error message
    let error_text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown error".to_string());

    let login_err: LoginFailure = serde_json::from_str(&error_text).unwrap_or(LoginFailure {
        error: "Unknown error".to_string(),
        error_description: error_text.clone(),
    });

    log::error!("Login failure: {:?}", login_err);

    Err(ABError::Unauthorized(login_err.error_description))
}

#[get("")]
async fn get_user(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    let auth = auth_response.into_inner();
    get_user_impl(auth, state).await
}

async fn get_user_impl(
    authresponse: AuthResponse,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    info!(
        "[GET_USER] Fetching user details for ID: {}",
        authresponse.sub
    );

    // Get list of organisations and application in orginisation for each user
    let user_id: String = authresponse.sub;

    // Get Keycloak Admin Token
    let admin_token = authresponse.admin_token;
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    let groups = admin
        .realm_users_with_user_id_groups_get(&realm, &user_id, None, None, None, None)
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;
    info!("[GET_USER] Retrieved {} groups for user", groups.len());

    // Reject if organisation is present in db
    // If not present in db create entry in db and return success
    Ok(Json(parse_groups(
        user_id,
        authresponse.username,
        groups
            .iter()
            .filter_map(|g| g.path.clone()) // Filters out None values
            .collect(),
    )))
}

fn parse_groups(user_id: String, username: String, groups: Vec<String>) -> User {
    let mut organisations: HashMap<String, Organisation> = HashMap::new();

    for group in groups.iter() {
        info!("[PARSE_GROUPS] Processing group: {}", group);
        let path = group.trim_matches('/'); // Remove leading/trailing slashes
        let parts: Vec<&str> = path.split('/').collect();

        if path == "super_admin" {
            continue;
        }

        let access = parts.last().unwrap().to_string();

        let organisation_name = parts[0].to_string();
        let application_name = if parts.len() == 3 {
            Some(parts[1].to_string())
        } else {
            None
        };

        if let Some(app_name) = application_name {
            // Handle application-level access
            let organisation =
                organisations
                    .entry(organisation_name.clone())
                    .or_insert(Organisation {
                        name: organisation_name.clone(),
                        applications: vec![],
                        access: vec![],
                    });

            let app = organisation
                .applications
                .iter_mut()
                .find(|app| app.application == app_name);

            if let Some(app) = app {
                app.access.push(access);
            } else {
                organisation.applications.push(Application {
                    application: app_name,
                    organisation: organisation_name.clone(),
                    access: vec![access],
                });
            }
        } else {
            // Handle organisation-level access
            let organisation =
                organisations
                    .entry(organisation_name.clone())
                    .or_insert(Organisation {
                        name: organisation_name.clone(),
                        applications: vec![],
                        access: vec![],
                    });

            organisation.access.push(access);
        }
    }
    let is_super_admin = groups.contains(&"/super_admin".to_string());
    info!(
        "[PARSE_GROUPS] Finished parsing. Found {} organisations",
        organisations.len()
    );
    User {
        user_id,
        username,
        is_super_admin,
        organisations: organisations.into_values().collect(),
        user_token: None,
    }
}

#[get("oauth/url")]
async fn get_oauth_url(
    _req: HttpRequest,
    query: Query<OAuthQuery>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    // Use external URL directly from config
    if !state.env.enable_google_signin {
        return Err(ABError::BadRequest(
            "Google Sign-in is disabled".to_string(),
        ));
    }
    let keycloak_url = &state.env.keycloak_external_url;
    let realm = &state.env.realm;
    let client_id = &state.env.client_id;

    let base_url = state.env.public_url.clone();
    let redirect_uri = format!("{}/oauth/callback", base_url);

    let offline = query.offline.unwrap_or(false);
    let scope = if offline {
        "openid offline_access"
    } else {
        "openid"
    };

    let oauth_state = "oauth_login_state".to_string();

    let auth_url = format!(
        "{}/realms/{}/protocol/openid-connect/auth?client_id={}&response_type=code&scope={}&redirect_uri={}&kc_idp_hint=google&state={}",
        keycloak_url,
        realm,
        client_id,
        urlencoding::encode(scope),
        urlencoding::encode(&redirect_uri),
        oauth_state
    );

    info!("[OAUTH_URL] Generated OAuth URL: {}", auth_url);
    info!("[OAUTH_URL] Base URL from request: {}", base_url);
    info!("[OAUTH_URL] Redirect URI: {}", redirect_uri);

    Ok(Json(json!({
        "auth_url": auth_url,
        "state": oauth_state
    })))
}

pub async fn exchange_code_for_token(
    code: &str,
    _req: &HttpRequest,
    state: &web::Data<AppState>,
) -> airborne_types::Result<TokenResponse> {
    // Use internal URL for backend-to-backend communication
    let url = format!(
        "{}/realms/{}/protocol/openid-connect/token",
        state.env.keycloak_url, // Use internal URL for token exchange
        state.env.realm
    );

    // Get redirect URI from request
    let base_url = state.env.public_url.clone();
    let redirect_uri = format!("{}/oauth/callback", base_url);

    let params = [
        ("client_id", state.env.client_id.clone()),
        ("client_secret", state.env.secret.clone()),
        ("grant_type", "authorization_code".to_string()),
        ("code", code.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
    ];

    info!("[EXCHANGE_CODE] Exchanging code for token");
    info!("[EXCHANGE_CODE] URL: {}", url);
    info!("[EXCHANGE_CODE] Redirect URI: {}", redirect_uri);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await
        .map_err(|e| {
            info!("[EXCHANGE_CODE] Request failed: {}", e);
            ABError::InternalServerError(e.to_string())
        })?;

    if response.status().is_success() {
        response.json::<TokenResponse>().await.map_err(|e| {
            info!("[EXCHANGE_CODE] Failed to parse token response: {}", e);
            ABError::InternalServerError(format!("Failed to parse token response: {}", e))
        })
    } else {
        let error_text = response.text().await.unwrap_or_default();
        info!("[EXCHANGE_CODE] Token exchange failed: {}", error_text);
        Err(ABError::Unauthorized(format!(
            "Token exchange failed: {}",
            error_text
        )))
    }
}

#[post("oauth/login")]
async fn oauth_login(
    req: HttpRequest,
    json_req: Json<OAuthLoginRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    if !state.env.enable_google_signin {
        return Err(ABError::BadRequest(
            "Google Sign-in is disabled".to_string(),
        ));
    }
    info!("[OAUTH_LOGIN] Processing OAuth login with code");

    let oauth_req = json_req.into_inner();

    let token_response = match exchange_code_for_token(&oauth_req.code, &req, &state).await {
        Ok(response) => response,
        Err(e) => {
            info!("[OAUTH_LOGIN] Token exchange failed: {:?}", e);
            return Err(e);
        }
    };

    // Decode the access token to get user info
    let token_data = decode_jwt_token(
        &token_response.access_token,
        &state.env.keycloak_public_key,
        &state.env.client_id,
    )
    .map_err(|e| {
        info!("[OAUTH_LOGIN] Token decode failed: {:?}", e);
        ABError::BadRequest("Invalid token".to_string())
    })?;

    // Get admin token for user operations
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client).await.map_err(|e| {
        info!("[OAUTH_LOGIN] Failed to get admin token: {}", e);
        ABError::InternalServerError(format!("Failed to get admin token: {}", e))
    })?;

    let mut user_resp = get_user_impl(
        AuthResponse {
            sub: token_data.claims.sub.clone(),
            is_super_admin: false,
            admin_token,
            organisation: None,
            application: None,
            username: token_data
                .claims
                .preferred_username
                .clone()
                .ok_or_else(|| ABError::Unauthorized("No email in token".to_string()))?,
        },
        state,
    )
    .await?;

    user_resp.user_token = Some(UserToken {
        access_token: token_response.access_token,
        token_type: token_response.token_type,
        expires_in: token_response.expires_in,
        refresh_token: token_response.refresh_token.unwrap_or_default(),
        refresh_expires_in: token_response.refresh_expires_in.unwrap_or(0),
    });

    Ok(user_resp)
}

#[post("oauth/signup")]
async fn oauth_signup(
    req: HttpRequest,
    json_req: Json<OAuthRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    if !state.env.enable_google_signin {
        return Err(ABError::BadRequest(
            "Google Sign-in is disabled".to_string(),
        ));
    }
    info!("[OAUTH_SIGNUP] Processing OAuth signup with code");

    let oauth_req = json_req.into_inner();

    // Exchange authorization code for tokens (same as login)
    let token_response = exchange_code_for_token(&oauth_req.code, &req, &state).await?;

    // Decode the access token to get user info
    let token_data = decode_jwt_token(
        &token_response.access_token,
        &state.env.keycloak_public_key,
        &state.env.client_id,
    )
    .map_err(|_| ABError::Unauthorized("Invalid token".to_string()))?;

    info!(
        "[OAUTH_SIGNUP] Successfully authenticated user via Google OAuth: {}",
        token_data.claims.sub
    );

    // Get admin token for user operations
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client).await.map_err(|e| {
        info!("[OAUTH_SIGNUP] Failed to get admin token: {}", e);
        ABError::InternalServerError(format!("Failed to get admin token: {}", e))
    })?;

    // For signup, we process it the same way as login since Keycloak handles user creation
    // The user account is automatically created in Keycloak when they sign in with Google
    let mut user_resp = get_user_impl(
        AuthResponse {
            is_super_admin: false,
            sub: token_data.claims.sub,
            admin_token,
            organisation: None,
            application: None,
            username: token_data
                .claims
                .preferred_username
                .clone()
                .ok_or_else(|| ABError::Unauthorized("No email in token".to_string()))?,
        },
        state,
    )
    .await?;

    user_resp.user_token = Some(UserToken {
        access_token: token_response.access_token,
        token_type: token_response.token_type,
        expires_in: token_response.expires_in,
        refresh_token: token_response.refresh_token.unwrap_or_default(),
        refresh_expires_in: token_response.refresh_expires_in.unwrap_or(0),
    });

    info!(
        "[OAUTH_SIGNUP] OAuth signup completed successfully for user: {}",
        user_resp.user_id
    );
    Ok(user_resp)
}
