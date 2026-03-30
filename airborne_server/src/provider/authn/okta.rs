use ::keycloak::KeycloakAdminToken;
use async_trait::async_trait;

use crate::{
    provider::authn::{oidc::resolve_external_oidc_user, AuthNProvider, AuthnTokenClaims},
    types as airborne_types,
    types::{AppState, AuthnProviderKind},
    utils::keycloak::ResolvedKeycloakUser,
};

pub struct OktaAuthNProvider;

#[async_trait]
impl AuthNProvider for OktaAuthNProvider {
    fn kind(&self) -> AuthnProviderKind {
        AuthnProviderKind::Okta
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
