use std::collections::{BTreeMap, BTreeSet};

use actix_web::{
    get, post,
    web::{self, Json, Query, ReqData},
    Scope,
};

use crate::{
    middleware::auth::AuthResponse,
    provider::authz::{permission::EndpointPermissionBinding, AuthzPermissionCheck},
    types as airborne_types,
    types::{ABError, AppState},
};

use self::types::{
    EnforceBatchRequest, EnforceBatchResponse, PermissionBatchCheckResult, PermissionCatalogItem,
    PermissionCatalogQuery, PermissionCatalogResponse,
};

pub mod types;

const SCOPE_ORG: &str = "org";
const SCOPE_APP: &str = "app";
const SCOPE_AUTO: &str = "auto";
const MAX_BATCH_CHECKS: usize = 200;

#[derive(Copy, Clone, Debug)]
enum PermissionScope {
    Organisation,
    Application,
    Auto,
}

impl PermissionScope {
    fn as_str(self) -> &'static str {
        match self {
            Self::Organisation => SCOPE_ORG,
            Self::Application => SCOPE_APP,
            Self::Auto => SCOPE_AUTO,
        }
    }
}

#[derive(Debug)]
struct PendingDecision {
    resource: String,
    action: String,
    scope: String,
    decision_indexes: Vec<usize>,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(permission_catalog)
        .service(enforce_my_permissions_batch)
}

#[get("/catalog")]
async fn permission_catalog(
    auth_response: ReqData<AuthResponse>,
    query: Query<PermissionCatalogQuery>,
) -> airborne_types::Result<Json<PermissionCatalogResponse>> {
    let auth = auth_response.into_inner();
    let scope = resolve_catalog_scope(query.scope.as_deref(), &auth)?;

    let mut dedup = BTreeSet::<(String, String)>::new();
    for binding in inventory::iter::<EndpointPermissionBinding> {
        let resource = binding.resource.trim().to_ascii_lowercase();
        let action = binding.action.trim().to_ascii_lowercase();
        if resource.is_empty() || action.is_empty() {
            continue;
        }
        if !is_valid_permission_part(&resource) || !is_valid_permission_part(&action) {
            continue;
        }

        let include = match scope {
            PermissionScope::Organisation => binding.allow_org,
            PermissionScope::Application => binding.allow_app,
            PermissionScope::Auto => false,
        };
        if include {
            dedup.insert((resource, action));
        }
    }

    let permissions = dedup
        .into_iter()
        .map(|(resource, action)| PermissionCatalogItem {
            key: format!("{resource}.{action}"),
            resource,
            action,
            scope: scope.as_str().to_string(),
        })
        .collect::<Vec<_>>();

    Ok(Json(PermissionCatalogResponse { permissions }))
}

