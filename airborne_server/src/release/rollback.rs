// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

use super::control_center::*;
use super::operations::{self, Operation};
use super::write_lock;
use super::*;
use futures::{stream, StreamExt};
use serde_json::json;
use superposition_sdk::types::{ExperimentResponse, ExperimentType, VariantType};
use uuid::Uuid;

fn blocked(code: &str, message: &str, current: Option<&str>) -> Value {
    json!({"code":code,"message":message,"current_live_release_id":current})
}
fn base(exp: &ExperimentResponse) -> Value {
    json!({"action":null,"current_package_version":version(exp),"resulting_package_version":null,"reconciled_keys":null,"blocked":null})
}
fn apply_lineage(p: &mut Value, parent: Option<&str>, description: &str) {
    if parent.is_some() || description.starts_with("Rollback operation ") {
        p["rollback_of"] = json!(parent);
        p["blocked"] = blocked("rollback_chain", "This release is a rollback replacement. Rolling it back can restore the rejected release. Create an explicitly reviewed release with the intended package instead.", None);
    }
}
// Both GET and POST call this function. It only reads upstream/journal state.
pub(super) async fn plan(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    exps: &[ExperimentResponse],
    existing: Option<&Operation>,
) -> airborne_types::Result<Value> {
    let mut p = plan_inner(state, org, app, id, exps, existing).await?;
    if !p["blocked"].is_null() || existing.is_some_and(|o| o.state == "completed") {
        return Ok(p);
    }
    // Discard/control keep existing content, including a pristine first-release
    // control with an empty index. Probe only artifacts being restored.
    if p["action"] != "rereleased" {
        return Ok(p);
    }
    let values = p["overrides"]["EXPERIMENTAL"].clone();
    let check = check_artifacts(state, org, app, &values);
    match tokio::time::timeout(std::time::Duration::from_secs(10), check).await {
        Ok(Ok(())) => {}
        Ok(Err(message)) => {
            p["blocked"] = blocked(
                if message.starts_with("Unknown:") {
                    "artifact_verification_unknown"
                } else {
                    "missing_files"
                },
                &message,
                None,
            )
        }
        Err(_) => {
            p["blocked"] = blocked(
                "artifact_verification_unknown",
                "Artifact verification timed out; retry verification",
                None,
            )
        }
    }
    Ok(p)
}
async fn check_artifacts(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    values: &Value,
) -> std::result::Result<(), String> {
    let mut keys = std::collections::BTreeSet::new();
    if let Some(key) = values["package.index"].as_str() {
        keys.insert(key.to_owned());
    }
    for name in ["package.important", "package.lazy", "resources"] {
        if let Some(list) = values[name].as_array() {
            for key in list {
                if let Some(key) = key.as_str() {
                    keys.insert(key.to_owned());
                }
            }
        }
    }
    if keys.is_empty() {
        return Err("Restored package has no index file".into());
    }
    // Bypass Redis: stale metadata must not hide deleted records.
    let files = utils::get_files_by_file_keys_async(
        state.db_pool.clone(),
        &None,
        org.into(),
        app.into(),
        keys.iter().cloned().collect(),
    )
    .await
    .map_err(|_| "Cannot read restored file records".to_string())?;
    if files.len() != keys.len() {
        return Err("Restored file records are missing".into());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|_| "Cannot initialize artifact verification".to_string())?;
    let mut checks = stream::iter(files.into_iter().map(|file| {
        let client = client.clone();
        async move {
            if file.size <= 0 || file.checksum.is_empty() {
                return Err(format!("Restored file {} is incomplete", file.file_path));
            }
            let response = client.head(&file.url).send().await.map_err(|_| {
                format!(
                    "Unknown: restored file {} could not be verified",
                    file.file_path
                )
            })?;
            if !response.status().is_success() {
                return Err(format!(
                    "Restored file {} is inaccessible (HTTP {})",
                    file.file_path,
                    response.status()
                ));
            }
            Ok(())
        }
    }))
    .buffer_unordered(8);
    while let Some(result) = checks.next().await {
        result?;
    }
    Ok(())
}
pub(super) async fn plan_inner(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    exps: &[ExperimentResponse],
    existing: Option<&Operation>,
) -> airborne_types::Result<Value> {
    if let Some(op) = existing {
        if op.data["preview"]["reconciled_keys"].is_null() {
            return Err(ABError::InternalServerError(
                "Rollback metadata missing; inspect the operation journal before proceeding".into(),
            ));
        }
        let mut p = op.data["preview"].clone();
        if needs_registration(op, exps) {
            let workspace = crate::utils::workspace::get_workspace_name_for_application_db(
                state.db_pool.clone(),
                app.into(),
                org.into(),
            )
            .await?;
            let keys = write_lock::bounded_read(
                state
                    .superposition_client
                    .list_default_configs()
                    .org_id(&state.env.superposition_org_id)
                    .workspace_id(workspace)
                    .all(true)
                    .send(),
            )
            .await?
            .map_err(sp_error)?
            .data;
            validate_registration(&mut p, &keys);
        }
        return Ok(p);
    }
    let exp = exps
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| ABError::NotFound("Release not found".into()))?;
    let mut p = base(exp);
    let parent = operations::rollback_parent(state, org, app, id).await?;
    // Also fail closed for a create response lost before replacement ID was saved.
    apply_lineage(&mut p, parent.as_deref(), &exp.description);
    if !p["blocked"].is_null() {
        return Ok(p);
    }

    let choice = match decision(&exp.status, live(exp)) {
        Ok(c) => c,
        Err(_) => {
            p["blocked"] = blocked(
                "incompatible",
                "Release is discarded or concluded on control",
                None,
            );
            return Ok(p);
        }
    };
    p["action"] = json!(match choice {
        RollbackDecision::Discard => "discarded",
        RollbackDecision::Control => "concluded_control",
        RollbackDecision::Rerelease => "rereleased",
    });
    p["reconciled_keys"] = json!({"kept_current":[],"dropped":[]});
    if choice == RollbackDecision::Rerelease && current_live(exp, exps).is_none_or(|e| e.id != id) {
        p["blocked"] = blocked(
            "superseded",
            "This release has been superseded",
            current_live(exp, exps).map(|e| e.id.as_str()),
        );
        return Ok(p);
    }
    if exps.iter().any(|e| {
        e.id != id
            && context(e) == context(exp)
            && matches!(
                e.status,
                ExperimentStatusType::Created | ExperimentStatusType::Inprogress
            )
    }) {
        p["blocked"] = blocked(
            "ongoing",
            "Another release is ongoing for these dimensions",
            None,
        );
        return Ok(p);
    }
    if choice != RollbackDecision::Rerelease {
        p["resulting_package_version"] = exp
            .variants
            .iter()
            .find(|v| v.variant_type == VariantType::Control)
            .map(|v| {
                json!(utils::extract_integer_from_experiment::<i64>(
                    &Some(v),
                    "package.version"
                ))
            })
            .unwrap_or(Value::Null);
        return Ok(p);
    }
    let previous = exps
        .iter()
        .filter(|e| {
            live(e)
                && context(e) == context(exp)
                && (e.last_modified, &e.id) < (exp.last_modified, &exp.id)
        })
        .max_by_key(|e| (e.last_modified, &e.id));
    let Some(previous) = previous else {
        p["blocked"] = blocked("no_predecessor", "No previous live release exists", None);
        return Ok(p);
    };
    let workspace = crate::utils::workspace::get_workspace_name_for_application_db(
        state.db_pool.clone(),
        app.into(),
        org.into(),
    )
    .await?;
    let client = &state.release_superposition_client;
    let sporg = &state.env.superposition_org_id;
    let registered = client
        .list_default_configs()
        .org_id(sporg)
        .workspace_id(&workspace)
        .all(true)
        .send()
        .await
        .map_err(sp_error)?
        .data;
    let resolved = exp
        .context
        .iter()
        .fold(
            client
                .get_resolved_config()
                .org_id(sporg)
                .workspace_id(&workspace)
                .context("variantIds", Document::Array(vec![])),
            |b, (k, v)| b.context(k, v.clone()),
        )
        .send()
        .await
        .map_err(sp_error)?
        .config;
    let Document::Object(current) = resolved else {
        p["blocked"] = blocked(
            "incompatible",
            "Current configuration is unavailable; repair the workspace",
            None,
        );
        return Ok(p);
    };
    let old = &experimental(previous)
        .ok_or_else(|| ABError::InternalServerError("Previous variant missing".into()))?
        .overrides;
    match reconcile(
        old,
        &current,
        &registered.iter().map(|k| k.key.clone()).collect::<Vec<_>>(),
    ) {
        Err(message) => p["blocked"] = blocked("incompatible", &message, None),
        Ok((restored, changes)) => {
            p["resulting_package_version"] = json!(version(previous));
            p["reconciled_keys"] = changes;
            let control = current
                .into_iter()
                .filter(|(k, _)| restored.contains_key(k))
                .collect();
            p["overrides"] = override_values(&control, &restored);
            validate_registration(&mut p, &registered);
        }
    }
    Ok(p)
}
pub(super) async fn approval_plan(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    exps: &[ExperimentResponse],
) -> airborne_types::Result<Value> {
    plan(state, org, app, id, exps, None).await
}
fn needs_registration(op: &Operation, exps: &[ExperimentResponse]) -> bool {
    op.state != "completed"
        && op.data["preview"]["action"] == "rereleased"
        && replacement(op, exps).is_none()
}
fn validate_registration(
    p: &mut Value,
    registered: &[superposition_sdk::types::DefaultConfigResponse],
) {
    let keys = registered
        .iter()
        .map(|k| k.key.as_str())
        .collect::<std::collections::BTreeSet<_>>();
    for values in ["CONTROL", "EXPERIMENTAL"] {
        let actual = p["overrides"][values].as_object().map(|m| {
            m.keys()
                .map(String::as_str)
                .collect::<std::collections::BTreeSet<_>>()
        });
        if actual.as_ref() != Some(&keys) {
            p["blocked"]=blocked("incompatible","Registered keys changed since the rollback was planned. Inspect the operation's saved plan and replacement before deciding how to restore the configuration",None);
            return;
        }
        for key in registered {
            let value = &p["overrides"][values][&key.key];
            if key.value_validation_function_name.is_some()
                || key.value_compute_function_name.is_some()
            {
                p["blocked"]=blocked("incompatible", &format!("Key {} uses an upstream function with no side-effect-free validation API; obtain a compatible validated configuration before rolling back",key.key),None);
                return;
            }
            let schema = utils::document_to_value(&Document::Object(key.schema.clone()))
                .unwrap_or(Value::Null);
            if !schema_matches(&schema, value) {
                p["blocked"]=blocked("incompatible",&format!("Historical value for {} cannot be verified against its current registered schema (unsupported constraints require operator review)",key.key),None);
                return;
            }
        }
    }
}
// Fail closed for constraints we cannot evaluate locally. Preview never creates
// an experiment to ask upstream to validate it.
fn schema_matches(schema: &Value, value: &Value) -> bool {
    let Some(obj) = schema.as_object() else {
        return schema == &Value::Bool(true);
    };
    // Reject unsupported assertions rather than advertising a preview that an
    // authoritative upstream schema/function check could contradict.
    if obj.keys().any(|k| {
        ![
            "type",
            "enum",
            "const",
            "properties",
            "required",
            "additionalProperties",
            "items",
            "title",
            "description",
            "default",
            "$schema",
            "pattern",
        ]
        .contains(&k.as_str())
    }) {
        return false;
    }
    if obj.get("pattern").is_some_and(|p| p.as_str() != Some(".*")) {
        return false;
    }
    let type_ok = |t: &str| match t {
        "string" => value.is_string(),
        "integer" => value.as_i64().is_some() || value.as_u64().is_some(),
        "number" => value.is_number(),
        "boolean" => value.is_boolean(),
        "null" => value.is_null(),
        "array" => value.is_array(),
        "object" => value.is_object(),
        _ => false,
    };
    let ok = match obj.get("type") {
        Some(Value::String(t)) => type_ok(t),
        Some(Value::Array(ts)) => ts.iter().filter_map(Value::as_str).any(type_ok),
        None => true,
        _ => false,
    };
    if !ok
        || obj
            .get("enum")
            .is_some_and(|e| e.as_array().is_none_or(|a| !a.contains(value)))
        || obj.get("const").is_some_and(|c| c != value)
    {
        return false;
    }
    if let Some(values) = value.as_object() {
        if obj
            .get("required")
            .and_then(Value::as_array)
            .is_some_and(|keys| {
                keys.iter()
                    .any(|k| k.as_str().is_none_or(|k| !values.contains_key(k)))
            })
        {
            return false;
        }
        for (key, v) in values {
            if let Some(s) = obj.get("properties").and_then(|p| p.get(key)) {
                if !schema_matches(s, v) {
                    return false;
                }
            } else if let Some(s) = obj.get("additionalProperties") {
                if s == &Value::Bool(false) || (s.is_object() && !schema_matches(s, v)) {
                    return false;
                }
            }
        }
    }
    if let (Some(values), Some(items)) = (value.as_array(), obj.get("items")) {
        if !values.iter().all(|v| schema_matches(items, v)) {
            return false;
        }
    }
    true
}
fn public_preview(mut p: Value) -> Value {
    if let Some(o) = p.as_object_mut() {
        o.remove("overrides");
    }
    p
}

