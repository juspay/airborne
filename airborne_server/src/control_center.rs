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

use crate::{
    middleware::auth::{require_scope_name, AuthResponse},
    run_blocking,
    types::{ABError, AppState},
    utils::db::schema::hyperotaserver::{app_group_members as m, app_groups as g},
};
use actix_web::{
    delete, get, post, put,
    web::{self, Json, Path, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use diesel::prelude::*;
use futures::{stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
type Result<T> = crate::types::Result<T>;
/// Turn a unique-constraint violation into a message that says what clashed.
fn on_unique(message: String) -> impl FnOnce(diesel::result::Error) -> ABError {
    move |e| match e {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) => ABError::BadRequest(message),
        other => other.into(),
    }
}
#[derive(Queryable, Serialize)]
struct GroupRow {
    id: Uuid,
    org_id: String,
    name: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}
#[derive(Queryable)]
struct MemberRow {
    group_id: Uuid,
    org_id: String,
    app_id: String,
    platform: String,
}
#[derive(Deserialize, Serialize)]
pub struct GroupMember {
    application: String,
    platform: String,
}
#[derive(Deserialize)]
pub struct GroupRequest {
    name: String,
    members: Vec<GroupMember>,
}
pub fn add_routes() -> Scope {
    Scope::new("")
        .service(crate::release::recovery::list)
        .service(crate::release::recovery::resolve)
        .configure(crate::release::maker_checker::routes)
        .service(overview)
        .service(list_groups)
        .service(create_group)
        .service(update_group)
        .service(delete_group)
        .service(crate::release::control_center::events)
        .service(crate::release::rollback::preview)
}
async fn load_groups(state: &web::Data<AppState>, org: String) -> Result<Vec<Value>> {
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut c = pool.get()?;
        let rows = g::table
            .filter(g::org_id.eq(&org))
            .order(g::name.asc())
            .load::<GroupRow>(&mut c)?;
        let members = m::table
            .filter(m::org_id.eq(&org))
            .load::<MemberRow>(&mut c)?;
        Ok(rows.into_iter().map(|r| json!({"id":r.id,"name":r.name,"members":members.iter().filter(|m|m.group_id==r.id && m.org_id==r.org_id).map(|m|json!({"application":m.app_id,"platform":m.platform})).collect::<Vec<_>>()})).collect())
    })
}
#[authz(resource="app_group", action="read", allow_app=false, org_roles=["owner","admin","write","read"])]
#[get("/groups")]
async fn list_groups(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Value>> {
    let org = require_scope_name(auth_response.organisation.clone(), "organisation")?;
    let mut groups = load_groups(&state, org.clone()).await?;
    for group in &mut groups {
        let mut members = Vec::new();
        for member in group["members"].as_array().unwrap() {
            if state
                .authz_provider
                .enforce_permission(
                    &state,
                    &auth_response.sub,
                    &org,
                    member["application"].as_str(),
                    "release",
                    "read",
                )
                .await?
            {
                members.push(member.clone());
            }
        }
        group["members"] = json!(members);
    }
    Ok(Json(json!({"groups":groups})))
}
async fn save_group(
    state: web::Data<AppState>,
    auth: &AuthResponse,
    id: Uuid,
    req: GroupRequest,
    update: bool,
) -> Result<Json<Value>> {
    let org = require_scope_name(auth.organisation.clone(), "organisation")?;
    // Explicit org-level admin requirement also applies to custom permission bindings.
    if !auth.is_super_admin
        && !auth
            .organisation
            .as_ref()
            .is_some_and(|a| a.is_admin_or_higher())
    {
        return Err(ABError::Forbidden("Organisation admin required".into()));
    }
    if req.name.trim().is_empty() {
        return Err(ABError::BadRequest("Name required".into()));
    }
    let pool = state.db_pool.clone();
    let name = req.name.trim().to_string();
    let response = json!({"id":id,"name":name,"members":req.members});
    run_blocking!({
        let mut c = pool.get()?;
        c.transaction::<_, ABError, _>(|c| {
            diesel::sql_query(format!(
                "SELECT pg_advisory_xact_lock_shared({})",
                crate::organisation::journal_lifecycle::KEY
            ))
            .bind::<diesel::sql_types::Text, _>(&org)
            .execute(c)?;
            for member in &req.members {
                if !["android", "ios", "web", "other"].contains(&member.platform.as_str()) {
                    return Err(ABError::BadRequest("Invalid platform".into()));
                }
                use crate::utils::db::schema::hyperotaserver::workspace_names as w;
                if !diesel::select(diesel::dsl::exists(
                    w::table
                        .filter(w::organization_id.eq(&org))
                        .filter(w::application_id.eq(&member.application)),
                ))
                .get_result::<bool>(c)?
                {
                    return Err(ABError::BadRequest(
                        "Member application does not exist".into(),
                    ));
                }
            }
            if update {
                if diesel::update(g::table.filter(g::id.eq(id)).filter(g::org_id.eq(&org)))
                    .set((g::name.eq(&name), g::updated_at.eq(chrono::Utc::now())))
                    .execute(c)
                    .map_err(on_unique(format!(
                        "A group named \"{name}\" already exists"
                    )))?
                    == 0
                {
                    return Err(ABError::NotFound("Group not found".into()));
                }
                diesel::delete(
                    m::table
                        .filter(m::group_id.eq(id))
                        .filter(m::org_id.eq(&org)),
                )
                .execute(c)?;
            } else {
                diesel::insert_into(g::table)
                    .values((g::id.eq(id), g::org_id.eq(&org), g::name.eq(&name)))
                    .execute(c)
                    .map_err(on_unique(format!(
                        "A group named \"{name}\" already exists"
                    )))?;
            }
            for member in &req.members {
                diesel::insert_into(m::table)
                    .values((
                        m::group_id.eq(id),
                        m::org_id.eq(&org),
                        m::app_id.eq(&member.application),
                        m::platform.eq(&member.platform),
                    ))
                    .execute(c)
                    .map_err(on_unique(format!(
                        "{} already belongs to another group; remove it there first",
                        member.application
                    )))?;
            }
            Ok(())
        })
    })?;
    Ok(Json(response))
}
#[authz(resource="app_group", action="create", allow_app=false, org_roles=["owner","admin"])]
#[post("/groups")]
async fn create_group(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
    req: Json<GroupRequest>,
) -> Result<Json<Value>> {
    save_group(
        state,
        &auth_response,
        Uuid::new_v4(),
        req.into_inner(),
        false,
    )
    .await
}
#[authz(resource="app_group", action="update", allow_app=false, org_roles=["owner","admin"])]
#[put("/groups/{id}")]
async fn update_group(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<Uuid>,
    req: Json<GroupRequest>,
) -> Result<Json<Value>> {
    save_group(
        state,
        &auth_response,
        path.into_inner(),
        req.into_inner(),
        true,
    )
    .await
}
#[authz(resource="app_group", action="delete", allow_app=false, org_roles=["owner","admin"])]
#[delete("/groups/{id}")]
async fn delete_group(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
    path: Path<Uuid>,
) -> Result<Json<Value>> {
    if !auth_response.is_super_admin
        && !auth_response
            .organisation
            .as_ref()
            .is_some_and(|a| a.is_admin_or_higher())
    {
        return Err(ABError::Forbidden("Organisation admin required".into()));
    }
    let org = require_scope_name(auth_response.organisation.clone(), "organisation")?;
    let id = path.into_inner();
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut c = pool.get()?;
        if diesel::delete(g::table.filter(g::id.eq(id)).filter(g::org_id.eq(org)))
            .execute(&mut c)?
            == 0
        {
            return Err(ABError::NotFound("Group not found".into()));
        }
        Ok(())
    })?;
    Ok(Json(json!({"success":true})))
}
#[get("/overview")]
async fn overview(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Value>> {
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    let access = tokio::time::timeout_at(
        deadline,
        state
            .authz_provider
            .get_user_access_summary(&state, &auth_response.sub),
    )
    .await
    .map_err(|_| {
        ABError::InternalServerError("Overview authorization deadline exceeded".into())
    })??;
    // One absolute deadline and one shared pool across all organisations. Queue apps
    // round-robin so an unhealthy organisation cannot occupy every slot first.
    let mut organisations = Vec::new();
    let mut queues = Vec::new();
    for org in access.organisations {
        let mut allowed = Vec::new();
        for app in org.applications {
            if tokio::time::timeout_at(
                deadline,
                state.authz_provider.enforce_permission(
                    &state,
                    &auth_response.sub,
                    &org.name,
                    Some(&app.application),
                    "release",
                    "read",
                ),
            )
            .await
            .map_err(|_| {
                ABError::InternalServerError("Overview authorization deadline exceeded".into())
            })?? {
                allowed.push(app.application);
            }
        }
        let can_read_groups = tokio::time::timeout_at(
            deadline,
            state.authz_provider.enforce_permission(
                &state,
                &auth_response.sub,
                &org.name,
                None,
                "app_group",
                "read",
            ),
        )
        .await
        .ok()
        .and_then(|r| r.ok())
        .unwrap_or(false);
        let groups = if can_read_groups {
            tokio::time::timeout_at(deadline, load_groups(&state, org.name.clone()))
                .await
                .ok()
                .and_then(|r| r.ok())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        organisations.push(json!({"name":org.name,"groups":groups,"ungrouped":[]}));
        queues.push(std::collections::VecDeque::from(allowed));
    }
    let mut jobs = Vec::new();
    loop {
        let mut any = false;
        for (index, queue) in queues.iter_mut().enumerate() {
            if let Some(app) = queue.pop_front() {
                any = true;
                jobs.push((
                    index,
                    organisations[index]["name"].as_str().unwrap().to_owned(),
                    app,
                ));
            }
        }
        if !any {
            break;
        }
    }
    let mut statuses = jobs.iter().map(|(index,_,app)|((*index,app.clone()),json!({"application":app,"platform":null,"live":[],"active":[],"last_activity_at":null,"error":"Release lookup deadline exceeded"}))).collect::<std::collections::BTreeMap<_,_>>();
    // Pause state is local durable data, independent of upstream lookup deadlines.
    // Only attach rows for applications already authorized above.
    let pending = crate::release::operations::pending_apps(&state).await?;
    let work = stream::iter(jobs.into_iter().map(|(index,org,app)| {
        let state=state.clone();
        async move {
            let result=tokio::time::timeout(std::time::Duration::from_secs(2),crate::release::control_center::app_status(&state,&org,&app)).await;
            let status=match result {Ok(Ok(s))=>s,_=>json!({"application":app,"platform":null,"live":[],"active":[],"last_activity_at":null,"error":"Release lookup failed or timed out"})};
            ((index,app),status)
        }
    })).buffer_unordered(8);
    tokio::pin!(work);
    while let Ok(Some((key, status))) = tokio::time::timeout_at(deadline, work.next()).await {
        statuses.insert(key, status);
    }
    for ((index, app), status) in statuses.iter_mut() {
        let org = organisations[*index]["name"].as_str().unwrap();
        crate::release::maker_checker::overview(&state, org, app, status).await?;
        status["unresolved_operations"] = pending
            .iter()
            .find(|p| p.org_id == org && p.app_id == *app)
            .map(|p| p.operations.clone())
            .unwrap_or(json!([]));
    }
    for (index, org) in organisations.iter_mut().enumerate() {
        let mut grouped = std::collections::HashSet::new();
        for group in org["groups"].as_array_mut().unwrap() {
            let members = group["members"]
                .as_array()
                .unwrap()
                .iter()
                .filter_map(|m| {
                    let app = m["application"].as_str()?;
                    let mut status = statuses.get(&(index, app.to_owned()))?.clone();
                    grouped.insert(app.to_owned());
                    status["platform"] = m["platform"].clone();
                    Some(status)
                })
                .collect::<Vec<_>>();
            group["members"] = json!(members);
        }
        org["ungrouped"] = json!(statuses
            .iter()
            .filter(|((i, a), _)| *i == index && !grouped.contains(a))
            .map(|(_, s)| s.clone())
            .collect::<Vec<_>>());
    }
    Ok(Json(
        json!({"generated_at":chrono::Utc::now(),"organisations":organisations}),
    ))
}
