use ::keycloak::{
    types::{CredentialRepresentation, UserRepresentation},
    KeycloakAdmin, KeycloakAdminToken,
};
use async_trait::async_trait;
use reqwest::Client;

use crate::{
    provider::authn::{
        build_oauth_url_common, password_login_common, AuthNProvider, AuthnTokenClaims,
        OAuthUrlResponse,
    },
    types as airborne_types,
    types::{ABError, AppState, AuthnProviderKind},
    user::types::{UserCredentials, UserToken},
    utils::keycloak::{find_user_by_username, get_token, ResolvedKeycloakUser},
};

pub struct KeycloakAuthNProvider;

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

    async fn resolve_keycloak_user(
        &self,
        _state: &AppState,
        claims: &AuthnTokenClaims,
        _admin_token: &KeycloakAdminToken,
    ) -> airborne_types::Result<ResolvedKeycloakUser> {
        let username = claims
            .preferred_username
            .clone()
            .or_else(|| claims.email.clone())
            .ok_or_else(|| ABError::Unauthorized("No username present in token".to_string()))?;

        Ok(ResolvedKeycloakUser {
            user_id: claims.sub.clone(),
            username,
        })
    }
}
