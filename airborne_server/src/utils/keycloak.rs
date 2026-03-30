use crate::{
    middleware::auth::AuthResponse,
    types as airborne_types,
    types::{ABError, AppState, Environment},
};
use actix_web::{web, HttpMessage, HttpRequest};
use keycloak::{
    self,
    types::{GroupRepresentation, UserRepresentation},
    KeycloakAdmin, KeycloakAdminToken,
};
use reqwest::Client;
use serde::Deserialize;

#[derive(Clone, Debug)]
pub struct ResolvedKeycloakUser {
    pub user_id: String,
    pub username: String,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    error: Option<String>,
    error_description: Option<String>,
}

pub async fn get_token(
    env: Environment,
    client: Client,
) -> airborne_types::Result<KeycloakAdminToken> {
    let mut params: Vec<(&str, String)> = vec![
        ("grant_type", "client_credentials".to_string()),
        ("client_id", env.auth_admin_client_id.clone()),
        ("client_secret", env.auth_admin_client_secret.clone()),
    ];
    if let Some(audience) = env.auth_admin_audience.clone() {
        if !audience.trim().is_empty() {
            params.push(("audience", audience));
        }
    }
    if let Some(scopes) = env.auth_admin_scopes.clone() {
        if !scopes.trim().is_empty() {
            params.push(("scope", scopes));
        }
    }

    let response = client
        .post(&env.auth_admin_token_url)
        .form(&params)
        .send()
        .await
        .map_err(|error| {
            ABError::InternalServerError(format!("Failed to request admin access token: {error}"))
        })?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        let parsed_error = serde_json::from_str::<OAuthErrorResponse>(&error_text).ok();
        let message = parsed_error
            .and_then(|parsed| parsed.error_description.or(parsed.error))
            .unwrap_or(error_text);
        return Err(ABError::Unauthorized(format!(
            "Failed to get admin access token: {message}"
        )));
    }

    response
        .json::<KeycloakAdminToken>()
        .await
        .map_err(|error| {
            ABError::InternalServerError(format!(
                "Failed to parse admin access token response: {error}"
            ))
        })
}

async fn search_users(
    admin: &KeycloakAdmin,
    realm: &str,
    search_term: &str,
) -> airborne_types::Result<Vec<UserRepresentation>> {
    admin
        .realm_users_get(
            realm,
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
            Some(search_term.to_string()),
        )
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to search user in keycloak: {}", e))
        })
}

pub async fn find_user_by_username(
    admin: &KeycloakAdmin,
    realm: &str,
    username: &str,
) -> airborne_types::Result<Option<UserRepresentation>> {
    let users = search_users(admin, realm, username).await?;
    Ok(users.into_iter().find(|user| {
        user.username
            .as_ref()
            .map(|candidate| candidate.eq_ignore_ascii_case(username))
            .unwrap_or(false)
    }))
}

pub async fn find_user_by_email(
    admin: &KeycloakAdmin,
    realm: &str,
    email: &str,
) -> airborne_types::Result<Option<UserRepresentation>> {
    let users = search_users(admin, realm, email).await?;
    Ok(users.into_iter().find(|user| {
        user.email
            .as_ref()
            .map(|candidate| candidate.eq_ignore_ascii_case(email))
            .unwrap_or(false)
    }))
}

pub async fn resolve_user_by_email_or_username(
    admin: &KeycloakAdmin,
    realm: &str,
    email: Option<&str>,
    username: Option<&str>,
) -> airborne_types::Result<ResolvedKeycloakUser> {
    let mut user = if let Some(email) = email {
        find_user_by_email(admin, realm, email).await?
    } else {
        None
    };

    if user.is_none() {
        if let Some(preferred_username) = username {
            user = find_user_by_username(admin, realm, preferred_username).await?;
        }
    }

    let user = user.ok_or_else(|| {
        ABError::Unauthorized("Unable to map authenticated user to Keycloak user".to_string())
    })?;

    let user_id = user.id.clone().ok_or_else(|| {
        ABError::InternalServerError("Mapped Keycloak user has no user ID".to_string())
    })?;
    let resolved_username = user
        .username
        .clone()
        .or_else(|| user.email.clone())
        .ok_or_else(|| ABError::Unauthorized("Mapped Keycloak user has no username".to_string()))?;

    Ok(ResolvedKeycloakUser {
        user_id,
        username: resolved_username,
    })
}

pub async fn prepare_user_action(
    req: &HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<(KeycloakAdmin, String)> {
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ABError::Unauthorized("Token Parse Failed".to_string()))?;

    let admin_token = auth_response.admin_token.clone();
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    Ok((admin, realm))
}

pub async fn find_org_group(
    admin: &KeycloakAdmin,
    realm: &str,
    org_name: &str,
) -> airborne_types::Result<Option<GroupRepresentation>> {
    let groups = admin
        .realm_groups_get(
            realm,
            None,
            Some(true),
            None,
            None,
            None,
            None,
            Some(org_name.to_string()),
        )
        .await?;

    if groups.is_empty() {
        return Ok(None);
    }

    Ok(Some(groups[0].clone()))
}

pub async fn find_role_subgroup(
    admin: &KeycloakAdmin,
    realm: &str,
    group_id: &str,
    role: &str,
) -> airborne_types::Result<Option<GroupRepresentation>> {
    let subgroups = admin
        .realm_groups_with_group_id_children_get(realm, group_id, None, None, None, None, None)
        .await?;

    for group in subgroups {
        if let Some(name) = &group.name {
            if name == role {
                return Ok(Some(group));
            }
        }
    }

    Ok(None)
}
