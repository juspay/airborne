use async_trait::async_trait;

use crate::{provider::authn::AuthNProvider, types::AuthnProviderKind};

pub struct OidcAuthNProvider;

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
}
