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
use serde_json::json;
use superposition_sdk::types::ExperimentResponse;
use uuid::Uuid;
type Result<T> = airborne_types::Result<T>;

pub async fn experiments(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> Result<(String, Vec<ExperimentResponse>)> {
    // Read-only even on a cold cache: the overview must not populate Redis.
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
    Ok((
        workspace,
        all.data.into_iter().filter(|e| e.name == name).collect(),
    ))
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
    let exps = match tokio::time::timeout(
        std::time::Duration::from_millis(1500),
        experiments(state, org, app),
    )
    .await
    {
        Ok(Ok((_, exps))) => exps,
        _ => {
            return Ok(
                json!({"application":app,"platform":null,"live":[],"active":[],"last_activity_at":null,"error":"Release lookup failed or timed out"}),
            )
        }
    };
    let live=latest_live(&exps).into_iter().map(|e|json!({"release_id":e.id,"package_version":version(e),"config_version":utils::extract_string_from_experiment(&experimental(e),"config.version"),"dimensions":context(e),"concluded_at":utils::dt(&e.last_modified)})).collect::<Vec<_>>();
    let active=exps.iter().filter(|e|matches!(e.status,ExperimentStatusType::Created|ExperimentStatusType::Inprogress)).map(|e|json!({"release_id":e.id,"package_version":version(e),"status":e.status.as_str(),"traffic_percentage":e.traffic_percentage,"experimental_variant":experimental(e).map(|v|v.id.clone()).unwrap_or_default(),"dimensions":context(e),"created_at":utils::dt(&e.created_at),"created_by":e.created_by})).collect::<Vec<_>>();
    Ok(
        json!({"application":app,"platform":null,"live":live,"active":active,"last_activity_at":exps.iter().max_by_key(|e|e.last_modified).map(|e|utils::dt(&e.last_modified)),"error":null}),
    )
}
pub async fn event(
    state: &web::Data<AppState>,
    auth: &AuthResponse,
    release: &str,
    action: &str,
    payload: Value,
) {
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

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use superposition_sdk::types::ExperimentType;
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
    }
}
