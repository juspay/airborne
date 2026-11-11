// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
use super::*;
use crate::run_blocking;
use actix_web::{put, HttpResponse};
use diesel::{
    prelude::*,
    sql_types::{Bool, Jsonb, Text, Uuid as SqlUuid},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use uuid::Uuid;
type Result<T> = airborne_types::Result<T>;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Policy {
    pub enabled: bool,
    pub makers: BTreeSet<String>,
    pub checkers: BTreeSet<String>,
    pub request_ttl_hours: i64,
    pub emergency_rollback: bool,
}
impl Default for Policy {
    fn default() -> Self {
        Self {
            enabled: false,
            makers: BTreeSet::new(),
            checkers: BTreeSet::new(),
            request_ttl_hours: 24,
            emergency_rollback: true,
        }
    }
}
#[derive(QueryableByName)]
struct Row {
    #[diesel(sql_type=Jsonb)]
    data: Value,
}
#[derive(QueryableByName)]
struct Ready {
    #[diesel(sql_type=Bool)]
    ready: bool,
}
// One statement: status and audit event commit together. Concurrent readers cannot
// emit duplicates; a decision uses compare-and-swap before dispatching execution.
const EXPIRE_SQL: &str = "WITH expired AS (UPDATE hyperotaserver.deployment_requests SET status='expired',data=jsonb_set(data,'{status}','\"expired\"'),updated_at=now() WHERE org_id=$1 AND ($2='' OR app_id=$2) AND status IN ('pending','failed') AND (data->>'expires_at')::timestamptz <= now() RETURNING *) INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) SELECT id,org_id,app_id,coalesce(data->'payload'->>'release_id',''),'expired','system:expiry',data FROM expired ON CONFLICT(id) DO NOTHING";
fn expire(c: &mut diesel::PgConnection, org: &str, app: &str) -> Result<()> {
    diesel::sql_query(EXPIRE_SQL)
        .bind::<Text, _>(org)
        .bind::<Text, _>(app)
        .execute(c)?;
    Ok(())
}
async fn rows(state: &web::Data<AppState>, org: &str, app: &str, kind: &str) -> Result<Vec<Value>> {
    let pool = state.db_pool.clone();
    let (org, app, kind) = (org.to_owned(), app.to_owned(), kind.to_owned());
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(1))?;
        expire(&mut c, &org, &app)?;
        let query=match kind.as_str() {
            "policy"=>"SELECT data FROM hyperotaserver.approval_policies WHERE org_id=$1 AND app_id=$2",
            "requests"=>"SELECT data || jsonb_build_object('status',status,'updated_at',updated_at) AS data FROM hyperotaserver.deployment_requests WHERE org_id=$1 AND ($2='' OR app_id=$2) ORDER BY created_at DESC LIMIT 1000",
            "protections"=>"SELECT data || jsonb_build_object('release_id',release_id) AS data FROM hyperotaserver.release_protections WHERE org_id=$1 AND app_id=$2 ORDER BY release_id",
            _=>"SELECT data || jsonb_build_object('id',id,'release_id',release_id,'actor',actor,'acknowledged_by',acknowledged_by) AS data FROM hyperotaserver.emergency_reviews WHERE org_id=$1 AND app_id=$2 AND acknowledged_by IS NULL",
        };
        Ok(diesel::sql_query(query)
            .bind::<Text, _>(org)
            .bind::<Text, _>(app)
            .load::<Row>(&mut c)?
            .into_iter()
            .map(|r| r.data)
            .collect())
    })
}
pub async fn policy(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Policy> {
    rows(state, org, app, "policy")
        .await?
        .pop()
        .map(serde_json::from_value)
        .transpose()
        .map_err(|_| ABError::InternalServerError("Invalid approval policy".into()))
        .map(|p| p.unwrap_or_default())
}
fn scope(auth: &AuthResponse) -> Result<(String, String)> {
    require_org_and_app(auth.organisation.clone(), auth.application.clone())
}
fn hash(value: &Value) -> String {
    format!("{:x}", Sha256::digest(serde_json::to_vec(value).unwrap()))
}
fn coded(status: u16, code: &str, message: &str) -> ABError {
    ABError::ReleaseOperation {
        status,
        body: json!({"code":code,"message":message}),
    }
}
fn required(app: &str) -> ABError {
    ABError::ReleaseOperation {
        status: 403,
        body: json!({"code":"approval_required","application":app,"message":format!("Approval required for {app}. Raise a request with POST /api/control-center/deployment-requests")}),
    }
}
struct Execution {
    org: String,
    app: String,
    request: Value,
}
tokio::task_local! {static EXECUTION: Execution; static SNAPSHOT_VERSION: String;}
fn version_for(action: &str, payload: &Value) -> String {
    payload["config_version"]
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| hash(&json!([action, payload["body"], payload["release_id"]])))
}
pub fn config_version() -> Option<String> {
    SNAPSHOT_VERSION.try_with(Clone::clone).ok().or_else(|| {
        EXECUTION
            .try_with(|e| {
                version_for(
                    e.request["action"].as_str().unwrap_or(""),
                    &e.request["payload"],
                )
            })
            .ok()
    })
}
pub fn executing(org: &str, app: &str) -> bool {
    EXECUTION
        .try_with(|e| e.org == org && e.app == app)
        .unwrap_or(false)
}
pub fn audit_context() -> Option<Value> {
    EXECUTION.try_with(|e|json!({"request_id":e.request["id"],"requester":e.request["requester"],"emergency":e.request["emergency"],"approver":if e.request["emergency"]==true {Value::Null} else {e.request["decided_by"].clone()},"payload_hash":e.request["payload_hash"]})).ok()
}
fn approved(org: &str, app: &str, action: &str, id: &str) -> bool {
    EXECUTION
        .try_with(|e| {
            e.org == org
                && e.app == app
                && e.request["action"] == action
                && e.request["payload"]["release_id"].as_str().unwrap_or("") == id
        })
        .unwrap_or(false)
}
pub async fn sensitive(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
) -> Result<bool> {
    if let Some(p) = rows(state, org, app, "protections")
        .await?
        .into_iter()
        .find(|p| p["release_id"] == id)
    {
        return Ok(p["rollback_sensitive"].is_string());
    }
    // A crash can occur after upstream accepts create but before its local marker
    // is stored. The immutable approved config version still identifies that source.
    let (_, exps) = control_center::experiments(state, org, app).await?;
    let Some(exp) = exps.iter().find(|e| e.id == id) else {
        return Ok(false);
    };
    let version =
        utils::extract_string_from_experiment(&control_center::experimental(exp), "config.version");
    let pool = state.db_pool.clone();
    let (org, app) = (org.to_owned(), app.to_owned());
    run_blocking!({
        let mut c = pool.get()?;
        Ok(diesel::sql_query("SELECT EXISTS(SELECT 1 FROM hyperotaserver.deployment_requests WHERE org_id=$1 AND app_id=$2 AND status IN ('executing','failed','executed') AND data->>'action'='create' AND data->'payload'->'body'->>'rollback_sensitive' IN ('security','one_way_migration') AND data->'payload'->'snapshot'->'overrides'->'EXPERIMENTAL'->>'config.version'=$3) AS ready").bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(version).get_result::<Ready>(&mut c)?.ready)
    })
}

