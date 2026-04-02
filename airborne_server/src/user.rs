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
    provider::authn::AuthnTokenClaims,
    types as airborne_types,
    types::{ABError, AppState},
    user::types::*,
};
use actix_web::{
    get, post,
    web::{self, Json, Query},
    HttpRequest, Scope,
};
use log::info;
use serde_json::json;

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

fn ensure_oidc_login_supported(state: &AppState) -> airborne_types::Result<()> {
    state.authn_provider.ensure_oidc_login_enabled(state)
}

fn ensure_password_login_supported(state: &AppState) -> airborne_types::Result<()> {
    state.authn_provider.ensure_password_login_supported()
}

fn ensure_signup_supported(state: &AppState) -> airborne_types::Result<()> {
    state.authn_provider.ensure_signup_supported()
}

async fn auth_response_from_claims(
    claims: &AuthnTokenClaims,
    state: web::Data<AppState>,
) -> airborne_types::Result<AuthResponse> {
    let subject = state.authz_provider.subject_from_claims(claims)?;

    Ok(AuthResponse {
        sub: subject,
        authn_sub: claims.sub.clone(),
        authn_iss: claims.iss.clone(),
        authn_email: claims.email.clone(),
        organisation: None,
        application: None,
        is_super_admin: false,
        username: state.authz_provider.display_name_from_claims(claims),
    })
}

async fn auth_response_from_access_token(
    access_token: &str,
    state: web::Data<AppState>,
) -> airborne_types::Result<AuthResponse> {
    let token_data = state
        .authn_provider
        .verify_access_token(state.get_ref(), access_token)
        .await?;
    auth_response_from_claims(&token_data.claims, state).await
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
    ensure_signup_supported(state.get_ref())?;
    let req = req.into_inner();
    info!("[CREATE_USER] Attempting to create user: {}", req.name);

    let token = state
        .authn_provider
        .signup_with_password(state.get_ref(), &req)
        .await?;
    let auth_response = auth_response_from_access_token(&token.access_token, state.clone()).await?;
    let mut user_resp = get_user_impl(auth_response, state).await?;
    user_resp.user_token = Some(token);

    Ok(user_resp)
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
    ensure_password_login_supported(state.get_ref())?;
    let token = state
        .authn_provider
        .login_with_password(state.get_ref(), &req)
        .await?;
    let auth_response = auth_response_from_access_token(&token.access_token, state.clone()).await?;
    let mut user_resp = get_user_impl(auth_response, state).await?;
    user_resp.user_token = Some(token);

    Ok(user_resp)
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
        "[GET_USER] Fetching user details for subject: {}",
        authresponse.sub
    );

    let summary = state
        .authz_provider
        .get_user_access_summary(state.get_ref(), &authresponse.sub)
        .await?;

    let mut organisations = summary
        .organisations
        .into_iter()
        .map(|org| Organisation {
            name: org.name,
            applications: org
                .applications
                .into_iter()
                .map(|app| Application {
                    application: app.application,
                    organisation: app.organisation,
                    access: app.access,
                })
                .collect(),
            access: org.access,
        })
        .collect::<Vec<_>>();

    organisations.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(Json(User {
        user_id: summary.subject,
        username: authresponse.username,
        is_super_admin: summary.is_super_admin,
        organisations,
        user_token: None,
    }))
}

#[get("oauth/url")]
async fn get_oauth_url(
    _req: HttpRequest,
    query: Query<OAuthQuery>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    ensure_oidc_login_supported(state.get_ref())?;
    let oauth_url = state
        .authn_provider
        .get_oauth_url(
            state.get_ref(),
            query.offline.unwrap_or(false),
            query.idp.as_deref(),
        )
        .await?;
    info!("[OAUTH_URL] Generated OAuth URL");

    Ok(Json(json!({
        "auth_url": oauth_url.auth_url,
        "state": oauth_url.state
    })))
}

pub async fn exchange_code_for_token(
    code: &str,
    oauth_state: Option<&str>,
    _req: &HttpRequest,
    state: &web::Data<AppState>,
) -> airborne_types::Result<TokenResponse> {
    state
        .authn_provider
        .exchange_code_for_token(state.get_ref(), code, oauth_state)
        .await
}

#[post("oauth/login")]
async fn oauth_login(
    req: HttpRequest,
    json_req: Json<OAuthLoginRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    ensure_oidc_login_supported(state.get_ref())?;
    info!("[OAUTH_LOGIN] Processing OAuth login with code");

    let oauth_req = json_req.into_inner();

    let token_response =
        match exchange_code_for_token(&oauth_req.code, oauth_req.state.as_deref(), &req, &state)
            .await
        {
            Ok(response) => response,
            Err(e) => {
                info!("[OAUTH_LOGIN] Token exchange failed: {:?}", e);
                return Err(e);
            }
        };

    // Decode the access token to get user info
    let token_data = state
        .authn_provider
        .verify_access_token(state.get_ref(), &token_response.access_token)
        .await
        .map_err(|e| {
            info!("[OAUTH_LOGIN] Token decode failed: {:?}", e);
            ABError::BadRequest("Invalid token".to_string())
        })?;
    let auth_response = auth_response_from_claims(&token_data.claims, state.clone()).await?;
    let mut user_resp = get_user_impl(auth_response, state).await?;

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
    ensure_oidc_login_supported(state.get_ref())?;
    ensure_signup_supported(state.get_ref())?;
    info!("[OAUTH_SIGNUP] Processing OAuth signup with code");

    let oauth_req = json_req.into_inner();

    // Exchange authorization code for tokens (same as login)
    let token_response =
        exchange_code_for_token(&oauth_req.code, oauth_req.state.as_deref(), &req, &state).await?;

    // Decode the access token to get user info
    let token_data = state
        .authn_provider
        .verify_access_token(state.get_ref(), &token_response.access_token)
        .await
        .map_err(|_| ABError::Unauthorized("Invalid token".to_string()))?;

    info!(
        "[OAUTH_SIGNUP] Successfully authenticated user via OIDC OAuth: {}",
        token_data.claims.sub
    );

    // For signup, v1 keeps provider-specific behavior and this endpoint is enabled only on
    // providers that support signup.
    let auth_response = auth_response_from_claims(&token_data.claims, state.clone()).await?;
    let mut user_resp = get_user_impl(auth_response, state).await?;

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
