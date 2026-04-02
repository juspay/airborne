use crate::{
    types as airborne_types,
    types::{ABError, Environment},
};
use keycloak::{self, types::UserRepresentation, KeycloakAdmin, KeycloakAdminToken};
use reqwest::Client;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    error: Option<String>,
    error_description: Option<String>,
}

pub async fn get_token(
    env: Environment,
    client: Client,
) -> airborne_types::Result<KeycloakAdminToken> {
    if env.auth_admin_client_id.trim().is_empty() {
        return Err(ABError::InternalServerError(
            "AUTH_ADMIN_CLIENT_ID must be configured for admin API calls".to_string(),
        ));
    }
    if env.auth_admin_client_secret.trim().is_empty() {
        return Err(ABError::InternalServerError(
            "AUTH_ADMIN_CLIENT_SECRET must be configured for admin API calls".to_string(),
        ));
    }
    if env.auth_admin_token_url.trim().is_empty() {
        return Err(ABError::InternalServerError(
            "AUTH_ADMIN_TOKEN_URL must be configured for admin API calls".to_string(),
        ));
    }

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
