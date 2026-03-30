use ::keycloak::{KeycloakAdmin, KeycloakAdminToken};
use async_trait::async_trait;
use reqwest::Client;

use crate::{
    provider::authn::{AuthNProvider, AuthnTokenClaims},
    types as airborne_types,
    types::{ABError, AppState, AuthnProviderKind},
    utils::keycloak::{resolve_user_by_email_or_username, ResolvedKeycloakUser},
};

pub struct OidcAuthNProvider;

pub async fn resolve_external_oidc_user(
    state: &AppState,
    claims: &AuthnTokenClaims,
    admin_token: &KeycloakAdminToken,
) -> airborne_types::Result<ResolvedKeycloakUser> {
    if claims.email.is_none() {
        return Err(ABError::Unauthorized(
            "Email claim is required for OIDC identity mapping".to_string(),
        ));
    }

    let admin = KeycloakAdmin::new(&state.env.keycloak_url, admin_token.clone(), Client::new());
    resolve_user_by_email_or_username(
        &admin,
        &state.env.realm,
        claims.email.as_deref(),
        claims.preferred_username.as_deref(),
    )
    .await
}

#[async_trait]
impl AuthNProvider for OidcAuthNProvider {
    fn kind(&self) -> AuthnProviderKind {
        AuthnProviderKind::Oidc
    }

    fn supports_password_login(&self) -> bool {
        false
    }

    fn supports_signup(&self) -> bool {
        false
    }

    async fn resolve_keycloak_user(
        &self,
        state: &AppState,
        claims: &AuthnTokenClaims,
        admin_token: &KeycloakAdminToken,
    ) -> airborne_types::Result<ResolvedKeycloakUser> {
        resolve_external_oidc_user(state, claims, admin_token).await
    }
}