#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/releases/{release_id}/rollback-preview")]
pub async fn preview(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<String>,
) -> airborne_types::Result<Json<Value>> {
    let (org, app) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let id = path.into_inner();
    let (_, exps) = experiments(&state, &org, &app).await?;
    let existing = operations::load(&state, &org, &app, Some(&id)).await?;
    let existing = match existing.into_iter().next() {
        Some(op) if resumable(&state, &org, &app, &op, &exps).await? => vec![op],
        _ => vec![],
    };
    let mut p = plan(&state, &org, &app, &id, &exps, existing.first()).await?;
    if existing.first().is_none_or(|op| op.state != "completed") {
        if let Err(error) = write_lock::resolve(&state, &org, &app, false).await {
            let ABError::ReleaseOperation { body, .. } = error else {
                return Err(error);
            };
            p["blocked"] = blocked(
                "unresolved",
                body["message"].as_str().unwrap_or("Unresolved operation"),
                None,
            );
            p["blocked"]["operation_id"] = body["operation_id"].clone();
        }
        if let Some(op) = existing.first() {
            if let Err(ABError::ReleaseOperation { body, .. }) = validate(op, &exps) {
                p["blocked"] = blocked(
                    "incompatible",
                    body["message"].as_str().unwrap_or("Replacement changed"),
                    None,
                );
                p["blocked"]["replacement_release_id"] = body["replacement_release_id"].clone();
            }
        }
    }
    // Security exclusions apply on devices, not on the server: a rollback to an excluded package is
    // still served, and upgraded SDKs refuse to run it. The dialog needs the list to say so. `null`
    // means the lookup failed.
    p["blocked_package_versions"] = json!(crate::telemetry::blocked(&state, &org, &app).await.ok());
    Ok(Json(public_preview(p)))
}
pub(super) async fn resumable(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    op: &Operation,
    exps: &[ExperimentResponse],
) -> airborne_types::Result<bool> {
    if owns_upstream(op, exps) {
        return Ok(true);
    }
    if let Some(marker) = op.data["transition_expected"]["change_reason"].as_str() {
        if exps
            .iter()
            .any(|e| write_lock::experiment_matches(&snapshot(e), &op.data["transition_expected"]))
        {
            return Ok(true);
        }
        return operations::has_confirmed(state, org, app, marker).await;
    }
    Ok(false)
}
fn owns_upstream(op: &Operation, exps: &[ExperimentResponse]) -> bool {
    op.state == "completed"
        || replacement(op, exps).is_some()
        || !op.data["observed"].is_null()
        || exps
            .iter()
            .any(|e| write_lock::experiment_matches(&snapshot(e), &op.data["transition_expected"]))
}
fn replacement<'a>(
    op: &Operation,
    exps: &'a [ExperimentResponse],
) -> Option<&'a ExperimentResponse> {
    exps.iter().find(|e| {
        Some(e.id.as_str()) == op.data["replacement_release_id"].as_str()
            || e.description == format!("Rollback operation {}", op.id)
    })
}
fn changed(op: &Operation, id: Option<&str>) -> ABError {
    ABError::ReleaseOperation {
        status: 409,
        body: json!({"code":"replacement_changed","message":"The rollback replacement changed outside this operation. Inspect its variants, rollout target, chosen variant and change history; do not resume it automatically.","operation_id":op.id,"replacement_release_id":id}),
    }
}
fn validate(op: &Operation, exps: &[ExperimentResponse]) -> airborne_types::Result<()> {
    if replacement(op, exps).is_none() {
        let source = exps.iter().find(|e| e.id == op.data["source"]["id"]);
        if source.is_none_or(|e| {
            snapshot(e) != op.data["source"]
                && !write_lock::experiment_matches(&snapshot(e), &op.data["transition_expected"])
        }) {
            return Err(changed(op, op.data["source"]["id"].as_str()));
        }
        if let Some(source) = source {
            if op.data["preview"]["action"] == "rereleased"
                && (current_live(source, exps).is_none_or(|e| e.id != source.id)
                    || exps.iter().any(|e| {
                        e.id != source.id
                            && context(e) == context(source)
                            && matches!(
                                e.status,
                                ExperimentStatusType::Created | ExperimentStatusType::Inprogress
                            )
                    }))
            {
                return Err(changed(op, None));
            }
        }
    }
    if let Some(r) = replacement(op, exps) {
        let actual = snapshot(r);
        if op.data["observed"] != actual
            && !write_lock::experiment_matches(&actual, &op.data["transition_expected"])
        {
            return Err(changed(op, Some(&r.id)));
        }
        // A later unrelated release must never be overwritten by a retry.
        if exps.iter().any(|e| {
            e.id != r.id
                && e.id != op.data["source"]["id"]
                && context(e) == context(r)
                && (matches!(
                    e.status,
                    ExperimentStatusType::Created | ExperimentStatusType::Inprogress
                ) || (live(e) && e.last_modified > r.last_modified))
        }) {
            return Err(changed(op, Some(&r.id)));
        }
    } else if op.data["replacement_release_id"].is_string() {
        return Err(changed(op, op.data["replacement_release_id"].as_str()));
    }
    Ok(())
}
async fn save(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    op: &Operation,
) -> airborne_types::Result<()> {
    operations::save(state, org, app, "rollback", id, op).await
}
async fn transition(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    op: &mut Operation,
    expected: Value,
    stage: &str,
) -> airborne_types::Result<()> {
    op.data["transition_expected"] = expected;
    op.data["transition_expected"]["change_reason"] = json!(write_lock::reason());
    op.data["stage"] = json!(stage);
    save(state, org, app, id, op).await
}
pub async fn run(
    state: &web::Data<AppState>,
    auth: &AuthResponse,
    org: &str,
    app: &str,
    id: &str,
    reason: &str,
) -> airborne_types::Result<actix_web::HttpResponse> {
    write_lock::validate_user_reason(reason)?;
    super::maker_checker::gate(state, org, app, "rollback", id, &json!({})).await?;
    let (workspace, mut exps) = experiments(state, org, app).await?;
    let stored = operations::load(state, org, app, Some(id)).await?.pop();
    let row_id = stored.as_ref().map(|o| o.id);
    let existing = match stored {
        Some(op) if resumable(state, org, app, &op, &exps).await? => Some(op),
        _ => None,
    };
    if let Some(op) = &existing {
        if op.state == "completed" {
            let mut result = op.data["result"].clone();
            let current = exps
                .iter()
                .find(|e| e.id == id)
                .and_then(|s| current_live(s, &exps));
            result["current_live_release_id"] = current.map(|e| json!(e.id)).unwrap_or(Value::Null);
            result["later_release_id"] = current
                .filter(|e| Some(e.id.as_str()) != result["new_release_id"].as_str() && e.id != id)
                .map(|e| json!(e.id))
                .unwrap_or(Value::Null);
            return Ok(actix_web::HttpResponse::Ok().json(result));
        }
        validate(op, &exps)?;
    }
    let p = plan(state, org, app, id, &exps, existing.as_ref()).await?;
    if !p["blocked"].is_null() {
        let code = p["blocked"]["code"].as_str().unwrap_or("incompatible");
        return Err(ABError::ReleaseOperation {
            status: if matches!(code, "no_predecessor" | "incompatible") && p["action"].is_string()
            {
                422
            } else {
                409
            },
            body: p["blocked"].clone(),
        });
    }
    let source = exps
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| ABError::NotFound("Release not found".into()))?
        .clone();
    let mut op = existing.unwrap_or(Operation {
        id: row_id.unwrap_or_else(Uuid::new_v4),
        state: "planned".into(),
        data: json!({"source":snapshot(&source),"preview":p,"stage":"planned","reason":reason}),
    });
    save(state, org, app, id, &op).await?;
    let client = &state.release_superposition_client;
    let sporg = &state.env.superposition_org_id;
    let action = op.data["preview"]["action"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    if action == "rereleased" {
        if replacement(&op, &exps).is_none() {
            let overrides = &op.data["preview"]["overrides"];
            let variants = [
                ("control", VariantType::Control, "CONTROL"),
                ("rollback", Experimental, "EXPERIMENTAL"),
            ]
            .into_iter()
            .map(|(id, typ, key)| {
                VariantBuilder::default()
                    .id(id)
                    .variant_type(typ)
                    .set_overrides(Some(
                        overrides[key]
                            .as_object()
                            .unwrap()
                            .iter()
                            .map(|(k, v)| (k.clone(), utils::value_to_document(v)))
                            .collect(),
                    ))
                    .build()
                    .map_err(sp_error)
            })
            .collect::<airborne_types::Result<Vec<_>>>()?;
            let description = format!("Rollback operation {}", op.id);
            let expected = json!({"description":description,"context":context(&source),"variants":op.data["preview"]["overrides"],"status":"CREATED","traffic_percentage":0});
            transition(state, org, app, id, &mut op, expected.clone(), "create").await?;
            let call = client
                .create_experiment()
                .org_id(sporg)
                .workspace_id(&workspace)
                .name(&source.name)
                .experiment_type(ExperimentType::Default)
                .description(&description)
                .change_reason(write_lock::user_reason(reason)?)
                .idempotency_key(op.id.to_string())
                .set_context(Some(source.context.clone()))
                .set_variants(Some(variants))
                .send();
            // The replacement's "created" row commits with the journal's confirmed step.
            let audit = operations::Audit::new(
                auth,
                "created",
                json!({"package_version":op.data["preview"]["resulting_package_version"],"rollback_of":id,"operation_id":op.id,"reconciled_keys":op.data["preview"]["reconciled_keys"],"reason":reason}),
            );
            let created = Box::pin(write_lock::mutate_created(
                expected,
                audit,
                |r| r.id.to_string(),
                call,
            ))
            .await?;
            op.data["replacement_release_id"] = json!(created.id);
            exps = experiments(state, org, app).await?.1;
        }
        if let Some(r) = replacement(&op, &exps) {
            super::maker_checker::inherit_predecessor(state, org, app, id, &r.id).await?;
        }
        validate(&op, &exps)?;
        let mut r = replacement(&op, &exps)
            .ok_or_else(|| changed(&op, None))?
            .clone();
        op.data["replacement_release_id"] = json!(r.id);
        op.data["observed"] = snapshot(&r);
        op.data["transition_expected"] = Value::Null;
        save(state, org, app, id, &op).await?;
        if r.status == ExperimentStatusType::Created {
            let mut expected = snapshot(&r);
            expected.as_object_mut().unwrap().remove("revision");
            expected["status"] = json!("INPROGRESS");
            expected["traffic_percentage"] = json!(50);
            transition(state, org, app, id, &mut op, expected.clone(), "ramp").await?;
            let call = client
                .ramp_experiment()
                .org_id(sporg)
                .workspace_id(&workspace)
                .id(&r.id)
                .traffic_percentage(50)
                .change_reason(write_lock::user_reason(reason)?)
                .send();
            let audit = operations::Audit::new(
                auth,
                "ramped",
                json!({"traffic_percentage":50,"from_target":0,"package_version":super::control_center::package_version_of(&r.variants),"reason":reason}),
            );
            Box::pin(write_lock::mutate(expected, Some(audit), call)).await?;
            exps = experiments(state, org, app).await?.1;
            validate(&op, &exps)?;
            r = replacement(&op, &exps).unwrap().clone();
            op.data["observed"] = snapshot(&r);
            op.data["transition_expected"] = Value::Null;
            save(state, org, app, id, &op).await?;
        }
        if !live(&r) {
            let chosen = experimental(&r)
                .ok_or_else(|| changed(&op, Some(&r.id)))?
                .id
                .clone();
            let mut expected = snapshot(&r);
            expected.as_object_mut().unwrap().remove("revision");
            expected["status"] = json!("CONCLUDED");
            expected["chosen_variant"] = json!(chosen);
            transition(state, org, app, id, &mut op, expected.clone(), "conclude").await?;
            let call = client
                .conclude_experiment()
                .org_id(sporg)
                .workspace_id(&workspace)
                .id(&r.id)
                .chosen_variant(&chosen)
                .change_reason(write_lock::user_reason(reason)?)
                .send();
            let audit = operations::Audit::new(
                auth,
                "concluded",
                json!({"chosen_variant":chosen,"package_version":super::control_center::package_version_of(&r.variants),"reason":reason}),
            );
            Box::pin(write_lock::mutate(expected, Some(audit), call)).await?;
        }
        // Confirm authoritative state and the effective config, including retained
        // current keys, before recording a completed rollback.
        exps = experiments(state, org, app).await?.1;
        validate(&op, &exps)?;
        let restored = replacement(&op, &exps).ok_or_else(|| changed(&op, None))?;
        if !live(restored) || current_live(restored, &exps).is_none_or(|e| e.id != restored.id) {
            return Err(ABError::InternalServerError(
                "Replacement is not the current live release; inspect upstream before retrying"
                    .into(),
            ));
        }
        Box::pin(verify_effect(
            state,
            &workspace,
            &source,
            &op.data["preview"]["overrides"]["EXPERIMENTAL"],
        ))
        .await?;
    } else {
        let expected = if action == "discarded" {
            json!({"id":id,"status":"DISCARDED"})
        } else {
            json!({"id":id,"status":"CONCLUDED","chosen_variant":source.variants.iter().find(|v|v.variant_type==VariantType::Control).ok_or_else(||ABError::InternalServerError("Control missing".into()))?.id})
        };
        // A committed terminal transition is recovered before considering source status.
        if !write_lock::experiment_matches(&snapshot(&source), &op.data["transition_expected"]) {
            if snapshot(&source) != op.data["source"] {
                return Err(changed(&op, Some(id)));
            }
            transition(state, org, app, id, &mut op, expected.clone(), &action).await?;
            if action == "discarded" {
                let call = client
                    .discard_experiment()
                    .org_id(sporg)
                    .workspace_id(&workspace)
                    .id(id)
                    .change_reason(write_lock::user_reason(reason)?)
                    .send();
                let audit = operations::Audit::new(
                    auth,
                    "discarded",
                    json!({"package_version":super::control_center::package_version_of(&source.variants),"reason":reason}),
                );
                Box::pin(write_lock::mutate(expected, Some(audit), call)).await?;
            } else {
                let call = client
                    .conclude_experiment()
                    .org_id(sporg)
                    .workspace_id(&workspace)
                    .id(id)
                    .chosen_variant(
                        op.data["transition_expected"]["chosen_variant"]
                            .as_str()
                            .unwrap(),
                    )
                    .change_reason(write_lock::user_reason(reason)?)
                    .send();
                let audit = operations::Audit::new(
                    auth,
                    "concluded",
                    json!({"package_version":super::control_center::package_version_of(&source.variants),"reason":reason}),
                );
                Box::pin(write_lock::mutate(expected, Some(audit), call)).await?;
            }
        }
    }
    let result = json!({"action":action,"release_id":id,"rolled_back_to_package_version":op.data["preview"]["resulting_package_version"],"new_release_id":op.data["replacement_release_id"],"reconciled_keys":op.data["preview"]["reconciled_keys"]});
    op.advance("completed")?;
    op.data["result"] = result.clone();
    op.data["stage"] = json!("completed");
    // Terminal event is durable before completion. Retry deduplicates by operation/action.
    required_event(state, auth, id, "rolled_back",
        json!({"reason":reason,"operation_id":op.id,"package_version":super::control_center::package_version_of(&source.variants),"result":result,"approval":super::maker_checker::audit_context()})).await?;
    save(state, org, app, id, &op).await?;
    Ok(actix_web::HttpResponse::Ok().json(result))
}