pub fn needs_approval(
    action: &str,
    status: &str,
    current: i32,
    target: i32,
    sensitive: bool,
) -> bool {
    match action {
        "discard" => false,
        "ramp" => target > current || sensitive,
        "rollback" => status == "CONCLUDED" || (status != "CREATED" && sensitive),
        _ => true,
    }
}
pub async fn gate(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    action: &str,
    id: &str,
    payload: &Value,
) -> Result<()> {
    let p = policy(state, org, app).await?;
    if !p.enabled {
        return Ok(());
    }
    if approved(org, app, action, id) {
        return Ok(());
    }
    let (_, exps) = control_center::experiments(state, org, app).await?;
    let exp = exps.iter().find(|e| e.id == id);
    let (status, current) = exp
        .map(|e| (e.status.as_str(), e.traffic_percentage))
        .unwrap_or(("", 0));
    if needs_approval(
        action,
        status,
        current,
        payload["traffic_percentage"].as_i64().unwrap_or(0) as i32,
        sensitive(state, org, app, id).await?,
    ) {
        Err(required(app))
    } else {
        Ok(())
    }
}
// Share admission and the entire mutation lifetime with policy changes.
pub async fn auxiliary_write<T>(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    operation: impl std::future::Future<Output = Result<T>>,
) -> Result<T> {
    write_lock::locked_inner(state, org, app, false, async {
        auxiliary(state, org, app).await?;
        operation.await
    })
    .await
}
// Called inside the app lock by auxiliary writers.
pub async fn auxiliary(state: &web::Data<AppState>, org: &str, app: &str) -> Result<()> {
    if policy(state, org, app).await?.enabled {
        Err(required(app))
    } else {
        Ok(())
    }
}
async fn permission(
    state: &web::Data<AppState>,
    sub: &str,
    org: &str,
    app: &str,
    action: &str,
) -> Result<()> {
    if state
        .authz_provider
        .enforce_permission(state, sub, org, Some(app), "release", action)
        .await?
        || state
            .authz_provider
            .enforce_permission(state, sub, org, None, "release", action)
            .await?
    {
        Ok(())
    } else {
        Err(ABError::Forbidden("Release permission required".into()))
    }
}

