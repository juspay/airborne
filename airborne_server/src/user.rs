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

use std::collections::HashMap;

use actix_web::{
    get, post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use keycloak::{
    types::{CredentialRepresentation, UserRepresentation},
    KeycloakAdmin,
};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    middleware::auth::AuthResponse,
    organisation::application::Application,
    organisation::Organisation,
    types::ABError,
    types::AppState,
    utils::keycloak::{decode_jwt_token, get_token},
};

pub fn add_routes() -> Scope {
    web::scope("")
        .service(create_user)
        .service(login)
        .service(get_user)
        .service(oauth_login)
        .service(get_oauth_url)
        .service(oauth_signup) // Add the new signup endpoint
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

#[derive(Serialize, Deserialize)]
struct UserCredentials {
    name: String,
    password: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct UserToken {
    access_token: String,
    token_type: String,
    expires_in: i64,
    refresh_token: String,
    refresh_expires_in: i64,
}

#[post("create")]
async fn create_user(
    req: Json<UserCredentials>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>, ABError> {
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
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

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
    admin
        .realm_users_post(&realm, user)
        .await
        .map_err(|_| ABError::InternalServerError("Failed to create user".to_string()))?;

    login_implementation(req, state).await
}

#[post("login")]
async fn login(
    req: Json<UserCredentials>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>, ABError> {
    login_implementation(req.into_inner(), state).await
}

async fn login_implementation(
    req: UserCredentials,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>, ABError> {
    info!("[LOGIN] Login attempt for user: {}", req.name);

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

    let response = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?; // Handle request failure

    if response.status().is_success() {
        info!("[LOGIN] Login successful for user: {}", req.name);
        let token: UserToken = response
            .json()
            .await
            .map_err(|e| ABError::InternalServerError(e.to_string()))?;
        let token_data = decode_jwt_token(
            &token.access_token,
            &state.env.keycloak_public_key,
            &state.env.client_id,
        )
        .map_err(|e| {
            info!("Keycloak decode jwt error {:?}", e);
            ABError::Unauthorized("Token has expired or is invalid".to_string())
        })?;
        let admin_token = get_token(state.env.clone(), client)
            .await
            .map_err(|e| ABError::InternalServerError(e.to_string()))?;
        let mut user_resp = get_user_impl(
            AuthResponse {
                sub: token_data.claims.sub,
                admin_token,
                organisation: None,
                application: None,
            },
            state,
        )
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

        user_resp.user_token = Some(token);
        return Ok(user_resp);
    } else {
        info!("[LOGIN] Login failed for user: {}", req.name);
    }

    // If response is not successful, extract error message
    let error_text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown error".to_string());

    Err(ABError::Unauthorized(format!(
        "Login failed: {}",
        error_text
    )))
}

#[derive(Serialize, Deserialize)]
struct User {
    user_id: String,
    organisations: Vec<Organisation>,
    user_token: Option<UserToken>,
}

#[get("")]
async fn get_user(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>, ABError> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ABError::Unauthorized(
            "Authorization missing or Invalid".to_string(),
        ))?;
    get_user_impl(auth, state).await
}

async fn get_user_impl(
    authresponse: AuthResponse,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>, ABError> {
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
        groups
            .iter()
            .filter_map(|g| g.path.clone()) // Filters out None values
            .collect(),
    )))
}

fn parse_groups(user_id: String, groups: Vec<String>) -> User {
    let mut organisations: HashMap<String, Organisation> = HashMap::new();

    for group in groups.iter() {
        info!("[PARSE_GROUPS] Processing group: {}", group);
        let path = group.trim_matches('/'); // Remove leading/trailing slashes
        let parts: Vec<&str> = path.split('/').collect();

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

    info!(
        "[PARSE_GROUPS] Finished parsing. Found {} organisations",
        organisations.len()
    );
    User {
        user_id,
        organisations: organisations.into_values().collect(),
        user_token: None,
    }
}

#[derive(Serialize, Deserialize)]
struct OAuthLoginRequest {
    code: String,
    state: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    expires_in: i64,
    refresh_token: Option<String>,
    refresh_expires_in: Option<i64>,
    id_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OAuthState {
    state: String,
    code_verifier: String,
    redirect_uri: String,
}

#[get("oauth/url")]
async fn get_oauth_url(
    _req: HttpRequest,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<serde_json::Value>, ABError> {
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

    let oauth_state = "oauth_login_state".to_string();

    let auth_url = format!(
        "{}/realms/{}/protocol/openid-connect/auth?client_id={}&response_type=code&scope=openid&redirect_uri={}&kc_idp_hint=google&state={}",
        keycloak_url,
        realm,
        client_id,
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

async fn exchange_code_for_token(
    code: &str,
    _req: &HttpRequest,
    state: &web::Data<AppState>,
) -> actix_web::Result<TokenResponse, ABError> {
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
        response
            .json::<TokenResponse>()
            .await
            .map_err(|e| ABError::InternalServerError(e.to_string()))
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
) -> actix_web::Result<Json<User>, ABError> {
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
    let admin_token = get_token(state.env.clone(), client)
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let mut user_resp = get_user_impl(
        AuthResponse {
            sub: token_data.claims.sub.clone(),
            admin_token,
            organisation: None,
            application: None,
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

#[derive(Serialize, Deserialize)]
struct OAuthRequest {
    code: String,
    state: Option<String>,
}

#[post("oauth/signup")]
async fn oauth_signup(
    req: HttpRequest,
    json_req: Json<OAuthRequest>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<User>, ABError> {
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
    let admin_token = get_token(state.env.clone(), client)
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    // For signup, we process it the same way as login since Keycloak handles user creation
    // The user account is automatically created in Keycloak when they sign in with Google
    let mut user_resp = get_user_impl(
        AuthResponse {
            sub: token_data.claims.sub,
            admin_token,
            organisation: None,
            application: None,
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
