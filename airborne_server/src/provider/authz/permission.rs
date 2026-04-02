use actix_web::web::{Data, ReqData};

use crate::{
    middleware::auth::AuthResponse,
    types as airborne_types,
    types::{ABError, AppState},
};

#[derive(Debug)]
pub struct EndpointPermissionBinding {
    pub method: &'static str,
    pub path: &'static str,
    pub resource: &'static str,
    pub action: &'static str,
    pub org_roles: &'static [&'static str],
    pub app_roles: &'static [&'static str],
    pub allow_org: bool,
    pub allow_app: bool,
    pub webhook_allowed: bool,
}

#[allow(clippy::too_many_arguments)]
impl EndpointPermissionBinding {
    pub const fn new(
        method: &'static str,
        path: &'static str,
        resource: &'static str,
        action: &'static str,
        org_roles: &'static [&'static str],
        app_roles: &'static [&'static str],
        allow_org: bool,
        allow_app: bool,
        webhook_allowed: bool,
    ) -> Self {
        Self {
            method,
            path,
            resource,
            action,
            org_roles,
            app_roles,
            allow_org,
            allow_app,
            webhook_allowed,
        }
    }
}

inventory::collect!(EndpointPermissionBinding);

pub fn scoped_permission(scope: &str, resource: &str, action: &str) -> String {
    format!("{scope}:{resource}.{action}")
}

pub async fn enforce_endpoint_permission(
    state: &Data<AppState>,
    auth_response: &ReqData<AuthResponse>,
    resource: &str,
    action: &str,
    allow_org: bool,
    allow_app: bool,
) -> airborne_types::Result<()> {
    let auth = auth_response.clone().into_inner();
    if auth.is_super_admin {
        return Ok(());
    }

    let mut allowed = false;

    if allow_app {
        if let (Some(org), Some(app)) = (auth.organisation.clone(), auth.application.clone()) {
            allowed = state
                .authz_provider
                .enforce_permission(
                    state.get_ref(),
                    &auth.sub,
                    &org.name,
                    Some(&app.name),
                    resource,
                    action,
                )
                .await?;
        }
    }

    if !allowed && allow_org {
        if let Some(org) = auth.organisation {
            allowed = state
                .authz_provider
                .enforce_permission(
                    state.get_ref(),
                    &auth.sub,
                    &org.name,
                    None,
                    resource,
                    action,
                )
                .await?;
        }
    }

    if allowed {
        Ok(())
    } else {
        Err(ABError::Forbidden(format!(
            "Missing permission for {}.{}",
            resource, action
        )))
    }
}
