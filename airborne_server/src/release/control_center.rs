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
    let all = state
        .superposition_client
        .list_experiment()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(&workspace)
        .all(true)
        .send()
        .await
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
pub(super) fn version(exp: &ExperimentResponse) -> i64 {
    utils::extract_integer_from_experiment::<i64>(&experimental(exp), "package.version")
}
pub async fn app_status(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Value> {
    let pending = super::operations::load(state, org, app, None)
        .await?
        .iter()
        .map(super::write_lock::details)
        .collect::<Vec<_>>();
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
    let live=latest_live(&exps).into_iter().map(|e|json!({"release_id":e.id,"package_version":version(e),"config_version":utils::extract_string_from_experiment(&experimental(e),"config.version"),"dimensions":context(e),"concluded_at":utils::dt(&e.last_modified)})).collect::<Vec<_>>();
    let active=exps.iter().filter(|e|matches!(e.status,ExperimentStatusType::Created|ExperimentStatusType::Inprogress)).map(|e|json!({"release_id":e.id,"package_version":version(e),"status":e.status.as_str(),"traffic_percentage":e.traffic_percentage,"experimental_variant":experimental(e).map(|v|v.id.clone()).unwrap_or_default(),"dimensions":context(e),"created_at":utils::dt(&e.created_at),"created_by":e.created_by})).collect::<Vec<_>>();
    Ok(
        json!({"application":app,"platform":null,"live":live,"active":active,"unresolved_operations":pending,"last_activity_at":exps.iter().max_by_key(|e|e.last_modified).map(|e|utils::dt(&e.last_modified)),"error":null}),
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
async fn required_event(
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
    let pool = state.db_pool.clone();
    let actor = auth.sub.clone();
    let release = release.to_string();
    let action = action.to_string();
    run_blocking!({
        let mut c = pool.get()?;
        diesel::insert_into(e::table)
            .values((
                e::id.eq(Uuid::new_v4()),
                e::org_id.eq(org),
                e::app_id.eq(app),
                e::release_id.eq(release),
                e::action.eq(action),
                e::actor.eq(actor),
                e::payload.eq(payload),
            ))
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
    let rows = run_blocking!({
        let mut c = pool.get()?;
        Ok(e::table
            .filter(e::org_id.eq(org))
            .filter(e::app_id.eq(app))
            .filter(e::release_id.eq(id))
            .order((e::created_at.asc(), e::id.asc()))
            .select((e::action, e::actor, e::created_at, e::payload))
            .load::<(String, String, DateTime<Utc>, Value)>(&mut c)?)
    })?;
    let mut events=rows.into_iter().map(|(action,actor,time,payload)|json!({"action":action,"actor":actor,"created_at":time,"payload":payload,"synthetic":false})).collect::<Vec<_>>();
    if !events.iter().any(|e| e["action"] == "created") {
        events.push(json!({"action":"created","actor":exp.created_by,"created_at":utils::dt(&exp.created_at),"payload":{},"synthetic":true}));
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
    events.sort_by_key(|e| e["created_at"].as_str().unwrap_or_default().to_string());
    Ok(Json(json!({"events":events,"outcome":outcome(exp, &exps)})))
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
    if req.reason.trim().is_empty() {
        return Err(ABError::BadRequest("Rollback reason required".into()));
    }
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let id = path.into_inner();
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

fn partial_metadata(state: &str, stage: &Value, replacement: &Value) -> bool {
    state != "completed" && stage != "completed" && (!replacement.is_null() || stage == "create")
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
pub async fn invalidate(state: &web::Data<AppState>, org: &str, app: &str) {
    for path in [
        format!("/release/{org}/{app}*"),
        format!("/release/v2/{org}/{app}*"),
    ] {
        log::info!("Invalidating release config cache: {path}");
        if tokio::time::timeout(
            std::time::Duration::from_secs(2),
            utils::invalidate_cf(
                &state.cf_client,
                path,
                &state.env.cloudfront_distribution_id,
            ),
        )
        .await
        .is_err()
        {
            log::warn!("Release cache invalidation failed");
        }
    }
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