async fn member(state: &web::Data<AppState>, sub: &str, org: &str, app: &str) -> Result<()> {
    if !state
        .authn_provider
        .approval_subject_exists(state, sub)
        .await?
    {
        return Err(ABError::Forbidden(
            "Policy member must be a real enabled identity".into(),
        ));
    }
    state
        .authz_provider
        .access_for_request(state, sub, Some(org), Some(app))
        .await?;
    let mut users = state
        .authz_provider
        .list_organisation_users(state, org)
        .await?;
    users.extend(
        state
            .authz_provider
            .list_application_users(state, org, app)
            .await?,
    );
    if !users
        .iter()
        .any(|u| u.email.as_deref() == Some(sub) || u.username == sub)
    {
        return Err(ABError::Forbidden(
            "Policy member must be an existing application user".into(),
        ));
    }
    permission(state, sub, org, app, "read").await
}
fn permission_action(action: &str) -> &str {
    match action {
        "create" => "create",
        "update" | "set_rollback_sensitive" | "set_strict_serving" => "update",
        "ramp" => "ramp",
        "discard" => "discard",
        _ => "conclude",
    }
}
fn valid_roster(p: &Policy) -> bool {
    p.makers.union(&p.checkers).count() >= 2
        && p.makers.iter().all(|m| p.checkers.iter().any(|c| c != m))
}
fn transition_allowed(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        (
            "pending",
            "executing" | "rejected" | "cancelled" | "expired" | "stale"
        ) | ("executing", "executed" | "failed")
            | ("failed", "executing" | "expired" | "stale")
    )
}
async fn save_request(
    org: &str,
    app: &str,
    data: &Value,
    status: &str,
    actor: &str,
) -> Result<Value> {
    if !transition_allowed(data["status"].as_str().unwrap_or(""), status) {
        return Err(ABError::Conflict("Invalid request transition".into()));
    }
    let previous = data["status"].as_str().unwrap_or("").to_owned();
    let mut data = data.clone();
    data["status"] = json!(status);
    data["updated_at"] = json!(Utc::now());
    let (org, app, actor, status) = (
        org.to_owned(),
        app.to_owned(),
        actor.to_owned(),
        status.to_owned(),
    );
    let copy = data.clone();
    write_lock::store(move|c|c.transaction::<_,ABError,_>(|c|{
        let changed = diesel::sql_query("UPDATE hyperotaserver.deployment_requests SET status=$1,data=$2,updated_at=now() WHERE id=$3 AND org_id=$4 AND app_id=$5 AND status=$6").bind::<Text,_>(&status).bind::<Jsonb,_>(&copy).bind::<SqlUuid,_>(Uuid::parse_str(copy["id"].as_str().unwrap()).unwrap()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&previous).execute(c)?;
        if changed != 1 { return Err(coded(409,"not_pending","Request status changed; refresh before deciding")); }
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,$4,$5,$6,$7)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(copy["payload"]["release_id"].as_str().unwrap_or("")).bind::<Text,_>(if status=="executing"{"approved"}else{&status}).bind::<Text,_>(&actor).bind::<Jsonb,_>(&copy).execute(c)?;Ok(())
    })).await?;
    Ok(data)
}
async fn request_queue(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    status: Option<&str>,
) -> Result<Vec<Value>> {
    let pool = state.db_pool.clone();
    let (org, app, status) = (
        org.to_owned(),
        app.to_owned(),
        status.unwrap_or("").to_owned(),
    );
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(1))?;
        expire(&mut c, &org, &app)?;
        Ok(diesel::sql_query("SELECT data || jsonb_build_object('status',status,'updated_at',updated_at) AS data FROM hyperotaserver.deployment_requests WHERE org_id=$1 AND ($2='' OR app_id=$2) AND ($3='' OR status=$3) ORDER BY created_at DESC LIMIT 1000").bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(status).load::<Row>(&mut c)?.into_iter().map(|r|r.data).collect())
    })
}
pub fn routes(c: &mut web::ServiceConfig) {
    c.service(get_policy)
        .service(put_policy)
        .service(list_requests)
        .service(create_request)
        .service(get_request)
        .service(decide);
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/approval-policy")]
async fn get_policy(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    Ok(Json(json!(policy(&state, &o, &a).await?)))
}
#[authz(resource="release",action="update",org_roles=["owner","admin"],app_roles=[])]
#[put("/approval-policy")]
async fn put_policy(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    req: Json<Policy>,
) -> Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    // Even super admins must actually hold the organisation owner/admin role.
    let access = state
        .authz_provider
        .get_user_access_summary(&state, &auth_response.sub)
        .await?;
    if !access
        .organisations
        .iter()
        .any(|org| org.name == o && org.access.iter().any(|r| r == "owner" || r == "admin"))
    {
        return Err(ABError::Forbidden(
            "Organisation owner/admin required".into(),
        ));
    }
    write_lock::locked(&state,&o,&a,async{
        let before=policy(&state,&o,&a).await?;let p=req.into_inner();
        if !(1..=720).contains(&p.request_ttl_hours){return Err(ABError::BadRequest("request_ttl_hours must be 1..720".into()))}
        if p.enabled {
            let pool=state.db_pool.clone();let ready=run_blocking!({let mut c=pool.get()?;Ok(diesel::sql_query("SELECT enforcement_ready AS ready FROM hyperotaserver.approval_deployment WHERE singleton").get_result::<Ready>(&mut c)?.ready)})?;
            if !ready{return Err(ABError::Conflict("All Airborne instances must enforce maker-checker before an operator sets approval_deployment.enforcement_ready; mixed-version enablement is unsafe".into()))}
            if p.emergency_rollback && p.checkers.len()<2 {return Err(ABError::BadRequest("Emergency rollback requires two different checkers for acknowledgement".into()))}
            if !valid_roster(&p){return Err(ABError::BadRequest("Each maker needs a different checker; at least two distinct people required".into()))}
        }
        for sub in p.makers.union(&p.checkers).filter(|_| p.enabled){member(&state,sub,&o,&a).await?;if p.enabled {for action in ["create","ramp","conclude","update"]{permission(&state,sub,&o,&a,action).await?;}}}
        let after=json!(p);let (org,app,actor)=(o.clone(),a.clone(),auth_response.sub.clone());let copy=after.clone();
        write_lock::store(move|c|c.transaction::<_,ABError,_>(|c|{
            diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,$2,$3) ON CONFLICT(org_id,app_id) DO UPDATE SET data=excluded.data").bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Jsonb,_>(&copy).execute(c)?;
            diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,'','policy_changed',$4,$5)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&actor).bind::<Jsonb,_>(json!({"before":before,"after":copy})).execute(c)?;
            if !p.enabled {
                // Cancellation and policy audit commit together; never execute on disable.
                let pending=diesel::sql_query("SELECT data FROM hyperotaserver.deployment_requests WHERE org_id=$1 AND app_id=$2 AND status='pending'").bind::<Text,_>(&org).bind::<Text,_>(&app).load::<Row>(c)?;
                for row in pending {let mut d=row.data;d["status"]=json!("cancelled");d["decision_reason"]=json!("Policy disabled");d["decided_by"]=json!(actor);
                    diesel::sql_query("UPDATE hyperotaserver.deployment_requests SET status='cancelled',data=$1,updated_at=now() WHERE id=$2").bind::<Jsonb,_>(&d).bind::<SqlUuid,_>(Uuid::parse_str(d["id"].as_str().unwrap()).unwrap()).execute(c)?;
                    diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,'','cancelled',$4,$5)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&actor).bind::<Jsonb,_>(d).execute(c)?;
                }
            } Ok(())
        })).await?;Ok(Json(after))
    }).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Raise {
    action: String,
    payload: Value,
    reason: String,
}
// Bind the resolved overrides and immutable file records, not tag aliases or latest-package selectors.
async fn snapshot_payload(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    action: &str,
    payload: &Value,
) -> Result<Value> {
    if action == "set_strict_serving" {
        let _: super::serving_policy::Change = serde_json::from_value(payload["body"].clone())
            .map_err(|e| ABError::BadRequest(e.to_string()))?;
        return super::serving_policy::get(state, org, app).await;
    }
    if action == "create" || action == "update" {
        let req: CreateReleaseRequest = serde_json::from_value(payload["body"].clone())
            .map_err(|e| ABError::BadRequest(e.to_string()))?;
        if req
            .rollback_sensitive
            .as_deref()
            .is_some_and(|v| !matches!(v, "security" | "one_way_migration"))
        {
            return Err(ABError::BadRequest("Invalid rollback_sensitive".into()));
        }
        if action == "create" {
            let strict = super::serving_policy::get(state, org, app).await?["effective_strict"]
                .as_bool()
                .unwrap_or(true);
            super::validate_creation_targeting(
                strict,
                &req.dimensions.clone().unwrap_or_default(),
                req.compatibility_exception.as_deref(),
            )?;
        }
        let (workspace, _) = control_center::experiments(state, org, app).await?;
        let mut b = SNAPSHOT_VERSION
            .scope(
                version_for(action, payload),
                utils::build_overrides(
                    &Json(req),
                    state.env.superposition_org_id.clone(),
                    app.into(),
                    org.into(),
                    serde_json::from_value(payload["body"]["dimensions"].clone())
                        .unwrap_or_default(),
                    state.clone(),
                    workspace,
                ),
            )
            .await?;
        b.files.sort_by_key(|f| f.id);
        if b.files
            .iter()
            .any(|f| f.size <= 0 || f.url.is_empty() || f.checksum.len() != 64)
        {
            return Err(ABError::BadRequest(
                "Approved deployments require completed files with size, URL and SHA-256 checksum"
                    .into(),
            ));
        }

        for key in std::iter::once(&b.package_data.index)
            .chain(b.final_important.iter().flatten())
            .chain(b.final_lazy.iter().flatten())
            .chain(b.final_resources.iter().flatten())
        {
            if crate::file::utils::parse_file_key(key).1.is_none() {
                return Err(ABError::BadRequest("Approved deployments require immutable @version: file keys, including the package index".into()));
            }
        }
        Ok(
            json!({"overrides":control_center::override_values(&b.control_overrides,&b.experimental_overrides),"files":b.files,"package":b.package_data}),
        )
    } else if action == "rollback" {
        let (_, exps) = control_center::experiments(state, org, app).await?;
        super::rollback::approval_plan(
            state,
            org,
            app,
            payload["release_id"].as_str().unwrap_or(""),
            &exps,
        )
        .await
    } else {
        let mut payload = payload.clone();
        payload.as_object_mut().unwrap().remove("snapshot");
        Ok(payload)
    }
}
async fn base_state(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Value> {
    let (workspace, exps) = control_center::experiments(state, org, app).await?;
    let mut exps = exps
        .iter()
        .map(control_center::snapshot)
        .collect::<Vec<_>>();
    exps.sort_by_key(|e| e["id"].as_str().unwrap_or("").to_owned());
    // Conservative app-wide freshness includes overlap and in-place rollout/override edits.
    Ok(
        json!({"releases":exps,"config":write_lock::config_values(state,&workspace).await?,"protections":rows(state,org,app,"protections").await?,"serving_policy":super::serving_policy::get(state,org,app).await?}),
    )
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[post("/deployment-requests")]
async fn create_request(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    req: Json<Raise>,
) -> Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    write_lock::locked(&state,&o,&a,async{
        let p=policy(&state,&o,&a).await?;
        if !p.enabled||!p.makers.contains(&auth_response.sub){return Err(coded(403,"not_maker","Enabled policy and maker membership required"))}
        permission(&state,&auth_response.sub,&o,&a,permission_action(&req.action)).await?;
        if !["create","ramp","conclude","update","rollback","discard","set_rollback_sensitive","set_strict_serving"].contains(&req.action.as_str()){return Err(ABError::BadRequest("Unknown deployment action".into()))}
        if req.reason.trim().is_empty(){return Err(ABError::BadRequest("Request reason required".into()))}
        write_lock::validate_user_reason(&req.reason)?;
        let mut payload=req.payload.clone();
        if !payload.is_object(){return Err(ABError::BadRequest("payload must be an object".into()))}
        let allowed=if req.action=="create"{vec!["body"]}else{vec!["release_id","body"]};
        if payload.as_object().unwrap().keys().any(|k|!allowed.contains(&k.as_str())) {return Err(ABError::BadRequest("Unknown payload field".into()))}
        // The package and config version a request concerns, so clients can show and link them directly.
        let (mut package_version, mut config_version) = (Value::Null, Value::Null);
        if req.action!="create" && req.action!="set_strict_serving" {
            let(_,exps)=control_center::experiments(&state,&o,&a).await?;
            let exp=exps.iter().find(|e|Some(e.id.as_str())==payload["release_id"].as_str()).ok_or_else(||ABError::NotFound("Release not found in this application".into()))?;
            package_version=json!(control_center::version(exp));
            config_version=json!(utils::extract_string_from_experiment(&control_center::experimental(exp),"config.version"));
        }
        if req.action=="set_strict_serving" && payload.get("release_id").is_some(){return Err(ABError::BadRequest("set_strict_serving has no release_id".into()))}
        if req.action=="set_rollback_sensitive"{validate_marker(&payload["body"]["rollback_sensitive"])?;}
        let id=Uuid::new_v4();payload["config_version"]=json!(id.to_string());
        let resolved=snapshot_payload(&state,&o,&a,&req.action,&payload).await?;payload["snapshot"]=resolved;
        // A create or update owns a fresh version assigned before its immutable snapshot.
        if req.action=="create" || req.action=="update" {config_version=payload["config_version"].clone();}
        if let Some(v)=payload["snapshot"]["package"]["version"].as_i64(){package_version=json!(v);}
        let data=json!({"id":id,"org":o,"application":a,"action":req.action,"payload":payload,"payload_hash":hash(&payload),"base_state":base_state(&state,&o,&a).await?,"requester":auth_response.sub,"reason":req.reason,"status":"pending","expires_at":Utc::now()+chrono::Duration::hours(p.request_ttl_hours),"decided_by":null,"decision_reason":null,"created_at":Utc::now(),"updated_at":Utc::now(),"result":null,"package_version":package_version,"config_version":config_version});
        let(org,app,copy)=(o.clone(),a.clone(),data.clone());
        let actor=auth_response.sub.clone();
        write_lock::store(move|c|c.transaction::<_,ABError,_>(|c|{
            diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,$3,'pending',$4)").bind::<SqlUuid,_>(id).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Jsonb,_>(&copy).execute(c)?;
            diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,$4,'requested',$5,$6)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(copy["payload"]["release_id"].as_str().unwrap_or("")).bind::<Text,_>(actor).bind::<Jsonb,_>(&copy).execute(c)?;Ok(())
        })).await?;
        Ok(Json(data))
    }).await
}
#[derive(Deserialize)]
struct Filter {
    status: Option<String>,
}
#[get("/deployment-requests")]
async fn list_requests(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    filter: Query<Filter>,
) -> Result<Json<Value>> {
    let org = crate::middleware::auth::require_scope_name(
        auth_response.organisation.clone(),
        "organisation",
    )?;
    let app = auth_response
        .application
        .as_ref()
        .map(|a| a.name.as_str())
        .unwrap_or("");
    let mut data = Vec::new();
    for r in request_queue(&state, &org, app, filter.status.as_deref()).await? {
        if filter.status.as_ref().is_some_and(|s| r["status"] != *s) {
            continue;
        }
        if state
            .authz_provider
            .enforce_permission(
                &state,
                &auth_response.sub,
                &org,
                r["application"].as_str(),
                "release",
                "read",
            )
            .await?
        {
            data.push(r)
        }
    }
    Ok(Json(json!({"requests":data})))
}
async fn find(state: &web::Data<AppState>, org: &str, app: &str, id: Uuid) -> Result<Value> {
    let pool = state.db_pool.clone();
    let (org, app) = (org.to_owned(), app.to_owned());
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(1))?;
        expire(&mut c, &org, &app)?;
        diesel::sql_query("SELECT data || jsonb_build_object('status',status,'updated_at',updated_at) AS data FROM hyperotaserver.deployment_requests WHERE id=$1 AND org_id=$2 AND app_id=$3").bind::<SqlUuid,_>(id).bind::<Text,_>(org).bind::<Text,_>(app).get_result::<Row>(&mut c).optional()?.map(|r|r.data).ok_or_else(||ABError::NotFound("Request not found in this application".into()))
    })
}

