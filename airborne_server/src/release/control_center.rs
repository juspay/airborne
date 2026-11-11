// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use super::*;
use crate::{run_blocking, utils::db::schema::hyperotaserver::release_events as e};
use diesel::prelude::*;
use serde::Deserialize;
use serde_json::json;
use superposition_sdk::types::ExperimentResponse;
use uuid::Uuid;
type Result<T> = airborne_types::Result<T>;

pub async fn experiments(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> Result<(String, Vec<ExperimentResponse>)> {
    if let Some(cached) = super::write_lock::cached(org, app) {
        return Ok(cached);
    }
    // Read-only even on a cold cache: preview must not populate Redis.
    let workspace = tokio::time::timeout(
        std::time::Duration::from_secs(3),
        crate::utils::workspace::get_workspace_name_for_application_db(
            state.db_pool.clone(),
            app.into(),
            org.into(),
        ),
    )
    .await
    .map_err(|_| ABError::InternalServerError("Workspace lookup deadline".into()))??;
    // Fetch all before filtering: pagination occurs upstream of the name filter.
    let all = write_lock::bounded_read(
        state
            .superposition_client
            .list_experiment()
            .org_id(state.env.superposition_org_id.clone())
            .workspace_id(&workspace)
            .all(true)
            .send(),
    )
    .await?
    .map_err(|_| ABError::InternalServerError("Failed to list releases".into()))?;
    let name = format!("{app}-{org}-release-exp");
    let result = (
        workspace,
        all.data.into_iter().filter(|e| e.name == name).collect(),
    );
    super::write_lock::cache(org, app, result.clone());
    Ok(result)
}
pub(super) fn context(exp: &ExperimentResponse) -> Value {
    json!(exp
        .context
        .iter()
        .map(|(k, v)| (
            k.clone(),
            utils::document_to_value(v).unwrap_or(Value::Null)
        ))
        .collect::<std::collections::BTreeMap<_, _>>())
}
pub(super) fn experimental(exp: &ExperimentResponse) -> Option<&superposition_sdk::types::Variant> {
    exp.variants.iter().find(|v| v.variant_type == Experimental)
}
pub(super) fn live(exp: &ExperimentResponse) -> bool {
    exp.status == ExperimentStatusType::Concluded
        && experimental(exp).is_some_and(|v| Some(&v.id) == exp.chosen_variant.as_ref())
}
fn latest_live(exps: &[ExperimentResponse]) -> Vec<&ExperimentResponse> {
    let mut selected = std::collections::BTreeMap::new();
    for exp in exps.iter().filter(|e| live(e)) {
        let key = context(exp).to_string();
        let old = selected.entry(key).or_insert(exp);
        if (exp.last_modified, &exp.id) > (old.last_modified, &old.id) {
            *old = exp;
        }
    }
    selected.into_values().collect()
}
pub(crate) fn version(exp: &ExperimentResponse) -> i64 {
    utils::extract_integer_from_experiment::<i64>(&experimental(exp), "package.version")
}
fn creation_actor<'a>(actors: &'a [(String, String, Value)], id: &str) -> &'a str {
    actors
        .iter()
        .find(|(release, actor, _)| release == id && !actor.trim().is_empty())
        .map(|(_, actor, payload)| {
            payload
                .get("approval")
                .and_then(|a| a.get("requester"))
                .and_then(Value::as_str)
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(actor.as_str())
        })
        .unwrap_or("Unknown actor (legacy release)")
}

