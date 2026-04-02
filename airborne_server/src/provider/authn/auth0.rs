use async_trait::async_trait;

use crate::{provider::authn::AuthNProvider, types::AuthnProviderKind};

pub struct Auth0AuthNProvider;

#[async_trait]
impl AuthNProvider for Auth0AuthNProvider {
    fn kind(&self) -> AuthnProviderKind {
        AuthnProviderKind::Auth0
    }

    fn supports_password_login(&self) -> bool {
        false
    }

    fn supports_signup(&self) -> bool {
        false
    }
}