#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/deployment-requests/{id}")]
async fn get_request(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<Uuid>,
) -> Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    Ok(Json(find(&state, &o, &a, path.into_inner()).await?))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Decision {
    #[serde(default)]
    reason: String,
}
fn validate_marker(v: &Value) -> Result<()> {
    if v.is_null() || matches!(v.as_str(), Some("security" | "one_way_migration")) {
        Ok(())
    } else {
        Err(ABError::BadRequest(
            "rollback_sensitive must be null, security or one_way_migration".into(),
        ))
    }
}
async fn marker(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    v: Value,
) -> Result<()> {
    validate_marker(&v)?;
    let threshold = if v.as_str() == Some("security") {
        let (_, exps) = control_center::experiments(state, org, app).await?;
        let e = exps
            .iter()
            .find(|e| e.id == id)
            .ok_or_else(|| ABError::NotFound("Security release missing".into()))?;
        Some(control_center::version(e).to_string())
    } else {
        None
    };
    let (o, a, id) = (org.to_owned(), app.to_owned(), id.to_owned());
    write_lock::store(move|c|c.transaction::<_,ABError,_>(|c|{if let Some(version)=threshold {diesel::sql_query("INSERT INTO hyperotaserver.blocked_packages(org_id,app_id,package_version,source_release) SELECT org_id,app_id,version::text,$3 FROM hyperotaserver.packages_v2 WHERE org_id=$1 AND app_id=$2 AND version < $4::integer ON CONFLICT DO NOTHING").bind::<Text,_>(&o).bind::<Text,_>(&a).bind::<Text,_>(&id).bind::<Text,_>(version).execute(c)?;} diesel::sql_query("INSERT INTO hyperotaserver.release_protections(org_id,app_id,release_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(org_id,app_id,release_id) DO UPDATE SET data=excluded.data").bind::<Text,_>(o).bind::<Text,_>(a).bind::<Text,_>(id).bind::<Jsonb,_>(json!({"rollback_sensitive":v})).execute(c)?;Ok(())})).await
}
// Construct AND poll large debug execution futures on an explicitly sized stack.
// The factory is invoked on the worker: boxing a future after constructing it on
// an Actix thread does not bound construction temporaries. The writer lock and
// all execution task-locals must be acquired inside the factory, never transferred.
pub(super) async fn on_execution_stack<F, Fut, T>(factory: F) -> Result<T>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<T>> + 'static,
    T: Send + 'static,
{
    static EXECUTIONS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(8);
    let permit = EXECUTIONS.try_acquire().map_err(|_| {
        coded(
            503,
            "execution_capacity",
            "Release execution capacity reached; retry shortly",
        )
    })?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    std::thread::Builder::new()
        .name("release-execution".into())
        .stack_size(16 * 1024 * 1024)
        .spawn(move || {
            let _permit = permit;
            let result = actix_web::rt::System::new().block_on(factory());
            let _ = tx.send(result);
        })
        .map_err(|_| {
            coded(
                503,
                "execution_unavailable",
                "Could not start release execution",
            )
        })?;
    rx.await.map_err(|_| coded(500, "execution_interrupted", "Execution interrupted; inspect release state and reconcile the request or operation before retrying"))?
}