#[post("/me/enforce-batch")]
async fn enforce_my_permissions_batch(
    auth_response: ReqData<AuthResponse>,
    body: Json<EnforceBatchRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<EnforceBatchResponse>> {
    let auth = auth_response.into_inner();
    let payload = body.into_inner();
    if payload.checks.is_empty() {
        return Err(ABError::BadRequest("checks cannot be empty".to_string()));
    }
    if payload.checks.len() > MAX_BATCH_CHECKS {
        return Err(ABError::BadRequest(format!(
            "checks exceeds limit of {}",
            MAX_BATCH_CHECKS
        )));
    }

    let org_name = auth.organisation.as_ref().map(|value| value.name.clone());
    let app_name = auth.application.as_ref().map(|value| value.name.clone());

    let mut provider_checks = Vec::with_capacity(payload.checks.len().min(MAX_BATCH_CHECKS));
    let mut check_index = BTreeMap::new();
    let mut result_context = Vec::with_capacity(payload.checks.len().min(MAX_BATCH_CHECKS));
    for check in payload.checks {
        let resource = normalize_permission_part(&check.resource, "resource")?;
        let action = normalize_permission_part(&check.action, "action")?;
        let scope = parse_requested_scope(check.scope.as_deref())?;
        let mut decision_indexes = Vec::new();
        match scope {
            PermissionScope::Organisation => {
                let organisation =
                    required_context_value(org_name.as_deref(), "organisation", "x-organisation")?;
                let index = upsert_provider_check(
                    &mut provider_checks,
                    &mut check_index,
                    organisation,
                    None,
                    &resource,
                    &action,
                );
                decision_indexes.push(index);
            }
            PermissionScope::Application => {
                let organisation =
                    required_context_value(org_name.as_deref(), "organisation", "x-organisation")?;
                let application =
                    required_context_value(app_name.as_deref(), "application", "x-application")?;
                let index = upsert_provider_check(
                    &mut provider_checks,
                    &mut check_index,
                    organisation,
                    Some(application),
                    &resource,
                    &action,
                );
                decision_indexes.push(index);
            }
            PermissionScope::Auto => {
                let organisation =
                    required_context_value(org_name.as_deref(), "organisation", "x-organisation")?;
                if let Some(application) = app_name.as_deref() {
                    // In app context, mirror endpoint enforcement semantics: allow app OR org.
                    let app_index = upsert_provider_check(
                        &mut provider_checks,
                        &mut check_index,
                        organisation,
                        Some(application),
                        &resource,
                        &action,
                    );
                    decision_indexes.push(app_index);
                }
                let org_index = upsert_provider_check(
                    &mut provider_checks,
                    &mut check_index,
                    organisation,
                    None,
                    &resource,
                    &action,
                );
                decision_indexes.push(org_index);
            }
        }
        result_context.push(PendingDecision {
            resource,
            action,
            scope: scope.as_str().to_string(),
            decision_indexes,
        });
    }

    let decisions = state
        .authz_provider
        .enforce_permissions_batch(state.get_ref(), &auth.sub, &provider_checks)
        .await?;

    if decisions.len() != provider_checks.len() {
        return Err(ABError::InternalServerError(
            "Permission evaluation size mismatch".to_string(),
        ));
    }

    let results = result_context
        .into_iter()
        .map(|entry| {
            let mut allowed = false;
            for index in entry.decision_indexes {
                let Some(value) = decisions.get(index) else {
                    return Err(ABError::InternalServerError(
                        "Permission evaluation index mismatch".to_string(),
                    ));
                };
                if *value {
                    allowed = true;
                    break;
                }
            }
            Ok(PermissionBatchCheckResult {
                key: format!("{}.{}", entry.resource, entry.action),
                resource: entry.resource,
                action: entry.action,
                scope: entry.scope,
                allowed,
            })
        })
        .collect::<airborne_types::Result<Vec<_>>>()?;

    Ok(Json(EnforceBatchResponse { results }))
}

fn parse_requested_scope(raw_scope: Option<&str>) -> airborne_types::Result<PermissionScope> {
    let normalized = raw_scope.map(|value| value.trim().to_ascii_lowercase());
    match normalized.as_deref() {
        Some("org") | Some("organisation") => Ok(PermissionScope::Organisation),
        Some("app") | Some("application") => Ok(PermissionScope::Application),
        Some("auto") | None => Ok(PermissionScope::Auto),
        Some(value) => Err(ABError::BadRequest(format!(
            "Invalid scope '{}'. Expected one of: org, app, auto",
            value
        ))),
    }
}

fn resolve_catalog_scope(
    raw_scope: Option<&str>,
    auth: &AuthResponse,
) -> airborne_types::Result<PermissionScope> {
    match parse_requested_scope(raw_scope)? {
        PermissionScope::Organisation => {
            if auth.organisation.is_some() {
                Ok(PermissionScope::Organisation)
            } else {
                Err(ABError::BadRequest(
                    "Organisation scope requires x-organisation header".to_string(),
                ))
            }
        }
        PermissionScope::Application => {
            if auth.organisation.is_some() && auth.application.is_some() {
                Ok(PermissionScope::Application)
            } else {
                Err(ABError::BadRequest(
                    "Application scope requires x-organisation and x-application headers"
                        .to_string(),
                ))
            }
        }
        PermissionScope::Auto => {
            if auth.application.is_some() {
                Ok(PermissionScope::Application)
            } else if auth.organisation.is_some() {
                Ok(PermissionScope::Organisation)
            } else {
                Err(ABError::BadRequest(
                    "Scope context missing. Send x-organisation (and x-application for app scope)"
                        .to_string(),
                ))
            }
        }
    }
}

fn normalize_permission_part(raw: &str, field: &str) -> airborne_types::Result<String> {
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(ABError::BadRequest(format!("{field} cannot be empty")));
    }
    if !is_valid_permission_part(&normalized) {
        return Err(ABError::BadRequest(format!(
            "Invalid {} '{}'. Use lowercase slug values [a-z0-9_-]",
            field, raw
        )));
    }
    Ok(normalized)
}

fn required_context_value<'a>(
    value: Option<&'a str>,
    name: &str,
    header: &str,
) -> airborne_types::Result<&'a str> {
    value.ok_or_else(|| ABError::BadRequest(format!("{name} context is missing; send {header}")))
}

fn upsert_provider_check(
    provider_checks: &mut Vec<AuthzPermissionCheck>,
    check_index: &mut BTreeMap<(String, Option<String>, String, String), usize>,
    organisation: &str,
    application: Option<&str>,
    resource: &str,
    action: &str,
) -> usize {
    let key = (
        organisation.to_string(),
        application.map(str::to_string),
        resource.to_string(),
        action.to_string(),
    );
    if let Some(existing) = check_index.get(&key) {
        return *existing;
    }

    let index = provider_checks.len();
    provider_checks.push(AuthzPermissionCheck {
        organisation: organisation.to_string(),
        application: application.map(str::to_string),
        resource: resource.to_string(),
        action: action.to_string(),
    });
    check_index.insert(key, index);
    index
}

fn is_valid_permission_part(value: &str) -> bool {
    value
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
}