pub async fn app_status(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Value> {
    let pending = Value::Null; // overview attaches the authorized batch result
    let exps = match tokio::time::timeout(
        std::time::Duration::from_millis(1500),
        experiments(state, org, app),
    )
    .await
    {
        Ok(Ok((_, exps))) => exps,
        _ => {
            return Ok(
                json!({"application":app,"platform":null,"live":[],"active":[],"last_activity_at":null,"unresolved_operations":pending,"error":"Release lookup failed or timed out"}),
            )
        }
    };
    let pool = state.db_pool.clone();
    let (o, a) = (org.to_owned(), app.to_owned());
    let actors = run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        Ok(e::table
            .filter(e::org_id.eq(o))
            .filter(e::app_id.eq(a))
            .filter(e::action.eq("created"))
            .order((e::created_at.asc(), e::id.asc()))
            .select((e::release_id, e::actor, e::payload))
            .load::<(String, String, Value)>(&mut c)?)
    })?;
    let live=latest_live(&exps).into_iter().map(|e|json!({"release_id":e.id,"package_version":version(e),"config_version":utils::extract_string_from_experiment(&experimental(e),"config.version"),"dimensions":context(e),"concluded_at":utils::dt(&e.last_modified)})).collect::<Vec<_>>();
    let active=exps.iter().filter(|e|matches!(e.status,ExperimentStatusType::Created|ExperimentStatusType::Inprogress)).map(|e|json!({"release_id":e.id,"package_version":version(e),"status":e.status.as_str(),"traffic_percentage":e.traffic_percentage,"experimental_variant":experimental(e).map(|v|v.id.clone()).unwrap_or_default(),"dimensions":context(e),"created_at":utils::dt(&e.created_at),"created_by":creation_actor(&actors, &e.id)})).collect::<Vec<_>>();
    Ok(
        json!({"application":app,"platform":null,"first_device_seen_at":super::device_seen::read(state,org,app).await?,"telemetry":tokio::time::timeout(std::time::Duration::from_millis(100),crate::telemetry::summary(state,org,app)).await.ok().and_then(|r|r.ok()).unwrap_or_else(||json!({"error":"Telemetry unavailable"})),"live":live,"active":active,"unresolved_operations":pending,"last_activity_at":exps.iter().max_by_key(|e|e.last_modified).map(|e|utils::dt(&e.last_modified)),"error":null}),
    )
}
pub async fn event(
    state: &web::Data<AppState>,
    auth: &AuthResponse,
    release: &str,
    action: &str,
    payload: Value,
) {
    let mut payload = payload;
    payload["server_recorded_at"] = json!(Utc::now());
    payload["availability_confirmed"] = json!(false);
    if let Some(approval) = super::maker_checker::audit_context() {
        payload["approval"] = approval;
    }
    if payload.get("reason").is_none() {
        if let Some(reason) = super::write_lock::last_reason() {
            payload["reason"] = json!(reason);
        }
    }
    if required_event(state, auth, release, action, payload)
        .await
        .is_err()
    {
        log::error!("Failed to append release event");
    }
}
pub(super) async fn required_event(
    state: &web::Data<AppState>,
    auth: &AuthResponse,
    release: &str,
    action: &str,
    payload: Value,
) -> Result<()> {
    let Some(org) = auth.organisation.as_ref().map(|a| a.name.clone()) else {
        return Err(ABError::InternalServerError("Audit scope missing".into()));
    };
    let Some(app) = auth.application.as_ref().map(|a| a.name.clone()) else {
        return Err(ABError::InternalServerError("Audit scope missing".into()));
    };
    use sha2::{Digest, Sha256};
    let event_id = payload
        .get("operation_id")
        .filter(|id| !id.is_null())
        .map(|id| {
            let digest = Sha256::digest(format!("{org}/{app}/{release}/{action}/{id}"));
            Uuid::from_bytes(digest[..16].try_into().unwrap())
        })
        .unwrap_or_else(Uuid::new_v4);
    let pool = state.db_pool.clone();
    let actor = auth.sub.clone();
    let release = release.to_string();
    let action = action.to_string();
    run_blocking!({
        let mut c = pool.get()?;
        diesel::insert_into(e::table)
            .values((
                e::id.eq(event_id),
                e::org_id.eq(org),
                e::app_id.eq(app),
                e::release_id.eq(release),
                e::action.eq(action),
                e::actor.eq(actor),
                e::payload.eq(payload),
            ))
            .on_conflict(e::id)
            .do_nothing()
            .execute(&mut c)?;
        Ok(())
    })
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/releases/{release_id}/events")]
pub async fn events(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<String>,
) -> Result<Json<Value>> {
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let id = path.into_inner();
    let (_, exps) = experiments(&state, &org, &app).await?;
    let exp = exps
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| ABError::NotFound("Release not found".into()))?;
    let pool = state.db_pool.clone();
    let created_at = DateTime::from_timestamp(exp.created_at.secs(), 0).unwrap_or_default();
    let rows = run_blocking!({
        let mut c = pool.get()?;
        Ok(e::table
            .filter(e::org_id.eq(org))
            .filter(e::app_id.eq(app))
            .filter(
                e::release_id
                    .eq(id)
                    .or(e::release_id.eq("").and(e::created_at.ge(created_at))),
            )
            .order((e::created_at.desc(), e::id.desc()))
            .limit(1000)
            .select((e::action, e::actor, e::created_at, e::payload))
            .load::<(String, String, DateTime<Utc>, Value)>(&mut c)?)
    })?;
    let mut events=rows.into_iter().map(|(action,actor,time,payload)|json!({"action":action,"actor":actor,"created_at":time,"payload":payload,"synthetic":false})).collect::<Vec<_>>();
    if !events.iter().any(|e| e["action"] == "created") {
        events.push(json!({"action":"created","actor":"Unknown actor (legacy release)","created_at":utils::dt(&exp.created_at),"payload":{},"synthetic":true}));
    }
    let terminal = match exp.status {
        ExperimentStatusType::Concluded => Some("concluded"),
        ExperimentStatusType::Discarded => Some("discarded"),
        _ => None,
    };
    if let Some(action) = terminal {
        if !events.iter().any(|e| e["action"] == action) {
            events.push(json!({"action":action,"actor":exp.last_modified_by,"created_at":utils::dt(&exp.last_modified),"payload":{"chosen_variant":exp.chosen_variant},"synthetic":true}));
        }
    }
    events.sort_by_key(|e| {
        e["created_at"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
    });
    Ok(Json(
        json!({"events":events,"outcome":outcome(exp, &exps),"audit_completeness":"best_effort"}),
    ))
}
#[derive(Deserialize)]
pub struct RollbackRequest {
    reason: String,
    #[serde(default)]
    emergency: bool,
    #[serde(default)]
    confirm_sensitive_risk: bool,
}
#[derive(Debug, PartialEq)]
pub(super) enum RollbackDecision {
    Discard,
    Control,
    Rerelease,
}
pub(super) fn decision(
    status: &ExperimentStatusType,
    experimental_chosen: bool,
) -> Result<RollbackDecision> {
    match status {
        ExperimentStatusType::Created => Ok(RollbackDecision::Discard),
        ExperimentStatusType::Inprogress => Ok(RollbackDecision::Control),
        ExperimentStatusType::Concluded if experimental_chosen => Ok(RollbackDecision::Rerelease),
        _ => Err(ABError::Conflict("Release cannot be rolled back".into())),
    }
}
#[authz(resource="release",action="conclude",org_roles=["owner","admin","write"],app_roles=["admin","write"])]
#[post("/{release_id}/rollback")]
pub async fn rollback(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<String>,
    req: Json<RollbackRequest>,
) -> Result<actix_web::HttpResponse> {
    let auth = auth_response.into_inner();
    let id = path.into_inner();
    let req = req.into_inner();
    let (status, body) = super::maker_checker::on_execution_stack(move || async move {
        let response = rollback_inner(auth, state, id, req).await?;
        let status = response.status();
        let body = actix_web::body::to_bytes(response.into_body())
            .await
            .map_err(|_| ABError::InternalServerError("Invalid rollback response".into()))?;
        Ok((status, body))
    })
    .await?;
    Ok(actix_web::HttpResponse::build(status)
        .content_type("application/json")
        .body(body))
}

async fn rollback_inner(
    auth_response: AuthResponse,
    state: web::Data<AppState>,
    id: String,
    req: RollbackRequest,
) -> Result<actix_web::HttpResponse> {
    if req.reason.trim().is_empty() {
        return Err(ABError::BadRequest("Rollback reason required".into()));
    }
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let result = super::write_lock::locked(&state, &org, &app, async {
        if req.emergency {
            return super::maker_checker::emergency(
                &state,
                &auth_response,
                &id,
                &req.reason,
                req.confirm_sensitive_risk,
            )
            .await;
        }
        Box::pin(super::rollback::run(
            &state,
            &auth_response,
            &org,
            &app,
            &id,
            &req.reason,
        ))
        .await
    })
    .await;
    match result {
        Ok(response) => Ok(response),
        Err(error) => {
            let op = super::operations::load(&state, &org, &app, Some(&id))
                .await?
                .pop();
            let Some(op) = op else { return Err(error) };
            if op.state == "completed" {
                return Err(error);
            }
            let (status, mut body) = match error {
                ABError::ReleaseOperation { status, body } => (status, body),
                ABError::Conflict(message) => (409, json!({"code":"AB_007","message":message})),
                other => (502, json!({"code":"AB_003","message":other.to_string()})),
            };
            let mut replacement = op.data["replacement_release_id"].clone();
            if replacement.is_null() && op.data["stage"] == "create" {
                if let Ok((_, exps)) = experiments(&state, &org, &app).await {
                    replacement = exps
                        .iter()
                        .find(|e| e.description == format!("Rollback operation {}", op.id))
                        .map(|e| json!(e.id))
                        .unwrap_or(Value::Null);
                }
            }
            if partial_metadata(&op.state, &op.data["stage"], &replacement) {
                body["replacement_release_id"] = replacement;
                body["stage"] = op.data["stage"].clone();
                body["rollback_operation_id"] = json!(op.id);
                return Err(ABError::ReleaseOperation {
                    status: if status == 409 { 409 } else { 502 },
                    body,
                });
            }
            Err(ABError::ReleaseOperation { status, body })
        }
    }
}

fn partial_metadata(state: &str, stage: &Value, _replacement: &Value) -> bool {
    state != "completed" && stage != "completed"
}
pub(super) fn current_live<'a>(
    exp: &ExperimentResponse,
    exps: &'a [ExperimentResponse],
) -> Option<&'a ExperimentResponse> {
    latest_live(exps)
        .into_iter()
        .find(|e| context(e) == context(exp))
}
fn outcome(exp: &ExperimentResponse, exps: &[ExperimentResponse]) -> &'static str {
    match exp.status {
        ExperimentStatusType::Created | ExperimentStatusType::Inprogress => "active",
        ExperimentStatusType::Discarded => "discarded",
        _ if !live(exp) => "concluded_on_control",
        _ if current_live(exp, exps).is_some_and(|e| e.id == exp.id) => "live",
        _ => "superseded",
    }
}
pub fn ensure_active(status: &ExperimentStatusType) -> Result<()> {
    if matches!(
        status,
        ExperimentStatusType::Created | ExperimentStatusType::Inprogress
    ) {
        Ok(())
    } else {
        Err(ABError::Conflict(
            "This release has already concluded or been discarded".into(),
        ))
    }
}
pub fn ensure_inprogress(status: &ExperimentStatusType) -> Result<()> {
    ensure_active(status)?;
    if *status == ExperimentStatusType::Inprogress {
        Ok(())
    } else {
        Err(ABError::Conflict(
            "Ramp this release before concluding it".into(),
        ))
    }
}
async fn retry_invalidation<F, Fut>(mut attempt: F) -> bool
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = bool>,
{
    for _ in 0..3 {
        if attempt().await {
            return true;
        }
    }
    false
}
pub async fn invalidate(state: &web::Data<AppState>, org: &str, app: &str) -> Result<()> {
    if state.env.cloudfront_distribution_id.is_empty() {
        return Ok(());
    }
    let publication_observed_at = Utc::now();
    let mut failed = Vec::new();
    for path in [
        format!("/release/{org}/{app}*"),
        format!("/release/v2/{org}/{app}*"),
    ] {
        let ok = retry_invalidation(|| async {
            matches!(
                tokio::time::timeout(
                    std::time::Duration::from_secs(2),
                    utils::invalidate_cf(
                        &state.cf_client,
                        path.clone(),
                        &state.env.cloudfront_distribution_id,
                    )
                )
                .await,
                Ok(Ok(()))
            )
        })
        .await;
        if !ok {
            failed.push(path);
        }
    }
    let payload = json!({"failed_paths":failed,"attempts_per_path":3,"mutation_may_have_committed":true,"publication_observed_at":publication_observed_at,"invalidation_submission_finished_at":Utc::now(),"availability_confirmed":false});
    let (org, app) = (org.to_owned(), app.to_owned());
    let action = if failed.is_empty() {
        "cache_invalidated"
    } else {
        "cache_invalidation_failed"
    };
    let pool = state.db_pool.clone();
    let saved: Result<()> = run_blocking!({
        let mut c = pool.get()?;
        diesel::insert_into(e::table)
            .values((
                e::id.eq(Uuid::new_v4()),
                e::org_id.eq(org),
                e::app_id.eq(app),
                e::release_id.eq(""),
                e::action.eq(action),
                e::actor.eq("system:cache"),
                e::payload.eq(payload),
            ))
            .execute(&mut c)?;
        Ok(())
    });
    saved?;
    if failed.is_empty() {
        Ok(())
    } else {
        Err(ABError::ReleaseOperation {
            status: 502,
            body: json!({"code":"cache_invalidation_failed","message":"Release state may have changed. Retry cache invalidation; inspect release state before repeating the original action.","failed_paths":failed,"mutation_may_have_committed":true}),
        })
    }
}
#[authz(resource="release",action="read",org_roles=["owner","admin"],app_roles=["admin"])]
#[post("/cache-invalidation/retry")]
pub async fn retry_cache(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Value>> {
    if !auth_response.is_super_admin
        && !auth_response
            .organisation
            .as_ref()
            .is_some_and(|a| a.is_admin_or_higher())
        && !auth_response
            .application
            .as_ref()
            .is_some_and(|a| a.is_admin_or_higher())
    {
        return Err(ABError::Forbidden(
            "Application or organisation admin required".into(),
        ));
    }
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    invalidate(&state, &org, &app).await?;
    Ok(Json(
        json!({"status":if state.env.cloudfront_distribution_id.is_empty(){"not_applicable"}else{"invalidation_submitted"}}),
    ))
}
pub(super) fn sp_error(e: impl std::fmt::Display) -> ABError {
    log::error!("Release operation failed: {e}");
    ABError::InternalServerError("Release operation failed".into())
}
/// Reconcile both variant coverages against the authoritative registered keys.
/// Superposition's atomic create validates values/schemas before persisting anything.
pub(super) fn reconcile(
    old: &HashMap<String, Document>,
    current: &HashMap<String, Document>,
    registered: &[String],
) -> std::result::Result<(HashMap<String, Document>, Value), String> {
    let keys = registered
        .iter()
        .map(|k| k.as_str())
        .collect::<std::collections::BTreeSet<_>>();
    for key in [
        "package.version",
        "package.name",
        "package.index",
        "config.version",
        "config.boot_timeout",
        "config.release_config_timeout",
    ] {
        if !keys.contains(key) || !old.contains_key(key) {
            return Err(format!("Cannot restore required key {key}; restore its registration and historical value before retrying"));
        }
    }
    let mut restored = HashMap::new();
    let mut kept = Vec::new();
    for key in &keys {
        let current_value = current.get(*key).ok_or_else(||format!("No current value for registered key {key}; repair the configuration before retrying"))?;
        let value = if let Some(v) = old.get(*key) {
            v
        } else {
            kept.push(*key);
            current_value
        };
        restored.insert(key.to_string(), value.clone());
    }
    let mut dropped = old
        .keys()
        .filter(|k| !keys.contains(k.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    dropped.sort();
    Ok((restored, json!({"kept_current":kept,"dropped":dropped})))
}

pub(super) fn override_values(
    control: &HashMap<String, Document>,
    experimental: &HashMap<String, Document>,
) -> Value {
    let values = |m: &HashMap<String, Document>| {
        m.iter()
            .map(|(k, v)| {
                (
                    k.clone(),
                    utils::document_to_value(v).unwrap_or(Value::Null),
                )
            })
            .collect::<serde_json::Map<_, _>>()
    };
    json!({"CONTROL":values(control),"EXPERIMENTAL":values(experimental)})
}
pub(super) fn create_expected(
    control: &superposition_sdk::types::Variant,
    experimental: &superposition_sdk::types::Variant,
    dimensions: &HashMap<String, Value>,
) -> Value {
    json!({"status":"CREATED","traffic_percentage":0,"context":dimensions,"variants":override_values(&control.overrides,&experimental.overrides)})
}
pub(super) fn snapshot(exp: &ExperimentResponse) -> Value {
    let variants = exp
        .variants
        .iter()
        .map(|v| {
            (
                v.variant_type.as_str().to_string(),
                json!(v
                    .overrides
                    .iter()
                    .map(|(k, v)| (
                        k.clone(),
                        utils::document_to_value(v).unwrap_or(Value::Null)
                    ))
                    .collect::<serde_json::Map<_, _>>()),
            )
        })
        .collect::<serde_json::Map<_, _>>();
    json!({"id":exp.id,"status":exp.status.as_str(),"context":context(exp),"variants":variants,"traffic_percentage":exp.traffic_percentage,"chosen_variant":exp.chosen_variant,"description":exp.description,"change_reason":exp.change_reason,"revision":format!("{}:{}",exp.last_modified.secs(),exp.last_modified.subsec_nanos())})
}

#[cfg(test)]
mod actor_tests {
    #[test]
    fn actor_comes_from_scoped_creation_audit() {
        let rows = vec![
            ("other".into(), "wrong".into(), serde_json::json!({})),
            (
                "r1".into(),
                "checker".into(),
                serde_json::json!({"approval":{"requester":"real-owner"}}),
            ),
        ];
        assert_eq!(super::creation_actor(&rows, "r1"), "real-owner");
        assert_eq!(
            super::creation_actor(&rows, "legacy"),
            "Unknown actor (legacy release)"
        );
    }
}

#[cfg(test)]
pub(crate) mod tests {
    #[test]
    fn completed_operations_never_get_partial_error_metadata() {
        assert!(!super::partial_metadata(
            "completed",
            &serde_json::json!("completed"),
            &serde_json::json!("r")
        ));
        assert!(super::partial_metadata(
            "planned",
            &serde_json::json!("conclude"),
            &serde_json::json!("r")
        ));
        assert!(super::partial_metadata(
            "planned",
            &serde_json::json!("create"),
            &serde_json::Value::Null
        ));
    }

    #[test]
    fn planned_and_terminal_action_failures_include_stage() {
        for stage in [
            "planned",
            "discarded",
            "concluded_control",
            "create",
            "ramp",
            "conclude",
        ] {
            assert!(super::partial_metadata(
                "planned",
                &serde_json::json!(stage),
                &serde_json::Value::Null
            ));
        }
    }

    #[tokio::test]
    async fn invalidation_retries_returned_errors_and_stop_on_success() {
        let calls = std::cell::Cell::new(0);
        assert!(
            super::retry_invalidation(|| {
                calls.set(calls.get() + 1);
                std::future::ready(calls.get() == 2)
            })
            .await
        );
        assert_eq!(calls.get(), 2);
        calls.set(0);
        assert!(
            !super::retry_invalidation(|| {
                calls.set(calls.get() + 1);
                std::future::ready(false)
            })
            .await
        );
        assert_eq!(calls.get(), 3);
    }
    use super::*;
    use superposition_sdk::types::ExperimentType;
    #[test]
    fn rollback_matrix() {
        assert_eq!(
            decision(&ExperimentStatusType::Created, false).unwrap(),
            RollbackDecision::Discard
        );
        assert_eq!(
            decision(&ExperimentStatusType::Inprogress, false).unwrap(),
            RollbackDecision::Control
        );
        assert_eq!(
            decision(&ExperimentStatusType::Concluded, true).unwrap(),
            RollbackDecision::Rerelease
        );
        assert!(decision(&ExperimentStatusType::Concluded, false).is_err());
        assert!(decision(&ExperimentStatusType::Discarded, false).is_err());
    }
    #[test]
    fn reconciliation_keeps_new_drops_removed_and_requires_restorable_core() {
        let core = [
            "package.version",
            "package.name",
            "package.index",
            "config.version",
            "config.boot_timeout",
            "config.release_config_timeout",
        ];
        let mut old = core
            .iter()
            .map(|k| (k.to_string(), Document::String("historical".into())))
            .collect::<HashMap<_, _>>();
        let mut current = old.clone();
        old.insert("removed".into(), Document::Null);
        current.insert("added".into(), Document::String("current".into()));
        let mut registered = core.iter().map(|k| k.to_string()).collect::<Vec<_>>();
        registered.push("added".into());
        let (restored, changes) = reconcile(&old, &current, &registered).unwrap();
        assert_eq!(restored["added"], current["added"]);
        assert_eq!(restored["config.version"], old["config.version"]);
        assert!(!restored.contains_key("removed"));
        assert_eq!(
            changes,
            json!({"kept_current":["added"],"dropped":["removed"]})
        );
        current.remove("added");
        assert!(reconcile(&old, &current, &registered).is_err());
        registered.retain(|k| k != "package.version");
        assert!(reconcile(&old, &current, &registered).is_err());
    }
    pub(crate) fn make(id: &str, time: i64, dim: &str) -> ExperimentResponse {
        let variant = VariantBuilder::default()
            .id("exp")
            .set_overrides(Some(HashMap::new()))
            .variant_type(Experimental)
            .build()
            .unwrap();

        ExperimentResponse::builder()
            .id(id)
            .name("release")
            .set_override_keys(Some(Vec::new()))
            .created_at(aws_smithy_types::DateTime::from_secs(time))
            .created_by("test")
            .last_modified(aws_smithy_types::DateTime::from_secs(time))
            .last_modified_by("test")
            .status(ExperimentStatusType::Concluded)
            .traffic_percentage(50)
            .experiment_type(ExperimentType::Default)
            .description("")
            .change_reason("")
            .variants(variant.clone())
            .chosen_variant("exp")
            .context("platform", Document::String(dim.into()))
            .build()
            .unwrap()
    }
    #[test]
    fn stale_detection_uses_the_latest_live_release_in_the_same_context() {
        let exps = vec![
            make("old", 1, "ios"),
            make("current", 2, "ios"),
            make("other", 3, "android"),
        ];
        assert_eq!(current_live(&exps[0], &exps).unwrap().id, "current");
        assert_ne!(current_live(&exps[0], &exps).unwrap().id, exps[0].id);
        assert_eq!(current_live(&exps[1], &exps).unwrap().id, exps[1].id);
    }
    #[test]
    fn outcome_covers_all_five_contract_values() {
        let mut exps = vec![make("old", 1, "ios"), make("current", 2, "ios")];
        assert_eq!(outcome(&exps[0], &exps), "superseded");
        assert_eq!(outcome(&exps[1], &exps), "live");
        exps[0].chosen_variant = Some("control".into());
        assert_eq!(outcome(&exps[0], &exps), "concluded_on_control");
        exps[0].status = ExperimentStatusType::Discarded;
        assert_eq!(outcome(&exps[0], &exps), "discarded");
        exps[0].status = ExperimentStatusType::Inprogress;
        assert_eq!(outcome(&exps[0], &exps), "active");
    }
    #[test]
    fn live_selection() {
        let mut exps = vec![
            make("old", 1, "ios"),
            make("new", 2, "ios"),
            make("android", 1, "android"),
            make("control", 3, "ios"),
        ];
        exps[3].chosen_variant = Some("control".into());
        let ids = latest_live(&exps)
            .iter()
            .map(|e| e.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"new"));
        assert!(ids.contains(&"android"));
        assert_eq!(current_live(&exps[0], &exps).unwrap().id, "new");
        assert_eq!(outcome(&exps[0], &exps), "superseded");
        assert_eq!(outcome(&exps[1], &exps), "live");
        assert_eq!(outcome(&exps[3], &exps), "concluded_on_control");
        exps[3].status = ExperimentStatusType::Discarded;
        assert_eq!(outcome(&exps[3], &exps), "discarded");
        exps[3].status = ExperimentStatusType::Created;
        assert_eq!(outcome(&exps[3], &exps), "active");
        assert!(ensure_active(&ExperimentStatusType::Concluded).is_err());
        assert!(ensure_active(&ExperimentStatusType::Discarded).is_err());
        assert!(ensure_active(&ExperimentStatusType::Created).is_ok());
        assert!(ensure_inprogress(&ExperimentStatusType::Created).is_err());
        assert!(ensure_inprogress(&ExperimentStatusType::Inprogress).is_ok());
    }
}