#[post("/deployment-requests/{id}/{decision}")]
async fn decide(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<(Uuid, String)>,
    req: Json<Decision>,
) -> Result<Json<Value>> {
    let auth = auth_response.into_inner();
    let path = path.into_inner();
    let req = req.into_inner();
    on_execution_stack(move || async move {
        decide_inner(auth, state, path, req)
            .await
            .map(|v| v.into_inner())
    })
    .await
    .map(Json)
}

async fn decide_inner(
    auth_response: AuthResponse,
    state: web::Data<AppState>,
    path: (Uuid, String),
    req: Decision,
) -> Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    let (id, decision) = path;
    write_lock::validate_user_reason(&req.reason)?;
    write_lock::locked(&state,&o,&a,async{
        let mut r=find(&state,&o,&a,id).await?;let p=policy(&state,&o,&a).await?;
        if r["status"]=="expired" {return Err(coded(409,"request_expired","Request expired"))}
        if decision=="approve"&&r["requester"]==auth_response.sub{return Err(coded(403,"self_approval","Nobody may approve their own request"))}
        if r["status"]!="pending" && r["status"]!="executing" && !(decision=="approve" && r["status"]=="failed") {return Err(coded(409,"not_pending","Request is no longer pending. Executing/unknown outcomes require recovery before another request"))}
        if decision=="cancel" {
            if r["requester"]!=auth_response.sub{return Err(coded(403,"not_requester","Only requester can cancel"))}
        }else if !p.enabled||!p.checkers.contains(&auth_response.sub){return Err(coded(403,"not_checker","Current checker membership required"))}
        member(&state,&auth_response.sub,&o,&a).await?;
        permission(&state,&auth_response.sub,&o,&a,permission_action(r["action"].as_str().unwrap_or(""))).await?;
        if r["status"]=="executing" {
            r["decision_reason"]=json!("Interrupted execution reconciled; inspect actual release state and raise a new request");
            return Ok(Json(save_request(&o,&a,&r,"failed",&auth_response.sub).await?));
        }
        r["decided_by"]=json!(auth_response.sub);r["decision_reason"]=json!(req.reason);
        if decision=="reject"||decision=="cancel" {
            if decision=="reject"&&req.reason.trim().is_empty(){return Err(ABError::BadRequest("Rejection reason required".into()))}
            return Ok(Json(save_request(&o,&a,&r,if decision=="reject"{"rejected"}else{"cancelled"},&auth_response.sub).await?))
        }
        if decision!="approve"{return Err(ABError::NotFound("Unknown decision".into()))}
        let requester=r["requester"].as_str().unwrap_or("");
        if !p.makers.contains(requester){return Err(coded(403,"not_maker","Requester is no longer an eligible maker"))}
        member(&state,requester,&o,&a).await?;
        permission(&state,requester,&o,&a,permission_action(r["action"].as_str().unwrap())).await?;
        let expiry=chrono::DateTime::parse_from_rfc3339(r["expires_at"].as_str().unwrap()).map_err(|_|ABError::InternalServerError("Invalid expiry".into()))?;
        if expiry<=Utc::now(){save_request(&o,&a,&r,"expired",&auth_response.sub).await?;return Err(coded(409,"request_expired","Request expired"))}
        if hash(&r["payload"])!=r["payload_hash"] {return Err(coded(409,"hash_mismatch","Payload hash mismatch"))}
        if base_state(&state,&o,&a).await?!=r["base_state"] || snapshot_payload(&state,&o,&a,r["action"].as_str().unwrap(),&r["payload"]).await?!=r["payload"]["snapshot"] {
            save_request(&o,&a,&r,"stale",&auth_response.sub).await?;return Err(coded(409,"request_stale","Request stale; raise a new request"))
        }
        if expiry<=Utc::now(){save_request(&o,&a,&r,"expired",&auth_response.sub).await?;return Err(coded(409,"request_expired","Request expired during validation"))}
        r=save_request(&o,&a,&r,"executing",&auth_response.sub).await?;
        let result=EXECUTION.scope(Execution{org:o.clone(),app:a.clone(),request:r.clone()},Box::pin(execute(&state,&auth_response,&r))).await;
        match result {
            Ok(value)=>{r["result"]=value;Ok(Json(save_request(&o,&a,&r,"executed",&auth_response.sub).await?))},
            Err(error)=>{r["result"]=json!({"error":error.to_string(),"recovery":"Inspect release operations before raising another request"});save_request(&o,&a,&r,"failed",&auth_response.sub).await?;Err(ABError::ReleaseOperation{status:crate::types::AppError::status_code(&error).as_u16(),body:json!({"code":"execution_failed","message":error.to_string(),"request_id":id,"request_status":"failed"})})}
        }
    }).await
}
async fn execute(state: &web::Data<AppState>, auth: &AuthResponse, r: &Value) -> Result<Value> {
    let action = r["action"].as_str().unwrap();
    let p = &r["payload"];
    let id = p["release_id"].as_str().unwrap_or("");
    let body = p["body"].clone();
    let parse = |e: serde_json::Error| ABError::BadRequest(e.to_string());
    let result = match action {
        "set_strict_serving" => {
            super::serving_policy::change(state, auth, serde_json::from_value(body).map_err(parse)?)
                .await?
        }
        "create" => json!(Box::pin(super::create_release_impl(
            Json(serde_json::from_value(body).map_err(parse)?),
            auth.clone(),
            state.clone()
        ))
        .await?
        .into_inner()),
        "update" => json!(Box::pin(super::update_release_impl(
            Path::from(id.to_owned()),
            Json(serde_json::from_value(body).map_err(parse)?),
            auth.clone(),
            state.clone()
        ))
        .await?
        .into_inner()),
        "ramp" => json!(Box::pin(super::ramp_release_impl(
            Path::from(id.to_owned()),
            Json(serde_json::from_value(body).map_err(parse)?),
            auth.clone(),
            state.clone()
        ))
        .await?
        .into_inner()),
        "conclude" => json!(Box::pin(super::conclude_release_impl(
            Path::from(id.to_owned()),
            Json(serde_json::from_value(body).map_err(parse)?),
            auth.clone(),
            state.clone()
        ))
        .await?
        .into_inner()),
        "discard" => json!(Box::pin(super::discard_release_impl(
            Path::from(id.to_owned()),
            Json(serde_json::from_value(body).map_err(parse)?),
            auth.clone(),
            state.clone()
        ))
        .await?
        .into_inner()),
        "rollback" => {
            let (o, a) = scope(auth)?;
            let response =
                super::rollback::run(state, auth, &o, &a, id, r["reason"].as_str().unwrap())
                    .await?;
            response_json(response).await?
        }
        "set_rollback_sensitive" => {
            json!({"release_id":id,"rollback_sensitive":body["rollback_sensitive"]})
        }
        _ => return Err(ABError::BadRequest("Unknown action".into())),
    };
    if matches!(action, "create" | "update" | "set_rollback_sensitive") {
        let (o, a) = scope(auth)?;
        let rid = if action == "create" {
            result["id"].as_str().unwrap()
        } else {
            id
        };
        if action == "set_rollback_sensitive" || p["body"].get("rollback_sensitive").is_some() {
            marker(state, &o, &a, rid, p["body"]["rollback_sensitive"].clone()).await?;
        }
    }
    Ok(result)
}
async fn response_json(response: HttpResponse) -> Result<Value> {
    let bytes = actix_web::body::to_bytes(response.into_body())
        .await
        .map_err(|_| ABError::InternalServerError("Invalid execution result".into()))?;
    serde_json::from_slice(&bytes)
        .map_err(|_| ABError::InternalServerError("Invalid execution result".into()))
}
/// One authorized-pair query for all local overview metadata, with a bounded pool
/// wait and transaction-local SQL budget. No global tenant scan is returned.
pub async fn overview_batch(
    state: &web::Data<AppState>,
    pairs: &[(String, String)],
) -> Result<Vec<Value>> {
    let pool = state.db_pool.clone();
    let pairs = pairs.to_vec();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_millis(250))?;
        c.transaction::<_,ABError,_>(|c| {
            diesel::sql_query("SET LOCAL statement_timeout='500ms'").execute(c)?;
            let allowed = json!(pairs.iter().map(|(org,app)|json!({"org_id":org,"app_id":app})).collect::<Vec<_>>());
            let expiry = EXPIRE_SQL.replace("org_id=$1 AND ($2='' OR app_id=$2)", "(org_id,app_id) IN (SELECT org_id,app_id FROM jsonb_to_recordset($1) AS allowed(org_id text,app_id text))");
            diesel::sql_query(expiry).bind::<Jsonb,_>(&allowed).execute(c)?;
            let rows = diesel::sql_query(include_str!("overview_aux.sql")).bind::<Jsonb,_>(&allowed).load::<Row>(c)?;
            Ok(rows.into_iter().map(|r|r.data).collect())
        })
    })
}

