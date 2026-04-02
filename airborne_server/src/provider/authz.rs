use std::sync::Arc;

use async_trait::async_trait;
use diesel::{r2d2::ConnectionManager, PgConnection};
use r2d2::Pool;

use crate::{
    middleware::auth::AccessLevel,
    provider::authn::AuthnTokenClaims,
    types as airborne_types,
    types::{ABError, AppState, AuthzProviderKind},
};

pub mod casbin;
pub mod migration;
pub mod permission;

const MAX_AUTHZ_BATCH_PREALLOC: usize = 1024;

#[derive(Clone, Debug)]
pub struct ApplicationAccessSummary {
    pub organisation: String,
    pub application: String,
    pub access: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct OrganisationAccessSummary {
    pub name: String,
    pub access: Vec<String>,
    pub applications: Vec<ApplicationAccessSummary>,
}

#[derive(Clone, Debug)]
pub struct UserAccessSummary {
    pub subject: String,
    pub is_super_admin: bool,
    pub organisations: Vec<OrganisationAccessSummary>,
}

#[derive(Clone, Debug)]
pub struct AuthzUserInfo {
    pub username: String,
    pub email: Option<String>,
    pub roles: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct AuthzAccessContext {
    pub organisation: Option<AccessLevel>,
    pub application: Option<AccessLevel>,
    pub is_super_admin: bool,
}

#[derive(Clone, Debug)]
pub struct AuthzPermissionAttribute {
    pub key: String,
    pub resource: String,
    pub action: String,
}

#[derive(Clone, Debug)]
pub struct AuthzRoleDefinition {
    pub role: String,
    pub is_system: bool,
    pub permissions: Vec<AuthzPermissionAttribute>,
}

#[derive(Clone, Debug)]
pub struct AuthzPermissionCheck {
    pub organisation: String,
    pub application: Option<String>,
    pub resource: String,
    pub action: String,
}

#[async_trait]
pub trait AuthZProvider: Send + Sync {
    fn kind(&self) -> AuthzProviderKind;

    async fn bootstrap(&self, _state: &AppState) -> airborne_types::Result<()> {
        Ok(())
    }

    fn subject_from_claims(&self, claims: &AuthnTokenClaims) -> airborne_types::Result<String> {
        claims
            .email
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_ascii_lowercase())
            .ok_or_else(|| {
                ABError::Unauthorized(
                    "Email claim is required for authorization subject mapping".to_string(),
                )
            })
    }

    fn display_name_from_claims(&self, claims: &AuthnTokenClaims) -> String {
        claims
            .email
            .clone()
            .or_else(|| claims.preferred_username.clone())
            .unwrap_or_else(|| claims.sub.clone())
    }

    async fn access_for_request(
        &self,
        state: &AppState,
        subject: &str,
        organisation: Option<&str>,
        application: Option<&str>,
    ) -> airborne_types::Result<AuthzAccessContext>;

    async fn get_user_access_summary(
        &self,
        state: &AppState,
        subject: &str,
    ) -> airborne_types::Result<UserAccessSummary>;

    async fn organisation_exists(
        &self,
        state: &AppState,
        organisation: &str,
    ) -> airborne_types::Result<bool>;

    async fn create_organisation(
        &self,
        state: &AppState,
        organisation: &str,
        owner_subject: &str,
    ) -> airborne_types::Result<()>;

    async fn delete_organisation(
        &self,
        state: &AppState,
        organisation: &str,
    ) -> airborne_types::Result<()>;

    async fn create_application(
        &self,
        state: &AppState,
        organisation: &str,
        application: &str,
        creator_subject: &str,
    ) -> airborne_types::Result<()>;

    async fn list_organisation_users(
        &self,
        state: &AppState,
        organisation: &str,
    ) -> airborne_types::Result<Vec<AuthzUserInfo>>;

    async fn add_organisation_user(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()>;

    async fn update_organisation_user(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()>;

    async fn remove_organisation_user(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()>;

    async fn transfer_organisation_ownership(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()>;

    async fn list_application_users(
        &self,
        state: &AppState,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<Vec<AuthzUserInfo>>;

    async fn add_application_user(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()>;

    async fn update_application_user(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()>;

    async fn remove_application_user(
        &self,
        state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()>;

    async fn list_role_definitions(
        &self,
        _state: &AppState,
        _actor_subject: &str,
        _organisation: &str,
        _application: Option<&str>,
    ) -> airborne_types::Result<Vec<AuthzRoleDefinition>> {
        Ok(Vec::new())
    }

    async fn list_available_permissions(
        &self,
        _state: &AppState,
        _actor_subject: &str,
        _organisation: &str,
        _application: Option<&str>,
    ) -> airborne_types::Result<Vec<AuthzPermissionAttribute>> {
        Ok(Vec::new())
    }

    async fn upsert_custom_role(
        &self,
        _state: &AppState,
        _actor_subject: &str,
        _organisation: &str,
        _application: Option<&str>,
        _role: &str,
        _permissions: &[String],
    ) -> airborne_types::Result<()> {
        Ok(())
    }

    async fn enforce_permission(
        &self,
        _state: &AppState,
        _subject: &str,
        _organisation: &str,
        _application: Option<&str>,
        _resource: &str,
        _action: &str,
    ) -> airborne_types::Result<bool> {
        Ok(false)
    }

    async fn enforce_permissions_batch(
        &self,
        state: &AppState,
        subject: &str,
        checks: &[AuthzPermissionCheck],
    ) -> airborne_types::Result<Vec<bool>> {
        let mut decisions = Vec::with_capacity(checks.len().min(MAX_AUTHZ_BATCH_PREALLOC));
        for check in checks {
            let allowed = self
                .enforce_permission(
                    state,
                    subject,
                    &check.organisation,
                    check.application.as_deref(),
                    &check.resource,
                    &check.action,
                )
                .await?;
            decisions.push(allowed);
        }
        Ok(decisions)
    }
}

pub async fn build_authz_provider(
    kind: AuthzProviderKind,
    bootstrap_super_admins: Vec<String>,
    db_pool: Pool<ConnectionManager<PgConnection>>,
    casbin_auto_load_secs: Option<u64>,
) -> airborne_types::Result<Arc<dyn AuthZProvider>> {
    match kind {
        AuthzProviderKind::Casbin => {
            let provider = casbin::CasbinAuthzProvider::new(
                bootstrap_super_admins,
                db_pool,
                casbin_auto_load_secs,
            )
            .await?;
            Ok(Arc::new(provider))
        }
    }
}