async fn verify_effect(
    state: &web::Data<AppState>,
    workspace: &str,
    source: &ExperimentResponse,
    expected: &Value,
) -> airborne_types::Result<()> {
    let resolved = source
        .context
        .iter()
        .fold(
            state
                .release_superposition_client
                .get_resolved_config()
                .org_id(&state.env.superposition_org_id)
                .workspace_id(workspace)
                .context("variantIds", Document::Array(vec![])),
            |b, (k, v)| b.context(k, v.clone()),
        )
        .send()
        .await
        .map_err(sp_error)?
        .config;
    let actual = utils::document_to_value(&resolved).ok_or_else(|| {
        ABError::InternalServerError(
            "Effective config unavailable; retry to verify replacement".into(),
        )
    })?;
    if !write_lock::contains(&actual, expected) {
        return Err(ABError::InternalServerError("Replacement concluded but its full configuration is not effective. Inspect overlapping contexts and the resolved configuration in Superposition before retrying".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rollback_lineage_blocks_restoring_rejected_content() {
        let mut p = json!({"blocked":null});
        apply_lineage(&mut p, Some("bad-release"), "renamed");
        assert_eq!(p["blocked"]["code"], "rollback_chain");
        assert_eq!(p["rollback_of"], "bad-release");
        let mut lost = json!({"blocked":null});
        apply_lineage(&mut lost, None, "Rollback operation lost-response");
        assert_eq!(lost["blocked"]["code"], "rollback_chain");
        let mut normal = json!({"blocked":null});
        apply_lineage(&mut normal, None, "Release");
        assert!(normal["blocked"].is_null());
    }
    fn replacement_fixture() -> (Operation, ExperimentResponse) {
        let mut r = super::super::control_center::tests::make("replacement", 2, "ios");
        r.status = ExperimentStatusType::Created;
        r.traffic_percentage = 0;
        r.chosen_variant = None;
        r.change_reason = "test [Airborne operation 00000000-0000-4000-8000-000000000001]".into();
        let mut op = Operation {
            id: Uuid::new_v4(),
            state: "planned".into(),
            data: json!({"source":{"id":"source"},"preview":{"action":"rereleased","reconciled_keys":{"kept_current":["added"],"dropped":["removed"]}},"replacement_release_id":"replacement"}),
        };
        op.data["observed"] = snapshot(&r);
        (op, r)
    }
    #[test]
    fn a_pristine_plan_does_not_pin_the_source() {
        let (mut op, mut r) = replacement_fixture();
        op.data["replacement_release_id"] = Value::Null;
        op.data["observed"] = Value::Null;
        r.id = "source".into();
        op.data["source"] = snapshot(&r);
        r.traffic_percentage = 10;
        r.change_reason = "human ramp".into();
        assert!(!owns_upstream(&op, std::slice::from_ref(&r)));
        r.change_reason = "test [Airborne operation 00000000-0000-4000-8000-000000000001]".into();
        op.data["transition_expected"] = snapshot(&r);
        assert!(owns_upstream(&op, &[r]));
    }
    #[test]
    fn registry_drift_is_only_validated_before_replacement_creation() {
        let (mut op, r) = replacement_fixture();
        assert!(!needs_registration(&op, std::slice::from_ref(&r)));
        op.data["replacement_release_id"] = Value::Null;
        assert!(needs_registration(&op, &[]));
        op.state = "completed".into();
        assert!(!needs_registration(&op, &[]));
    }
    #[test]
    fn recorded_created_resumes() {
        let (op, r) = replacement_fixture();
        assert!(validate(&op, &[r]).is_ok());
    }
    #[test]
    fn create_before_record_crash_preserves_expected_contents_and_disclosure() {
        let (mut op, mut r) = replacement_fixture();
        r.description = format!("Rollback operation {}", op.id);
        op.data.as_object_mut().unwrap().remove("observed");
        op.data
            .as_object_mut()
            .unwrap()
            .remove("replacement_release_id");
        let mut expected = snapshot(&r);
        expected.as_object_mut().unwrap().remove("revision");
        op.data["transition_expected"] = expected;
        assert!(validate(&op, &[r]).is_ok());
        assert_eq!(
            op.data["preview"]["reconciled_keys"]["kept_current"],
            json!(["added"])
        );
    }
    #[test]
    fn own_ramp_after_lost_response_resumes() {
        let (mut op, mut r) = replacement_fixture();
        r.status = ExperimentStatusType::Inprogress;
        r.traffic_percentage = 50;
        r.change_reason = "test [Airborne operation 00000000-0000-4000-8000-000000000001]".into();
        op.data["transition_expected"] = snapshot(&r);
        assert!(validate(&op, &[r]).is_ok());
    }
    #[test]
    fn human_ramp_down_after_failure_is_changed() {
        let (mut op, mut r) = replacement_fixture();
        r.status = ExperimentStatusType::Inprogress;
        r.traffic_percentage = 50;
        op.data["observed"] = snapshot(&r);
        r.traffic_percentage = 10;
        r.change_reason = "human".into();
        assert!(validate(&op, &[r]).is_err());
    }
    #[test]
    fn human_contents_change_is_changed() {
        let (op, mut r) = replacement_fixture();
        r.variants[0]
            .overrides
            .insert("package.version".into(), Document::Null);
        assert!(validate(&op, &[r]).is_err());
    }
    #[test]
    fn human_identical_write_revision_is_changed() {
        let (op, mut r) = replacement_fixture();
        r.last_modified = aws_smithy_types::DateTime::from_secs(99);
        assert!(validate(&op, &[r]).is_err());
    }
    #[test]
    fn human_revision_after_confirmed_ramp_is_changed() {
        let (mut op, mut r) = replacement_fixture();
        r.status = ExperimentStatusType::Inprogress;
        r.traffic_percentage = 50;
        r.change_reason = "test [Airborne operation 00000000-0000-4000-8000-000000000001]".into();
        op.data["observed"] = snapshot(&r);
        op.data["transition_expected"] = Value::Null;
        r.last_modified = aws_smithy_types::DateTime::from_secs(99);
        assert!(validate(&op, &[r]).is_err());
    }
    #[test]
    fn own_conclude_after_lost_response_resumes() {
        let (mut op, mut r) = replacement_fixture();
        r.status = ExperimentStatusType::Concluded;
        r.chosen_variant = experimental(&r).map(|v| v.id.clone());
        r.change_reason = "test [Airborne operation 00000000-0000-4000-8000-000000000001]".into();
        op.data["transition_expected"] = snapshot(&r);
        assert!(validate(&op, &[r]).is_ok());
    }
    #[test]
    fn discarded_or_control_concluded_replacement_is_changed() {
        for status in [
            ExperimentStatusType::Discarded,
            ExperimentStatusType::Concluded,
        ] {
            let (op, mut r) = replacement_fixture();
            r.status = status;
            r.chosen_variant = Some("control".into());
            assert!(validate(&op, &[r]).is_err());
        }
    }
    #[test]
    fn missing_recorded_replacement_is_changed() {
        let (op, _) = replacement_fixture();
        assert!(validate(&op, &[]).is_err());
    }
    #[test]
    fn later_unrelated_release_prevents_resume() {
        let (op, r) = replacement_fixture();
        let newer = super::super::control_center::tests::make("later", 99, "ios");
        assert!(validate(&op, &[r, newer]).is_err());
    }
    #[test]
    fn schemas_fail_closed_before_any_write() {
        assert!(schema_matches(
            &json!({"type":"string","pattern":".*"}),
            &json!("a")
        ));
        assert!(!schema_matches(&json!({"type":"integer"}), &json!("a")));
        assert!(!schema_matches(
            &json!({"type":"string","pattern":"^a"}),
            &json!("a")
        ));
        assert!(!schema_matches(
            &json!({"type":"object","required":["id"]}),
            &json!({})
        ));
        assert!(!schema_matches(
            &json!({"type":"array","items":{"type":"integer"}}),
            &json!(["a"])
        ));
    }
}