pub async fn emergency(
    state: &web::Data<AppState>,
    auth: &AuthResponse,
    id: &str,
    reason: &str,
    confirm: bool,
) -> Result<HttpResponse> {
    write_lock::user_reason(reason)?;
    let (o, a) = scope(auth)?;
    let p = policy(state, &o, &a).await?;
    if !p.enabled
        || !p.emergency_rollback
        || p.checkers.len() < 2
        || !p.checkers.contains(&auth.sub)
    {
        return Err(ABError::Forbidden("Emergency rollback requires an enabled policy, emergency_rollback and checker membership".into()));
    }
    member(state, &auth.sub, &o, &a).await?;
    if sensitive(state, &o, &a, id).await? && !confirm {
        return Err(ABError::BadRequest(
            "Explicit confirm_sensitive_risk required".into(),
        ));
    }
    if !rows(state, &o, &a, "reviews").await?.is_empty() {
        return Err(ABError::Conflict(
            "A previous emergency still needs a different checker's acknowledgement".into(),
        ));
    }
    let (_, exps) = control_center::experiments(state, &o, &a).await?;
    let source = exps
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| ABError::NotFound("Release not found".into()))?;
    // A durable attempt owns its replacement even after it becomes live.
    // run() validates drift and returns recorded results; retry also repairs a
    // missing emergency review after an otherwise completed rollback.
    let stored = super::operations::load(state, &o, &a, Some(id))
        .await?
        .pop();
    let resume = match stored.as_ref() {
        Some(op) => super::rollback::resumable(state, &o, &a, op, &exps).await?,
        None => false,
    };
    let plan = if resume {
        stored.as_ref().unwrap().data["preview"].clone()
    } else {
        if !control_center::live(source)
            || control_center::current_live(source, &exps).is_none_or(|e| e.id != id)
        {
            return Err(ABError::Conflict(
                "Emergency rollback only restores the predecessor of the latest live release"
                    .into(),
            ));
        }
        let plan = super::rollback::approval_plan(state, &o, &a, id, &exps).await?;
        if !plan["blocked"].is_null() {
            return Err(ABError::Conflict(
                "Emergency predecessor is unavailable or incompatible".into(),
            ));
        }
        plan
    };
    let review = Uuid::new_v4();
    let data = json!({"reason":reason,"confirm_sensitive_risk":confirm,"plan":plan,"created_at":Utc::now(),"package_version":control_center::version(source),"config_version":utils::extract_string_from_experiment(&control_center::experimental(source),"config.version"),"new_release_id":null});
    let (org, app, rid, actor) = (o.clone(), a.clone(), id.to_owned(), auth.sub.clone());
    let r = json!({"id":review,"action":"rollback","payload":{"release_id":id},"requester":null,"decided_by":auth.sub,"emergency":true});
    let response = EXECUTION
        .scope(
            Execution {
                org: o.clone(),
                app: a.clone(),
                request: r,
            },
            super::rollback::run(state, auth, &o, &a, id, reason),
        )
        .await;
    let outcome = response_json(response?).await?;
    let mut copy = data;
    copy["rollback_finished"] = json!(true);
    copy["rolled_back_to_package_version"] = outcome["rolled_back_to_package_version"].clone();
    copy["new_release_id"] = outcome["new_release_id"].clone();
    copy["rollback_result"] = outcome.clone();
    write_lock::store(move|c|c.transaction::<_,ABError,_>(|c|{
        diesel::sql_query("INSERT INTO hyperotaserver.emergency_reviews(id,org_id,app_id,release_id,actor,data) VALUES($1,$2,$3,$4,$5,$6)").bind::<SqlUuid,_>(review).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&rid).bind::<Text,_>(&actor).bind::<Jsonb,_>(&copy).execute(c)?;
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,$4,'emergency_rollback',$5,$6)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&rid).bind::<Text,_>(&actor).bind::<Jsonb,_>(json!({"review_id":review,"package_version":copy["package_version"],"details":copy})).execute(c)?;Ok(())
    })).await?;
    // Link the review to the replacement the rollback created, so a reviewer can open it directly.
    // Read from the durable journal rather than the response: a partial rollback also has a replacement.
    if let Ok(ops) = super::operations::load(state, &o, &a, Some(id)).await {
        if let Some(new_id) = ops
            .first()
            .and_then(|op| op.data["replacement_release_id"].as_str())
        {
            let (org, app, rid, new_id) = (o.clone(), a.clone(), id.to_owned(), new_id.to_owned());
            let linked: Result<()> = write_lock::store(move|c|{diesel::sql_query("UPDATE hyperotaserver.emergency_reviews SET data=data || $1 WHERE org_id=$2 AND app_id=$3 AND release_id=$4 AND id=$5").bind::<Jsonb,_>(json!({"new_release_id":new_id})).bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(rid).bind::<SqlUuid,_>(review).execute(c)?;Ok(())}).await;
            if let Err(error) = linked {
                log::error!("Failed to link emergency review to its replacement: {error}");
            }
        }
    }
    Ok(HttpResponse::Ok().json(outcome))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Acknowledge {
    reason: String,
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[post("/{release_id}/acknowledge-emergency")]
pub async fn acknowledge(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<String>,
    req: Json<Acknowledge>,
) -> Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    let id = path.into_inner();
    write_lock::locked(&state,&o,&a,async{
        if req.reason.trim().is_empty(){return Err(ABError::BadRequest("Acknowledgement reason required".into()))}
        let p=policy(&state,&o,&a).await?;
        if !p.checkers.contains(&auth_response.sub){return Err(coded(403,"not_checker","Current checker required"))}
        let review=rows(&state,&o,&a,"reviews").await?.into_iter().find(|r|r["release_id"]==id).ok_or_else(||coded(404,"emergency_not_found","Unacknowledged emergency not found"))?;
        if review["actor"]==auth_response.sub{return Err(coded(403,"same_checker","A different checker must acknowledge"))}
        let(org,app,actor,rid,reason)=(o.clone(),a.clone(),auth_response.sub.clone(),id.clone(),req.reason.clone());
        write_lock::store(move|c|c.transaction::<_,ABError,_>(|c|{
            diesel::sql_query("UPDATE hyperotaserver.emergency_reviews SET acknowledged_by=$1,data=data || $2 WHERE org_id=$3 AND app_id=$4 AND release_id=$5 AND acknowledged_by IS NULL").bind::<Text,_>(&actor).bind::<Jsonb,_>(json!({"acknowledgement_reason":reason,"acknowledged_at":Utc::now()})).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&rid).execute(c)?;
            diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,$4,'emergency_acknowledged',$5,$6)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(rid).bind::<Text,_>(actor).bind::<Jsonb,_>(json!({"review":review,"reason":reason})).execute(c)?;Ok(())
        })).await?;Ok(Json(json!({"success":true})))
    }).await
}
// A restored sensitive predecessor must retain its downgrade protection.
pub async fn protect_created(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    id: &str,
    declared: Option<&str>,
) -> Result<()> {
    if let Some(v) = declared {
        marker(state, org, app, id, json!(v)).await?;
        return Ok(());
    }
    if let Ok(v) =
        EXECUTION.try_with(|e| e.request["payload"]["body"]["rollback_sensitive"].clone())
    {
        if !v.is_null() {
            marker(state, org, app, id, v).await?;
        }
    }
    Ok(())
}
pub async fn inherit_predecessor(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    source: &str,
    new_id: &str,
) -> Result<()> {
    if !policy(state, org, app).await?.enabled {
        return Ok(());
    }
    let (_, exps) = control_center::experiments(state, org, app).await?;
    let s = exps
        .iter()
        .find(|e| e.id == source)
        .ok_or_else(|| ABError::NotFound("Source missing".into()))?;
    if let Some(previous) = exps
        .iter()
        .filter(|e| {
            control_center::live(e)
                && control_center::context(e) == control_center::context(s)
                && (e.last_modified, &e.id) < (s.last_modified, &s.id)
        })
        .max_by_key(|e| (e.last_modified, &e.id))
    {
        let protections = rows(state, org, app, "protections").await?;
        if let Some(p) = protections.iter().find(|p| p["release_id"] == previous.id) {
            marker(state, org, app, new_id, p["rollback_sensitive"].clone()).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod review_version_tests {
    use super::*;
    #[test]
    fn q10_repeated_body_has_fresh_but_frozen_config_version() {
        let body = json!({"config":{"properties":{"colour":"blue"}}});
        let first = json!({"body":body,"config_version":Uuid::new_v4().to_string()});
        let second = json!({"body":body,"config_version":Uuid::new_v4().to_string()});
        assert_ne!(
            version_for("create", &first),
            version_for("create", &second)
        );
        assert_ne!(
            version_for("update", &first),
            version_for("update", &second)
        );
        assert_eq!(
            version_for("create", &first),
            version_for("create", &first.clone())
        );
    }
}

#[cfg(test)]
#[path = "postgres_tests.rs"]
mod database_integration;

#[cfg(test)]
#[path = "review_tests.rs"]
mod review_tests;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strict_serving_changes_require_update_permission_and_approval() {
        assert_eq!(permission_action("set_strict_serving"), "update");
        assert!(needs_approval("set_strict_serving", "", 0, 0, false));
        assert!(
            serde_json::from_value::<super::super::serving_policy::Change>(
                json!({"strict":true,"extra":false})
            )
            .is_err()
        );
    }

    #[test]
    fn roster_requires_a_distinct_checker_for_every_maker() {
        for (makers, checkers, expected) in [
            (vec!["a"], vec!["a"], false),
            (vec!["a"], vec!["b"], true),
            (vec!["a", "b"], vec!["a"], false),
            (vec!["a", "b"], vec!["a", "b"], true),
            (vec![], vec![], false),
        ] {
            let p = Policy {
                makers: makers.into_iter().map(String::from).collect(),
                checkers: checkers.into_iter().map(String::from).collect(),
                ..Policy::default()
            };
            assert_eq!(valid_roster(&p), expected);
        }
    }
    #[test]
    fn request_state_machine_all_pairs() {
        let states = [
            "pending",
            "executing",
            "executed",
            "failed",
            "rejected",
            "cancelled",
            "expired",
            "stale",
        ];
        for from in states {
            for to in states {
                let expected = match from {
                    "pending" => {
                        ["executing", "rejected", "cancelled", "expired", "stale"].contains(&to)
                    }
                    "executing" => ["executed", "failed"].contains(&to),
                    "failed" => ["executing", "expired", "stale"].contains(&to),
                    _ => false,
                };
                assert_eq!(transition_allowed(from, to), expected, "{from} -> {to}");
            }
        }
    }
    #[test]
    fn defaults_and_entire_gating_table() {
        assert!(!Policy::default().enabled);
        assert_eq!(Policy::default().request_ttl_hours, 24);
        assert!(Policy::default().emergency_rollback);
        for sensitive in [false, true] {
            for action in ["create", "update", "conclude", "set_rollback_sensitive"] {
                assert!(needs_approval(action, "CREATED", 0, 0, sensitive));
            }
            assert!(!needs_approval("discard", "CREATED", 0, 0, sensitive));
            assert!(needs_approval("ramp", "INPROGRESS", 10, 20, sensitive));
            assert_eq!(
                needs_approval("ramp", "INPROGRESS", 20, 10, sensitive),
                sensitive
            );
            assert_eq!(
                needs_approval("rollback", "INPROGRESS", 20, 0, sensitive),
                sensitive
            );
            assert!(!needs_approval("rollback", "CREATED", 0, 0, sensitive));
            assert!(needs_approval("rollback", "CONCLUDED", 50, 0, sensitive));
        }
    }
    #[test]
    fn payload_hash_is_order_independent_and_content_bound() {
        assert_eq!(hash(&json!({"b":2,"a":1})), hash(&json!({"a":1,"b":2})));
        assert_ne!(hash(&json!({"a":1})), hash(&json!({"a":2})));
    }
}

#[cfg(test)]
mod postgres_http_tests {
    use super::*;
    // Runs against a separately started server using this tree and a disposable,
    // migrated Postgres database. Never point this at a production application.
    #[actix_web::test]
    #[ignore = "requires TEST_DATABASE_URL, TEST_API_URL (:8096), TEST_ORG, TEST_APP, TEST_SUB and TEST_TOKEN for a scratch app"]
    async fn real_decide_gate_emergency_acknowledge() {
        let env = |k| std::env::var(k).unwrap();
        let (org, app, sub) = (env("TEST_ORG"), env("TEST_APP"), env("TEST_SUB"));
        assert!(
            app.contains("scratch") || app.contains("test"),
            "scratch app required"
        );
        let mut c = diesel::PgConnection::establish(&env("TEST_DATABASE_URL")).unwrap();
        let id = Uuid::new_v4();
        let policy = json!({"enabled":true,"makers":[sub],"checkers":[sub,"other-checker"],"emergency_rollback":true});
        diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,$2,$3) ON CONFLICT(org_id,app_id) DO UPDATE SET data=excluded.data").bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Jsonb,_>(policy).execute(&mut c).unwrap();
        let request = json!({"id":id,"status":"pending","requester":sub,"action":"create"});
        diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,$3,'pending',$4)").bind::<SqlUuid,_>(id).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Jsonb,_>(request).execute(&mut c).unwrap();
        let client = reqwest::Client::new();
        let call = |path: String| {
            client
                .post(format!("{}{}", env("TEST_API_URL"), path))
                .bearer_auth(env("TEST_TOKEN"))
                .header("x-organisation", &org)
                .header("x-application", &app)
        };
        let response = call(format!(
            "/api/control-center/deployment-requests/{id}/approve"
        ))
        .json(&json!({"reason":"self approval regression"}))
        .send()
        .await
        .unwrap();
        assert_eq!(
            response.status(),
            403,
            "self approval must fail before execution"
        );
        let response=call("/api/releases".into()).json(&json!({"config":{"boot_timeout":1000,"release_config_timeout":1000},"package_id":"missing"})).send().await.unwrap();
        assert_eq!(response.status(), 403);
        assert_eq!(
            response.json::<Value>().await.unwrap()["code"],
            "approval_required"
        );
        // Same checker must never acknowledge their own emergency.
        diesel::sql_query("INSERT INTO hyperotaserver.emergency_reviews(id,org_id,app_id,release_id,actor,data) VALUES($1,$2,$3,'test-release',$4,'{}')").bind::<SqlUuid,_>(id).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&sub).execute(&mut c).unwrap();
        let response = call("/api/releases/test-release/acknowledge-emergency".into())
            .json(&json!({"reason":"same actor"}))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 403);
        // A non-checker is refused before predecessor lookup or mutation.
        diesel::sql_query("UPDATE hyperotaserver.approval_policies SET data=jsonb_set(data,'{checkers}','[\"other-checker\"]') WHERE org_id=$1 AND app_id=$2").bind::<Text,_>(&org).bind::<Text,_>(&app).execute(&mut c).unwrap();
        let response = call("/api/releases/test-release/rollback".into())
            .json(&json!({"reason":"non-checker","emergency":true}))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 403);
        diesel::sql_query("DELETE FROM hyperotaserver.emergency_reviews WHERE id=$1")
            .bind::<SqlUuid, _>(id)
            .execute(&mut c)
            .unwrap();
        diesel::sql_query("DELETE FROM hyperotaserver.deployment_requests WHERE id=$1")
            .bind::<SqlUuid, _>(id)
            .execute(&mut c)
            .unwrap();
        diesel::sql_query(
            "DELETE FROM hyperotaserver.approval_policies WHERE org_id=$1 AND app_id=$2",
        )
        .bind::<Text, _>(&org)
        .bind::<Text, _>(&app)
        .execute(&mut c)
        .unwrap();
    }
}

