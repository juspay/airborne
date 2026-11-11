// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

use super::*;
use super::{control_center, operations, write_lock};
use diesel::{
    prelude::*,
    sql_types::{Jsonb, Text, Uuid as SqlUuid},
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/operations")]
pub async fn list(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Value>> {
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let ops = operations::load(&state, &org, &app, None).await?;
    Ok(Json(
        json!({"operations":ops.iter().map(write_lock::reader_details).collect::<Vec<_>>()}),
    ))
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Finding {
    DidNotApply,
    Applied,
}
#[derive(Deserialize)]
pub struct ResolveRequest {
    finding: Finding,
    reason: String,
    #[serde(default)]
    request_terminated: bool,
}
fn confirmed(
    op: &operations::Operation,
    exps: &[superposition_sdk::types::ExperimentResponse],
) -> bool {
    exps.iter()
        .any(|e| write_lock::experiment_matches(&control_center::snapshot(e), &op.data["expected"]))
}
// An operator verifies termination in upstream/proxy logs. Airborne independently
// checks the current upstream state. Absence or elapsed time is never automatic
// proof that a request cannot arrive later.
fn unchanged(
    op: &operations::Operation,
    exps: &[superposition_sdk::types::ExperimentResponse],
) -> bool {
    if let Some(id) = op.data["expected"]["id"].as_str() {
        return exps
            .iter()
            .find(|e| e.id == id)
            .is_some_and(|e| control_center::snapshot(e) == op.data["before"]);
    }
    let marker = op.data["expected"]["change_reason"].as_str().unwrap_or("");
    !marker.is_empty()
        && !exps.iter().any(|e| {
            write_lock::experiment_matches(
                &control_center::snapshot(e),
                &json!({"change_reason":marker}),
            ) || (!op.data["expected"]["description"].is_null()
                && e.description == op.data["expected"]["description"])
        })
}
#[authz(resource="release",action="recover",org_roles=["owner","admin"],app_roles=[])]
#[post("/operations/{id}/resolve")]
pub async fn resolve(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<Uuid>,
    req: Json<ResolveRequest>,
) -> airborne_types::Result<Json<Value>> {
    if !auth_response.is_super_admin
        && !auth_response
            .organisation
            .as_ref()
            .is_some_and(|o| o.is_admin_or_higher())
    {
        return Err(ABError::Forbidden("Organisation admin required".into()));
    }
    write_lock::validate_user_reason(&req.reason)?;
    if req.reason.trim().is_empty() {
        return Err(ABError::BadRequest("Recovery reason required".into()));
    }
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let id = path.into_inner();
    write_lock::locked_inner(&state,&org,&app,false,async {
        let op=operations::load(&state,&org,&app,None).await?.into_iter().find(|o|o.id==id).ok_or_else(||ABError::NotFound("Unresolved operation not found".into()))?;
        let (_,exps)=control_center::experiments(&state,&org,&app).await?;
        let applied=confirmed(&op,&exps) || write_lock::history_confirms(&state,&op).await?;
        if matches!(req.finding, Finding::DidNotApply) {
            verify_config_before(&state, &op).await?;
        }
        let (next,finding)=match req.finding {
            Finding::Applied if applied => ("confirmed","applied"),
            Finding::DidNotApply if req.request_terminated && !applied && unchanged(&op,&exps) => ("rejected","did_not_apply"),
            _ => return Err(ABError::Conflict("Upstream does not verify this finding. Applied requires the marked expected state; did_not_apply requires unchanged upstream state and confirmation that the original request has terminated. Inspect history before retrying.".into())),
        };
        let payload=json!({"operation_id":id,"finding":finding,"reason":req.reason.trim(),"request_terminated":req.request_terminated,"upstream_verified":true});
        let release=op.data["expected"]["id"].as_str().or(op.data["before"]["id"].as_str()).map(str::to_owned).unwrap_or_default();
        let (org,app,actor)=(org.clone(),app.clone(),auth_response.sub.clone());
        // Recovery is privileged: journal update and audit must commit together.
        write_lock::store(move |c| c.transaction::<_,ABError,_>(|c| {
            diesel::sql_query("UPDATE hyperotaserver.release_operations SET state=$1,data=jsonb_set(data,'{recovery}',$2),updated_at=now() WHERE id=$3 AND org_id=$4 AND app_id=$5 AND state='unresolved'")
                .bind::<Text,_>(next).bind::<Jsonb,_>(&payload).bind::<SqlUuid,_>(id).bind::<Text,_>(&org).bind::<Text,_>(&app).execute(c)?;
            diesel::sql_query("INSERT INTO hyperotaserver.release_events (id,org_id,app_id,release_id,action,actor,payload) VALUES ($1,$2,$3,$4,'operation_resolved',$5,$6)")
                .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&release).bind::<Text,_>(&actor).bind::<Jsonb,_>(&payload).execute(c)?;
            Ok(())
        })).await?;
        Ok(Json(json!({"operation_id":id,"state":next,"finding":finding})))
    }).await
}

// Old journals without config evidence cannot establish non-application.
async fn verify_config_before(
    state: &web::Data<AppState>,
    op: &operations::Operation,
) -> airborne_types::Result<()> {
    let before = &op.data["config_before"];
    if !before["defaults"].is_object() || !before["contexts"].is_object() {
        return Err(ABError::Conflict("Pre-write config evidence is missing. Inspect upstream history and repair affected config before audited recovery; experiment state alone cannot prove did_not_apply".into()));
    }
    let workspace = op.data["workspace"]
        .as_str()
        .ok_or_else(|| ABError::Conflict("Operation workspace missing".into()))?;
    check_config_before(before, &write_lock::config_values(state, workspace).await?)
}
fn check_config_before(before: &Value, actual: &Value) -> airborne_types::Result<()> {
    let mut keys = std::collections::BTreeSet::new();
    for section in ["defaults", "contexts"] {
        let b = before[section]
            .as_object()
            .ok_or_else(|| ABError::Conflict("Pre-write config evidence missing".into()))?;
        let a = actual[section]
            .as_object()
            .ok_or_else(|| ABError::Conflict("Current config evidence missing".into()))?;
        for key in b.keys().chain(a.keys()).filter(|k| b.get(*k) != a.get(*k)) {
            keys.insert(format!("{section}:{key}"));
            if section == "contexts" {
                for config in [
                    &before[section][key]["overrides"],
                    &actual[section][key]["overrides"],
                ] {
                    if let Some(config) = config.as_object() {
                        keys.extend(config.keys().cloned());
                    }
                }
            }
        }
    }
    if !keys.is_empty() {
        return Err(ABError::Conflict(format!("Upstream config changed for keys/contexts: {}. Writes remain paused. Verify the original request has terminated, inspect upstream history, and restore these keys/contexts to the saved pre-write values before retrying did_not_apply, or complete and verify the intended operation before resolving applied.", keys.into_iter().collect::<Vec<_>>().join(", "))));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn context_changes_and_missing_legacy_evidence_fail_closed() {
        let before = json!({"defaults":{},"contexts":{"ctx":{"overrides":{"settings":{"change_reason":"keep"}}}}});
        let actual = json!({"defaults":{},"contexts":{"ctx":{"overrides":{"settings":{"change_reason":"keep extra"}}}}});
        let error = format!("{:?}", check_config_before(&before, &actual).unwrap_err());
        assert!(error.contains("contexts:ctx") && error.contains("settings"));
        assert!(check_config_before(&Value::Null, &actual).is_err());
    }
    #[test]
    fn partial_default_config_change_refuses_rejection_even_with_unchanged_experiment() {
        let before =
            json!({"defaults":{"first":1,"later":{"change_reason":"original"}},"contexts":{}});
        assert!(check_config_before(&before, &before).is_ok());
        let error = check_config_before(
            &before,
            &json!({"defaults":{"first":2,"later":{"change_reason":"original"}},"contexts":{}}),
        )
        .unwrap_err();
        let message = format!("{error:?}");
        assert!(message.contains("first"));
        assert!(message.contains("restore these keys"));
        assert!(
            check_config_before(&before, &json!({"defaults":{"first":1},"contexts":{}})).is_err()
        );
    }
    #[test]
    fn recovery_refuses_contradictory_claims_and_requires_exact_before_state() {
        let mut r = super::super::control_center::tests::make("123", 2, "ios");
        r.change_reason = "test [Airborne operation 00000000-0000-4000-8000-000000000001]".into();
        let before = control_center::snapshot(&r);
        let mut op = operations::Operation {
            id: Uuid::new_v4(),
            state: "unresolved".into(),
            data: json!({"before":before,"expected":{"id":"123","status":"INPROGRESS","change_reason":"own-marker"}}),
        };
        assert!(unchanged(&op, std::slice::from_ref(&r)));
        assert!(!confirmed(&op, std::slice::from_ref(&r)));
        op.data["before"]["traffic_percentage"] = json!(17);
        assert!(!unchanged(&op, std::slice::from_ref(&r)));
        op.data["expected"] = before;
        assert!(confirmed(&op, &[r]));
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AbandonRollback {
    reason: String,
}
// An edited active replacement must first be discarded. Never clear a row
// whose replacement can still serve, or whose write outcome is unresolved.
fn terminal_replacement<'a>(
    op: &operations::Operation,
    exps: &'a [superposition_sdk::types::ExperimentResponse],
) -> Option<&'a superposition_sdk::types::ExperimentResponse> {
    if op.state == "completed" {
        return None;
    }
    let replacement = if let Some(id) = op.data["replacement_release_id"].as_str() {
        exps.iter().find(|e| e.id == id)
    } else {
        exps.iter()
            .find(|e| e.description == format!("Rollback operation {}", op.id))
    };
    replacement.filter(|e| {
        e.status == ExperimentStatusType::Discarded
            || (e.status == ExperimentStatusType::Concluded
                && e.chosen_variant.as_ref().is_some_and(|chosen| {
                    e.variants.iter().any(|v| {
                        v.variant_type == superposition_sdk::types::VariantType::Control
                            && &v.id == chosen
                    })
                }))
    })
}
#[authz(resource="release",action="recover",org_roles=["owner","admin"],app_roles=[])]
#[post("/operations/rollback/{release_id}/abandon")]
pub async fn abandon_rollback(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<String>,
    body: Json<AbandonRollback>,
) -> airborne_types::Result<Json<Value>> {
    if !auth_response.is_super_admin
        && !auth_response
            .organisation
            .as_ref()
            .is_some_and(|o| o.is_admin_or_higher())
    {
        return Err(ABError::Forbidden("Organisation admin required".into()));
    }
    write_lock::validate_user_reason(&body.reason)?;
    if body.reason.trim().is_empty() {
        return Err(ABError::BadRequest("Recovery reason required".into()));
    }
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let id = path.into_inner();
    write_lock::locked_inner(&state,&org,&app,true,async {
        let op=operations::load(&state,&org,&app,Some(&id)).await?.pop().ok_or_else(||ABError::NotFound("Rollback operation not found".into()))?;
        let (_,exps)=control_center::experiments(&state,&org,&app).await?;
        let replacement=terminal_replacement(&op,&exps).ok_or_else(||ABError::Conflict("Discard the replacement or conclude it to control before abandoning; completed rollbacks cannot be abandoned".into()))?.id.clone();
        let (o,a,actor,reason)=(org.clone(),app.clone(),auth_response.sub.clone(),body.reason.clone());
        write_lock::store(move|c| c.transaction::<_,ABError,_>(|c| {
            diesel::sql_query("DELETE FROM hyperotaserver.release_operations WHERE id=$1 AND org_id=$2 AND app_id=$3").bind::<SqlUuid,_>(op.id).bind::<Text,_>(&o).bind::<Text,_>(&a).execute(c)?;
            diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,$4,'rollback_abandoned',$5,$6)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(o).bind::<Text,_>(a).bind::<Text,_>(id).bind::<Text,_>(actor).bind::<Jsonb,_>(json!({"reason":reason,"operation_id":op.id,"replacement_release_id":replacement,"previous_state":op.state,"previous_stage":op.data["stage"]})).execute(c)?;
            Ok(())
        })).await?;
        Ok(Json(json!({"status":"abandoned"})))
    }).await
}

#[cfg(test)]
mod abandonment_tests {
    use super::*;
    #[test]
    fn only_terminal_nonserving_replacements_can_be_abandoned() {
        let op = operations::Operation {
            id: Uuid::new_v4(),
            state: "planned".into(),
            data: json!({"replacement_release_id":"replacement"}),
        };
        let mut r = control_center::tests::make("replacement", 1, "ios");
        assert!(terminal_replacement(&op, &[r.clone()]).is_none());
        r.status = ExperimentStatusType::Inprogress;
        assert!(terminal_replacement(&op, &[r.clone()]).is_none());
        r.status = ExperimentStatusType::Discarded;
        assert!(terminal_replacement(&op, &[r.clone()]).is_some());
        r.status = ExperimentStatusType::Concluded;
        r.chosen_variant = None;
        assert!(
            terminal_replacement(&op, &[r.clone()]).is_none(),
            "unreported chosen variant is not proof of control"
        );
        let mut control = r.variants[0].clone();
        control.id = "control".into();
        control.variant_type = superposition_sdk::types::VariantType::Control;
        r.variants.push(control);
        r.chosen_variant = Some("control".into());
        assert!(terminal_replacement(&op, &[r]).is_some());
        assert!(terminal_replacement(&op, &[]).is_none());
    }
}
