use async_trait::async_trait;

use crate::{provider::authn::AuthNProvider, types::AuthnProviderKind};

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
}
