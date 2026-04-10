use ::keycloak::{
    types::{CredentialRepresentation, UserRepresentation},
    KeycloakAdmin,
};
use async_trait::async_trait;
use reqwest::Client;

use crate::{
    provider::authn::{
        build_oauth_url_common, password_login_common, AuthNProvider, OAuthUrlResponse,
    },
    types as airborne_types,
    types::{ABError, AppState, AuthnProviderKind},
    user::types::{UserCredentials, UserToken},
    utils::keycloak::{find_user_by_username, get_token},
};

pub struct KeycloakAuthNProvider;

fn required_signup_field(
    value: &Option<String>,
    field_name: &str,
) -> airborne_types::Result<String> {
    let trimmed = value
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .ok_or_else(|| ABError::BadRequest(format!("`{field_name}` is required for signup")))?;
    Ok(trimmed.to_string())
}

#[async_trait]
impl AuthNProvider for KeycloakAuthNProvider {
    fn kind(&self) -> AuthnProviderKind {
        AuthnProviderKind::Keycloak
    }

    fn supports_password_login(&self) -> bool {
        true
    }

    fn supports_signup(&self) -> bool {
        true
    }

    fn is_oidc_login_enabled(&self, state: &AppState) -> bool {
        !state.env.enabled_oidc_idps.is_empty()
    }

    fn ensure_oidc_login_enabled(&self, state: &AppState) -> airborne_types::Result<()> {
        if self.is_oidc_login_enabled(state) {
            Ok(())
        } else {
            Err(ABError::BadRequest(
                "No OIDC identity providers are configured".to_string(),
            ))
        }
    }

    async fn get_oauth_url(
        &self,
        state: &AppState,
        offline: bool,
        idp_hint: Option<&str>,
    ) -> airborne_types::Result<OAuthUrlResponse> {
        self.ensure_oidc_login_enabled(state)?;
        let selected_idp = if let Some(requested_idp) = idp_hint {
            let normalized = requested_idp.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                return Err(ABError::BadRequest(
                    "OIDC identity provider cannot be empty".to_string(),
                ));
            }
            if !state
                .env
                .enabled_oidc_idps
                .iter()
                .any(|configured| configured.eq_ignore_ascii_case(&normalized))
            {
                return Err(ABError::BadRequest(format!(
                    "Unsupported OIDC identity provider: {}",
                    requested_idp
                )));
            }
            normalized
        } else {
            state
                .env
                .enabled_oidc_idps
                .first()
                .cloned()
                .ok_or_else(|| {
                    ABError::BadRequest("No OIDC identity providers are configured".to_string())
                })?
        };