#[cfg(test)]
mod org_member_middleware_tests {
    #[actix_web::test]
    #[ignore = "requires TEST_API_URL, TEST_ORG, TEST_APP, TEST_ORG_READER_TOKEN with org READ and no explicit app grant"]
    async fn implicit_app_read_does_not_allow_write() {
        let env = |k| std::env::var(k).unwrap();
        let client = reqwest::Client::new();
        let request = |method: reqwest::Method| {
            let path = if method == reqwest::Method::GET {
                "/api/releases/list"
            } else {
                "/api/releases"
            };
            client
                .request(method, format!("{}{}", env("TEST_API_URL"), path))
                .bearer_auth(env("TEST_ORG_READER_TOKEN"))
                .header("x-organisation", env("TEST_ORG"))
                .header("x-application", env("TEST_APP"))
        };
        let response = request(reqwest::Method::GET).send().await.unwrap();
        assert_eq!(
            response.status(),
            200,
            "organisation reader must pass middleware for an existing app"
        );
        let response=request(reqwest::Method::POST).json(&serde_json::json!({"config":{"boot_timeout":1000,"release_config_timeout":1000},"package_id":"missing"})).send().await.unwrap();
        assert_eq!(
            response.status(),
            403,
            "implicit READ must never grant write"
        );
    }
}

#[cfg(test)]
mod execution_stack_tests {
    use super::*;

    #[actix_web::test]
    async fn execution_future_is_constructed_on_the_worker() {
        let caller = std::thread::current().id();
        let value = on_execution_stack(move || {
            assert_ne!(std::thread::current().id(), caller);
            assert_eq!(std::thread::current().name(), Some("release-execution"));
            async { Ok(42) }
        })
        .await
        .unwrap();
        assert_eq!(value, 42);
    }

    #[actix_web::test]
    async fn interrupted_worker_reports_reconciliation_instead_of_success() {
        let error = on_execution_stack(|| async {
            panic!("simulated execution panic");
            #[allow(unreachable_code)]
            Ok(())
        })
        .await
        .unwrap_err();
        match error {
            ABError::ReleaseOperation { status, body } => {
                assert_eq!(status, 500);
                assert_eq!(body["code"], "execution_interrupted");
                assert!(body["message"].as_str().unwrap().contains("reconcile"));
            }
            other => panic!("unexpected error: {other}"),
        }
        assert_eq!(on_execution_stack(|| async { Ok(1) }).await.unwrap(), 1);
    }
}
