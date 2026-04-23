use std::collections::BTreeSet;

use diesel::{r2d2::ConnectionManager, PgConnection};
use keycloak::{
    types::{GroupRepresentation, UserRepresentation},
    KeycloakAdmin, KeycloakAdminToken,
};
use log::info;
use r2d2::Pool;
use reqwest::Client as HttpClient;
use url::Url;

use crate::{
    config::AppConfig,
    provider::authz::casbin::{CasbinAuthzProvider, PolicyEntry},
};

fn trim_trailing_slash(value: &str) -> String {
    value.trim_end_matches('/').to_string()
}

pub fn parse_keycloak_admin_issuer(auth_admin_issuer: &str) -> Result<(String, String), String> {
    let auth_admin_issuer = trim_trailing_slash(auth_admin_issuer);
    let parsed_issuer = Url::parse(&auth_admin_issuer)
        .map_err(|error| format!("AUTH_ADMIN_ISSUER must be a valid absolute URL: {error}"))?;
    let path_segments: Vec<&str> = parsed_issuer
        .path_segments()
        .map(|segments| segments.filter(|segment| !segment.is_empty()).collect())
        .unwrap_or_default();
    let realms_index = path_segments
        .iter()
        .position(|segment| *segment == "realms")
        .ok_or_else(|| {
            "AUTH_ADMIN_ISSUER must contain '/realms/{realm}' for Keycloak admin APIs".to_string()
        })?;
    let realm = path_segments
        .get(realms_index + 1)
        .ok_or_else(|| {
            "AUTH_ADMIN_ISSUER must include a realm segment after '/realms'".to_string()
        })?
        .to_string();
    let mut keycloak_base = format!(
        "{}://{}",
        parsed_issuer.scheme(),
        parsed_issuer
            .host_str()
            .ok_or_else(|| "AUTH_ADMIN_ISSUER must include a host".to_string())?
    );
    if let Some(port) = parsed_issuer.port() {
        keycloak_base.push_str(&format!(":{port}"));
    }
    if realms_index > 0 {
        keycloak_base.push('/');
        keycloak_base.push_str(&path_segments[..realms_index].join("/"));
    }
    Ok((trim_trailing_slash(&keycloak_base), realm))
}

async fn fetch_admin_token_from_config(
    app_config: &AppConfig,
) -> Result<KeycloakAdminToken, String> {
    let token_url = app_config
        .auth_admin_token_url
        .as_ref()
        .ok_or_else(|| "AUTH_ADMIN_TOKEN_URL must be set for Keycloak import".to_string())?;
    let client_id = app_config
        .auth_admin_client_id
        .as_ref()
        .ok_or_else(|| "AUTH_ADMIN_CLIENT_ID must be set for Keycloak import".to_string())?;
    let client_secret = app_config
        .auth_admin_client_secret
        .as_ref()
        .ok_or_else(|| "AUTH_ADMIN_CLIENT_SECRET must be set for Keycloak import".to_string())?;

    let mut params: Vec<(&str, String)> = vec![
        ("grant_type", "client_credentials".to_string()),
        ("client_id", client_id.clone()),
        ("client_secret", client_secret.clone()),
    ];
    if let Some(audience) = app_config.auth_admin_audience.clone() {
        if !audience.trim().is_empty() {
            params.push(("audience", audience));
        }
    }
    if let Some(scopes) = app_config.auth_admin_scopes.clone() {
        if !scopes.trim().is_empty() {
            params.push(("scope", scopes));
        }
    }

    let response = HttpClient::new()
        .post(token_url)
        .form(&params)
        .send()
        .await
        .map_err(|error| format!("Failed to request admin access token: {error}"))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to get admin access token: {error_text}"));
    }

    response
        .json::<KeycloakAdminToken>()
        .await
        .map_err(|error| format!("Failed to parse admin access token response: {error}"))
}