        let extra_query_params = [("kc_idp_hint", selected_idp.as_str())];
        build_oauth_url_common(state, offline, &extra_query_params, &[]).await
    }

    async fn login_with_password(
        &self,
        state: &AppState,
        credentials: &UserCredentials,
    ) -> airborne_types::Result<UserToken> {
        password_login_common(state, credentials, None).await
    }

    async fn login_with_password_for_pat(
        &self,
        state: &AppState,
        credentials: &UserCredentials,
    ) -> airborne_types::Result<UserToken> {
        password_login_common(state, credentials, Some("offline_access")).await
    }

    async fn signup_with_password(
        &self,
        state: &AppState,
        credentials: &UserCredentials,
    ) -> airborne_types::Result<UserToken> {
        self.ensure_signup_supported()?;
        let first_name = required_signup_field(&credentials.first_name, "first_name")?;
        let last_name = required_signup_field(&credentials.last_name, "last_name")?;
        let email = required_signup_field(&credentials.email, "email")?;

        if state.env.keycloak_url.trim().is_empty() {
            return Err(ABError::InternalServerError(
                "AUTH_ADMIN_ISSUER must be configured for Keycloak signup".to_string(),
            ));
        }
        if state.env.realm.trim().is_empty() {
            return Err(ABError::InternalServerError(
                "Unable to derive Keycloak realm from AUTH_ADMIN_ISSUER".to_string(),
            ));
        }

        let admin_token = get_token(state.env.clone(), Client::new())
            .await
            .map_err(|_| ABError::InternalServerError("Failed to get admin token".to_string()))?;
        let admin = KeycloakAdmin::new(&state.env.keycloak_url, admin_token, Client::new());

        if find_user_by_username(&admin, &state.env.realm, &credentials.name)
            .await?
            .is_some()
        {
            return Err(ABError::BadRequest("User already Exists".to_string()));
        }

        let user = UserRepresentation {
            username: Some(credentials.name.clone()),
            first_name: Some(first_name),
            last_name: Some(last_name),
            email: Some(email),
            email_verified: Some(false),
            credentials: Some(vec![CredentialRepresentation {
                value: Some(credentials.password.clone()),
                temporary: Some(false),
                type_: Some("password".to_string()),
                ..Default::default()
            }]),
            enabled: Some(true),
            ..Default::default()
        };
        admin.realm_users_post(&state.env.realm, user).await?;

        self.login_with_password(state, credentials).await
    }

    fn supports_service_accounts(&self) -> bool {
        true
    }

    async fn create_service_account_user(
        &self,
        state: &AppState,
        username: &str,
        email: &str,
        password: &str,
    ) -> airborne_types::Result<UserToken> {
        if state.env.keycloak_url.trim().is_empty() {
            return Err(ABError::InternalServerError(
                "AUTH_ADMIN_ISSUER must be configured for service account creation".to_string(),
            ));
        }
        if state.env.realm.trim().is_empty() {
            return Err(ABError::InternalServerError(
                "Unable to derive Keycloak realm from AUTH_ADMIN_ISSUER".to_string(),
            ));
        }

        let admin_token = get_token(state.env.clone(), Client::new())
            .await
            .map_err(|_| ABError::InternalServerError("Failed to get admin token".to_string()))?;
        let admin = KeycloakAdmin::new(&state.env.keycloak_url, admin_token, Client::new());

        if find_user_by_username(&admin, &state.env.realm, username)
            .await?
            .is_some()
        {
            return Err(ABError::BadRequest(
                "Service account user already exists".to_string(),
            ));
        }

        let user = UserRepresentation {
            username: Some(username.to_string()),
            first_name: Some("Service".to_string()),
            last_name: Some("Account".to_string()),
            email: Some(email.to_string()),
            email_verified: Some(true),
            credentials: Some(vec![CredentialRepresentation {
                value: Some(password.to_string()),
                temporary: Some(false),
                type_: Some("password".to_string()),
                ..Default::default()
            }]),
            enabled: Some(true),
            ..Default::default()
        };
        admin.realm_users_post(&state.env.realm, user).await?;

        // Login with offline_access to get a long-lived refresh token
        let credentials = UserCredentials {
            name: username.to_string(),
            password: password.to_string(),
            first_name: None,
            last_name: None,
            email: None,
        };
        password_login_common(state, &credentials, Some("offline_access")).await
    }

    async fn delete_user(&self, state: &AppState, username: &str) -> airborne_types::Result<()> {
        if state.env.keycloak_url.trim().is_empty() || state.env.realm.trim().is_empty() {
            return Err(ABError::InternalServerError(
                "Keycloak admin configuration required for user deletion".to_string(),
            ));
        }

        let admin_token = get_token(state.env.clone(), Client::new())
            .await
            .map_err(|_| ABError::InternalServerError("Failed to get admin token".to_string()))?;
        let admin = KeycloakAdmin::new(&state.env.keycloak_url, admin_token, Client::new());

        let user = find_user_by_username(&admin, &state.env.realm, username)
            .await?
            .ok_or_else(|| ABError::NotFound("User not found in identity provider".to_string()))?;

        let user_id = user.id.ok_or_else(|| {
            ABError::InternalServerError("User has no ID in identity provider".to_string())
        })?;

        admin
            .realm_users_with_user_id_delete(&state.env.realm, &user_id)
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!(
                    "Failed to delete user from identity provider: {}",
                    e
                ))
            })?;

        Ok(())
    }
}
