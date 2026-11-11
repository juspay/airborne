use super::*;
use actix_web::web::ReqData;
use diesel::{
    prelude::*,
    sql_types::{Bool, Jsonb, Text, Uuid as SqlUuid},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
#[derive(Default)]
struct PolicyEntry {
    value: tokio::sync::RwLock<Option<(std::time::Instant, Value)>>,
    refresh: tokio::sync::Mutex<()>,
}
type PolicyCache = std::collections::HashMap<(String, String), std::sync::Arc<PolicyEntry>>;
static CACHE: std::sync::LazyLock<tokio::sync::Mutex<PolicyCache>> =
    std::sync::LazyLock::new(Default::default);
pub async fn cached(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> airborne_types::Result<Value> {
    let entry = {
        let mut cache = CACHE.lock().await;
        if cache.len() >= 1024 {
            cache.retain(|_, v| std::sync::Arc::strong_count(v) > 1);
        }
        cache
            .entry((org.to_owned(), app.to_owned()))
            .or_default()
            .clone()
    };
    refresh(&entry, std::time::Duration::from_secs(3), || {
        get(state, org, app)
    })
    .await
}
async fn refresh<F, Fut>(
    entry: &PolicyEntry,
    budget: std::time::Duration,
    load: F,
) -> airborne_types::Result<Value>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = airborne_types::Result<Value>>,
{
    let result = tokio::time::timeout(budget, async {
        let _guard = entry.refresh.lock().await;
        if let Some((at, v)) = entry.value.read().await.as_ref() {
            if at.elapsed().as_secs() < 30 {
                return Ok(v.clone());
            }
        }
        let v = load().await?;
        *entry.value.write().await = Some((std::time::Instant::now(), v.clone()));
        Ok(v)
    })
    .await
    .unwrap_or_else(|_| {
        Err(ABError::InternalServerError(
            "Serving policy lookup deadline".into(),
        ))
    });
    match result {
        Ok(v) => Ok(v),
        Err(e) => entry
            .value
            .read()
            .await
            .as_ref()
            .map(|(_, v)| v.clone())
            .ok_or(e),
    }
}
#[cfg(test)]
mod cache_tests {
    use super::*;
    #[tokio::test]
    async fn queued_and_hung_refreshes_return_stale() {
        let entry = PolicyEntry::default();
        *entry.value.write().await = Some((
            std::time::Instant::now() - std::time::Duration::from_secs(60),
            json!({"effective_strict":true}),
        ));
        let tasks = (0..100).map(|_| {
            refresh(&entry, std::time::Duration::from_millis(20), || async {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                Err(ABError::InternalServerError("pool stalled".into()))
            })
        });
        for result in futures::future::join_all(tasks).await {
            assert_eq!(result.unwrap()["effective_strict"], true);
        }
    }
}
#[derive(QueryableByName)]
struct Row {
    #[diesel(sql_type=Bool)]
    strict: bool,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Change {
    pub strict: bool,
}
pub fn routes(c: &mut web::ServiceConfig) {
    c.service(read).service(update).service(preview);
}
pub async fn get(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> airborne_types::Result<Value> {
    let pool = state.db_pool.clone();
    let (o, a) = (org.to_owned(), app.to_owned());
    let stored = crate::run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        Ok(diesel::sql_query(
            "SELECT strict FROM hyperotaserver.serving_policies WHERE org_id=$1 AND app_id=$2",
        )
        .bind::<Text, _>(o)
        .bind::<Text, _>(a)
        .get_result::<Row>(&mut c)
        .optional()?
        .map(|r| r.strict)
        .unwrap_or(false))
    })?;
    let forced = super::strict_release_application(
        &std::env::var("STRICT_RELEASE_APPLICATIONS").unwrap_or_default(),
        org,
        app,
    );
    Ok(json!({"strict":stored,"deployment_override":forced,"effective_strict":stored||forced}))
}
fn scope(auth: &AuthResponse) -> airborne_types::Result<(String, String)> {
    require_org_and_app(auth.organisation.clone(), auth.application.clone())
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/serving-policy")]
async fn read(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
) -> airborne_types::Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    Ok(Json(get(&state, &o, &a).await?))
}
#[authz(resource="release",action="update",org_roles=["owner","admin","write"],app_roles=["admin","write"])]
#[put("/serving-policy")]
async fn update(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
    body: Json<Change>,
) -> airborne_types::Result<Json<Value>> {
    Ok(Json(
        change(&state, &auth_response, body.into_inner()).await?,
    ))
}
pub async fn change(
    state: &web::Data<AppState>,
    auth: &AuthResponse,
    body: Change,
) -> airborne_types::Result<Value> {
    let (o, a) = scope(auth)?;
    write_lock::locked_inner(state,&o,&a,false,async {
 let before=get(state,&o,&a).await?;
 if before["strict"]==body.strict {return Ok(before)}
 // Both directions affect exposure: enabling removes fallback; disabling adds it.
 // No finite list of preview contexts proves that every device is unaffected.
 maker_checker::gate(state,&o,&a,"set_strict_serving","",&json!(body)).await?;
 let (org,app,actor,after)=(o.clone(),a.clone(),auth.sub.clone(),body.strict);
 let audit=maker_checker::audit_context();
 write_lock::store(move|c| c.transaction::<_,ABError,_>(|c| {
 diesel::sql_query("INSERT INTO hyperotaserver.serving_policies(org_id,app_id,strict) VALUES($1,$2,$3) ON CONFLICT(org_id,app_id) DO UPDATE SET strict=excluded.strict").bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Bool,_>(after).execute(c)?;
 diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,'','policy_changed',$4,$5)").bind::<SqlUuid,_>(uuid::Uuid::new_v4()).bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(actor).bind::<Jsonb,_>(json!({"policy":"strict_serving","before":before,"after":{"strict":after},"approval":audit})).execute(c)?; Ok(())
 })).await?;
 CACHE.lock().await.remove(&(o.clone(), a.clone()));
 get(state,&o,&a).await
 }).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Preview {
    context: HashMap<String, String>,
    toss: String,
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[post("/serving-policy/preview")]
async fn preview(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
    body: Json<Preview>,
) -> airborne_types::Result<Json<Value>> {
    let (o, a) = scope(&auth_response)?;
    let workspace = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        a.clone(),
        o.clone(),
    )
    .await?;
    let builder = state
        .release_superposition_client
        .get_resolved_config_with_identifier()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace)
        .identifier(body.toss.clone());
    let resolved = builder
        .clone()
        .set_context(Some(
            body.context
                .iter()
                .map(|(k, v)| (k.clone(), Document::String(v.clone())))
                .collect(),
        ))
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Preview resolve failed: {e}")))?;
    let defaults = builder
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Preview defaults failed: {e}")))?;
    let config = crate::utils::document::document_to_json_value(&resolved.config);
    let default = crate::utils::document::document_to_json_value(&defaults.config);
    if resolved.version != defaults.version {
        return Err(ABError::Conflict(
            "Config changed during preview; retry read".into(),
        ));
    }
    let targeted = super::has_targeted_release(
        config["config.version"].as_str().unwrap_or("0.0.0"),
        default["config.version"].as_str().unwrap_or("0.0.0"),
        &resolved.version,
        &defaults.version,
    );
    Ok(Json(
        json!({"serving_policy":get(&state,&o,&a).await?,"context":body.context,"toss":body.toss,"config_version":config["config.version"],"package_version":config["package.version"],"targeted":targeted,"would_stop_serving":!targeted && config["config.version"].as_str().unwrap_or("0.0.0")!="0.0.0","strict_status":if targeted {200}else{404},"scope":"supplied context and toss only"}),
    ))
}