fn subject_from_user(user: &UserRepresentation) -> Option<String> {
    user.email
        .as_ref()
        .or(user.username.as_ref())
        .map(|subject| subject.trim().to_ascii_lowercase())
        .filter(|subject| !subject.is_empty())
}

fn map_group_path_to_policy(subject: &str, group: &GroupRepresentation) -> Option<PolicyEntry> {
    let path = group.path.as_deref()?;
    let segments: Vec<&str> = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    match segments.as_slice() {
        ["super_admin"] => Some(PolicyEntry {
            subject: subject.to_string(),
            scope: "system".to_string(),
            organisation: "*".to_string(),
            application: "*".to_string(),
            action: "super_admin".to_string(),
        }),
        [org, role]
            if matches!(
                (*role).to_ascii_lowercase().as_str(),
                "owner" | "admin" | "write" | "read"
            ) =>
        {
            Some(PolicyEntry {
                subject: subject.to_string(),
                scope: "org".to_string(),
                organisation: (*org).to_string(),
                application: "*".to_string(),
                action: (*role).to_ascii_lowercase(),
            })
        }
        [org, app, role]
            if matches!(
                (*role).to_ascii_lowercase().as_str(),
                "admin" | "write" | "read"
            ) =>
        {
            Some(PolicyEntry {
                subject: subject.to_string(),
                scope: "app".to_string(),
                organisation: (*org).to_string(),
                application: (*app).to_string(),
                action: (*role).to_ascii_lowercase(),
            })
        }
        _ => None,
    }
}

pub async fn import_keycloak_authz_to_casbin(
    app_config: &AppConfig,
    db_pool: Pool<ConnectionManager<PgConnection>>,
    apply: bool,
) -> Result<(), String> {
    let auth_admin_issuer = app_config
        .auth_admin_issuer
        .as_ref()
        .ok_or_else(|| "AUTH_ADMIN_ISSUER must be set for Keycloak import".to_string())?;
    let (keycloak_url, realm) = parse_keycloak_admin_issuer(auth_admin_issuer)?;
    let admin_token = fetch_admin_token_from_config(app_config).await?;
    let admin = KeycloakAdmin::new(&keycloak_url, admin_token, HttpClient::new());

    let users = admin
        .realm_users_get(
            &realm,
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
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(|error| format!("Failed to list Keycloak users: {error}"))?;

    let mut entries = BTreeSet::new();
    let mut ignored_groups = 0usize;
    let mut skipped_users = 0usize;

    for user in users {
        let Some(user_id) = user.id.as_ref() else {
            skipped_users += 1;
            continue;
        };
        let Some(subject) = subject_from_user(&user) else {
            skipped_users += 1;
            continue;
        };

        let groups = admin
            .realm_users_with_user_id_groups_get(&realm, user_id, None, None, None, None)
            .await
            .map_err(|error| format!("Failed to fetch groups for user '{subject}': {error}"))?;
        for group in groups {
            if let Some(entry) = map_group_path_to_policy(&subject, &group) {
                entries.insert(entry);
            } else {
                ignored_groups += 1;
            }
        }
    }

    let casbin_provider = CasbinAuthzProvider::new(Vec::new(), db_pool.clone(), None)
        .await
        .map_err(|error| format!("Failed to initialize Casbin provider: {error}"))?;

    let policies: Vec<PolicyEntry> = entries.into_iter().collect();
    let imported = casbin_provider
        .import_policy_entries(&policies, apply)
        .await
        .map_err(|error| format!("Failed to import policies: {error}"))?;

    if apply {
        info!(
            "Applied {} Keycloak-derived Casbin policies ({} users skipped, {} groups ignored)",
            imported, skipped_users, ignored_groups
        );
    } else {
        info!(
            "Dry run generated {} Keycloak-derived Casbin policies ({} users skipped, {} groups ignored)",
            imported, skipped_users, ignored_groups
        );
    }

    Ok(())
}
