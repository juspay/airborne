pub mod dispatcher;
pub mod types;

use actix_web::{
    delete, get, patch, post,
    web::{self, Json, Path, Query},
    Scope,
};
use airborne_authz_macros::authz;
use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    run_blocking,
    types::{self as airborne_types, ABError, AppState, PaginatedQuery, PaginatedResponse},
    utils::db::{
        models::{NewWebhookEntry, WebhookActionEntry, WebhookEntry, WebhookLogEntry},
        schema::hyperotaserver::{
            webhook_actions::{
                action as wa_action, table as webhook_actions_table, webhook_id as wa_webhook_id,
            },
            webhook_logs::{
                action as wl_action, created_at as wl_created_at, success as wl_success,
                table as webhook_logs_table, webhook_id as wl_webhook_id,
            },
            webhooks::{
                application as w_application, id as w_id, organisation as w_organisation,
                status as w_status, table as webhooks_table,
            },
        },
    },
    webhook::{
        dispatcher::send_webhook,
        types::{
            AdhocTestWebhookRequest, AdhocTestWebhookResponse, CreateWebhookRequest, ListLogsQuery,
            ListWebhooksQuery, TestWebhookRequest, UpdateWebhookRequest, WebhookLogResponse,
            WebhookMetrics, WebhookResponse,
        },
    },
};

pub fn add_routes() -> Scope {
    // NOTE: static paths like `/actions` MUST be registered before the
    // `/{webhook_id}` dynamic segment, otherwise actix-web tries to parse
    // "actions" as a UUID.
    Scope::new("")
        .service(list_webhookable_actions)
        .service(adhoc_test_webhook)
        .service(create_webhook)
        .service(list_webhooks)
        .service(test_webhook)
        .service(list_webhook_logs)
        .service(get_webhook_metrics)
        .service(update_webhook)
        .service(delete_webhook)
        .service(get_webhook)
}

fn to_response(wh: WebhookEntry, actions: Vec<String>) -> WebhookResponse {
    WebhookResponse {
        id: wh.id,
        url: wh.url,
        status: wh.status,
        secret_set: wh.secret.is_some(),
        actions,
        organisation: wh.organisation,
        application: wh.application,
        description: wh.description,
        created_at: wh.created_at,
        updated_at: wh.updated_at,
    }
}

fn validate_action(action: &str) -> airborne_types::Result<String> {
    let normalized = action.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(ABError::BadRequest("action cannot be empty".to_string()));
    }
    // Ensure the action exists in the inventory and is webhook-allowed.
    let exists = inventory::iter::<crate::provider::authz::permission::EndpointPermissionBinding>()
        .into_iter()
        .any(|b| {
            b.webhook_allowed && b.allow_app && format!("{}.{}", b.resource, b.action) == normalized
        });
    if !exists {
        return Err(ABError::BadRequest(format!(
            "action '{}' is not a webhookable action",
            action
        )));
    }
    Ok(normalized)
}

#[authz(
    resource = "webhook",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = ["admin", "write"],
    allow_org = false,
    webhook_allowed = false,
)]
#[post("")]
async fn create_webhook(
    req: Json<CreateWebhookRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<WebhookResponse>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let body = req.into_inner();

    if body.url.trim().is_empty() {
        return Err(ABError::BadRequest("url cannot be empty".to_string()));
    }
    if body.actions.is_empty() {
        return Err(ABError::BadRequest(
            "at least one action must be specified".to_string(),
        ));
    }
    let mut actions = Vec::with_capacity(body.actions.len());
    for a in &body.actions {
        actions.push(validate_action(a)?);
    }
    actions.sort();
    actions.dedup();

    let pool = state.db_pool.clone();
    let new_entry = NewWebhookEntry {
        url: body.url.clone(),
        status: "active".to_string(),
        secret: body.secret.clone().filter(|s| !s.is_empty()),
        organisation: organisation.clone(),
        application: application.clone(),
        description: body.description.clone(),
    };
    let actions_for_insert = actions.clone();

    let (wh, saved_actions): (WebhookEntry, Vec<String>) = run_blocking!({
        let mut conn = pool.get()?;
        conn.transaction::<_, diesel::result::Error, _>(|conn| {
            let wh: WebhookEntry = diesel::insert_into(webhooks_table)
                .values(&new_entry)
                .returning(WebhookEntry::as_returning())
                .get_result(conn)?;

            let rows: Vec<WebhookActionEntry> = actions_for_insert
                .iter()
                .map(|a| WebhookActionEntry {
                    webhook_id: wh.id,
                    action: a.clone(),
                })
                .collect();
            diesel::insert_into(webhook_actions_table)
                .values(&rows)
                .execute(conn)?;

            Ok((wh, actions_for_insert.clone()))
        })
        .map_err(crate::types::ABError::from)
    })?;

    Ok(Json(to_response(wh, saved_actions)))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    allow_org = false,
    webhook_allowed = false,
)]
#[get("")]
async fn list_webhooks(
    pagination: Query<PaginatedQuery>,
    filters: Query<ListWebhooksQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<WebhookResponse>>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let page_q = pagination.into_inner();
    let action_filter = filters.into_inner().action.map(|s| s.to_ascii_lowercase());

    let (items, total): (Vec<(WebhookEntry, Vec<String>)>, i64) = run_blocking!({
        let mut conn = pool.get()?;

        let mut query = webhooks_table
            .filter(w_organisation.eq(&organisation))
            .filter(w_application.eq(&application))
            .filter(w_status.ne("deleted"))
            .into_boxed();

        if let Some(act) = action_filter.as_ref() {
            let ids: Vec<Uuid> = webhook_actions_table
                .filter(wa_action.eq(act))
                .select(wa_webhook_id)
                .load(&mut conn)?;
            query = query.filter(w_id.eq_any(ids));
        }

        let total: i64 = {
            let mut c_query = webhooks_table
                .filter(w_organisation.eq(&organisation))
                .filter(w_application.eq(&application))
                .filter(w_status.ne("deleted"))
                .into_boxed();
            if let Some(act) = action_filter.as_ref() {
                let ids: Vec<Uuid> = webhook_actions_table
                    .filter(wa_action.eq(act))
                    .select(wa_webhook_id)
                    .load(&mut conn)?;
                c_query = c_query.filter(w_id.eq_any(ids));
            }
            c_query.count().get_result(&mut conn)?
        };

        let webhooks: Vec<WebhookEntry> = match page_q {
            PaginatedQuery::All => query.select(WebhookEntry::as_select()).load(&mut conn)?,
            PaginatedQuery::Paginated { page, count } => query
                .select(WebhookEntry::as_select())
                .limit(count as i64)
                .offset(((page - 1) * count) as i64)
                .load(&mut conn)?,
        };

        let mut out = Vec::with_capacity(webhooks.len());
        for wh in webhooks {
            let actions: Vec<String> = webhook_actions_table
                .filter(wa_webhook_id.eq(wh.id))
                .select(wa_action)
                .load(&mut conn)?;
            out.push((wh, actions));
        }

        Ok((out, total))
    })?;

    let data: Vec<WebhookResponse> = items.into_iter().map(|(w, a)| to_response(w, a)).collect();

    let (total_items, total_pages) = match page_q {
        PaginatedQuery::All => (total as u64, 1u32),
        PaginatedQuery::Paginated { count, .. } => {
            let pages = ((total as f64) / (count as f64)).ceil() as u32;
            (total as u64, pages.max(1))
        }
    };

    Ok(Json(PaginatedResponse {
        data,
        total_items,
        total_pages,
    }))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    allow_org = false,
    webhook_allowed = false,
)]
#[get("/{webhook_id}")]
async fn get_webhook(
    webhook_id: Path<Uuid>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<WebhookResponse>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let wid = webhook_id.into_inner();

    let (wh, actions): (WebhookEntry, Vec<String>) = run_blocking!({
        let mut conn = pool.get()?;
        let wh: WebhookEntry = webhooks_table
            .filter(w_id.eq(wid))
            .filter(w_organisation.eq(&organisation))
            .filter(w_application.eq(&application))
            .filter(w_status.ne("deleted"))
            .select(WebhookEntry::as_select())
            .first(&mut conn)?;
        let actions: Vec<String> = webhook_actions_table
            .filter(wa_webhook_id.eq(wh.id))
            .select(wa_action)
            .load(&mut conn)?;
        Ok((wh, actions))
    })?;

    Ok(Json(to_response(wh, actions)))
}

#[authz(
    resource = "webhook",
    action = "update",
    org_roles = ["owner", "admin"],
    app_roles = ["admin", "write"],
    allow_org = false,
    webhook_allowed = false,
)]
#[patch("/{webhook_id}")]
async fn update_webhook(
    webhook_id: Path<Uuid>,
    req: Json<UpdateWebhookRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<WebhookResponse>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let wid = webhook_id.into_inner();
    let body = req.into_inner();

    let mut new_actions: Option<Vec<String>> = None;
    if let Some(actions) = body.actions.as_ref() {
        let mut normalized = Vec::with_capacity(actions.len());
        for a in actions {
            normalized.push(validate_action(a)?);
        }
        normalized.sort();
        normalized.dedup();
        new_actions = Some(normalized);
    }

    if let Some(ref s) = body.status {
        if !["active", "disabled"].contains(&s.as_str()) {
            return Err(ABError::BadRequest(
                "status must be 'active' or 'disabled'".to_string(),
            ));
        }
    }

    let (wh, actions_out): (WebhookEntry, Vec<String>) = run_blocking!({
        let mut conn = pool.get()?;
        conn.transaction::<_, diesel::result::Error, _>(|conn| {
            let existing: WebhookEntry = webhooks_table
                .filter(w_id.eq(wid))
                .filter(w_organisation.eq(&organisation))
                .filter(w_application.eq(&application))
                .filter(w_status.ne("deleted"))
                .select(WebhookEntry::as_select())
                .first(conn)?;

            use crate::utils::db::schema::hyperotaserver::webhooks::dsl as w_dsl;
            diesel::update(webhooks_table.filter(w_id.eq(existing.id)))
                .set(w_dsl::updated_at.eq(Utc::now()))
                .execute(conn)?;

            if let Some(url) = body.url.as_ref() {
                diesel::update(webhooks_table.filter(w_id.eq(existing.id)))
                    .set(w_dsl::url.eq(url))
                    .execute(conn)?;
            }
            if let Some(status) = body.status.as_ref() {
                diesel::update(webhooks_table.filter(w_id.eq(existing.id)))
                    .set(w_dsl::status.eq(status))
                    .execute(conn)?;
            }
            if let Some(desc) = body.description.as_ref() {
                diesel::update(webhooks_table.filter(w_id.eq(existing.id)))
                    .set(w_dsl::description.eq(desc.clone()))
                    .execute(conn)?;
            }
            if let Some(secret) = body.secret.as_ref() {
                diesel::update(webhooks_table.filter(w_id.eq(existing.id)))
                    .set(w_dsl::secret.eq(secret.clone()))
                    .execute(conn)?;
            }

            if let Some(ref actions) = new_actions {
                diesel::delete(webhook_actions_table.filter(wa_webhook_id.eq(existing.id)))
                    .execute(conn)?;
                let rows: Vec<WebhookActionEntry> = actions
                    .iter()
                    .map(|a| WebhookActionEntry {
                        webhook_id: existing.id,
                        action: a.clone(),
                    })
                    .collect();
                diesel::insert_into(webhook_actions_table)
                    .values(&rows)
                    .execute(conn)?;
            }

            let refreshed: WebhookEntry = webhooks_table
                .filter(w_id.eq(existing.id))
                .select(WebhookEntry::as_select())
                .first(conn)?;
            let actions: Vec<String> = webhook_actions_table
                .filter(wa_webhook_id.eq(refreshed.id))
                .select(wa_action)
                .load(conn)?;
            Ok((refreshed, actions))
        })
        .map_err(crate::types::ABError::from)
    })?;

    Ok(Json(to_response(wh, actions_out)))
}

#[authz(
    resource = "webhook",
    action = "delete",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"],
    allow_org = false,
    webhook_allowed = false,
)]
#[delete("/{webhook_id}")]
async fn delete_webhook(
    webhook_id: Path<Uuid>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let wid = webhook_id.into_inner();

    run_blocking!({
        let mut conn = pool.get()?;
        use crate::utils::db::schema::hyperotaserver::webhooks::dsl as w_dsl;
        let n = diesel::update(
            webhooks_table
                .filter(w_id.eq(wid))
                .filter(w_organisation.eq(&organisation))
                .filter(w_application.eq(&application))
                .filter(w_status.ne("deleted")),
        )
        .set((
            w_dsl::status.eq("deleted"),
            w_dsl::updated_at.eq(Utc::now()),
        ))
        .execute(&mut conn)?;
        if n == 0 {
            return Err(ABError::NotFound("webhook not found".to_string()));
        }
        Ok(())
    })?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

#[authz(
    resource = "webhook",
    action = "test",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"],
    allow_org = false,
    webhook_allowed = false,
)]
#[post("/{webhook_id}/test")]
async fn test_webhook(
    webhook_id: Path<Uuid>,
    req: Option<Json<TestWebhookRequest>>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let wid = webhook_id.into_inner();
    let override_body = req.map(|r| r.into_inner());

    let wh: WebhookEntry = run_blocking!({
        let mut conn = pool.get()?;
        let wh: WebhookEntry = webhooks_table
            .filter(w_id.eq(wid))
            .filter(w_organisation.eq(&organisation))
            .filter(w_application.eq(&application))
            .filter(w_status.ne("deleted"))
            .select(WebhookEntry::as_select())
            .first(&mut conn)?;
        Ok(wh)
    })?;

    // Construct a one-off dispatch (bypasses action lookup since we target a single webhook).
    let payload = crate::webhook::dispatcher::build_payload(
        true,
        "test",
        "webhook",
        Some(wh.id.to_string()),
        Some(serde_json::json!({
            "message": "This is a test webhook from Airborne",
            "sent_by": auth.username,
        })),
    );

    let target_url = override_body
        .as_ref()
        .and_then(|b| b.url.clone())
        .unwrap_or_else(|| wh.url.clone());
    let secret = override_body
        .as_ref()
        .and_then(|b| b.secret.clone())
        .or(wh.secret.clone());

    // Directly dispatch a single webhook without going through action-matching.
    let pool_for_dispatch = state.db_pool.clone();
    let wh_id = wh.id;
    tokio::spawn(async move {
        let _ = send_single_webhook(pool_for_dispatch, wh_id, target_url, secret, payload).await;
    });

    Ok(Json(serde_json::json!({ "queued": true })))
}

async fn send_single_webhook(
    pool: crate::utils::db::DbPool,
    webhook_id: Uuid,
    url: String,
    secret: Option<String>,
    payload: crate::webhook::types::WebhookPayload,
) -> Result<(), String> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;

    let body = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let ts = Utc::now().timestamp().to_string();
    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Airborne-Event", &payload.action)
        .header("X-Timestamp", &ts);

    if let Some(sec) = secret.as_deref() {
        if let Ok(mut mac) = HmacSha256::new_from_slice(sec.as_bytes()) {
            mac.update(ts.as_bytes());
            mac.update(b".");
            mac.update(body.as_bytes());
            let sig = hex::encode(mac.finalize().into_bytes());
            req = req.header("X-Signature", format!("sha256={}", sig));
        }
    }

    let (success, status_code, response_json) = match req.body(body.clone()).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16() as i32;
            let ok = resp.status().is_success();
            let text = resp.text().await.unwrap_or_default();
            let json = serde_json::from_str::<serde_json::Value>(&text)
                .unwrap_or_else(|_| serde_json::json!({ "body": text }));
            (ok, Some(status), json)
        }
        Err(err) => (false, None, serde_json::json!({ "error": err.to_string() })),
    };

    let payload_value = serde_json::to_value(&payload).unwrap_or_else(|_| serde_json::json!({}));
    let entry = crate::utils::db::models::NewWebhookLogEntry {
        webhook_id,
        action: payload.action.clone(),
        resource_type: payload.resource_type.clone(),
        resource_id: payload.resource_id.clone(),
        success,
        status_code,
        response: response_json,
        webhook_payload: payload_value,
    };
    let _ = tokio::task::spawn_blocking(move || {
        let mut conn = pool.get().map_err(|e| e.to_string())?;
        diesel::insert_into(webhook_logs_table)
            .values(&entry)
            .execute(&mut conn)
            .map_err(|e| e.to_string())
    })
    .await;

    Ok(())
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    allow_org = false,
    webhook_allowed = false,
)]
#[get("/{webhook_id}/logs")]
async fn list_webhook_logs(
    webhook_id: Path<Uuid>,
    pagination: Query<PaginatedQuery>,
    filters: Query<ListLogsQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<WebhookLogResponse>>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let wid = webhook_id.into_inner();
    let page_q = pagination.into_inner();
    let filters = filters.into_inner();

    let (logs, total): (Vec<WebhookLogEntry>, i64) = run_blocking!({
        let mut conn = pool.get()?;

        // Ownership check
        let _wh: WebhookEntry = webhooks_table
            .filter(w_id.eq(wid))
            .filter(w_organisation.eq(&organisation))
            .filter(w_application.eq(&application))
            .select(WebhookEntry::as_select())
            .first(&mut conn)?;

        let mut q = webhook_logs_table
            .filter(wl_webhook_id.eq(wid))
            .into_boxed();
        let mut c = webhook_logs_table
            .filter(wl_webhook_id.eq(wid))
            .into_boxed();
        if let Some(ref action) = filters.action {
            let action = action.to_ascii_lowercase();
            q = q.filter(wl_action.eq(action.clone()));
            c = c.filter(wl_action.eq(action));
        }
        if let Some(success) = filters.success {
            q = q.filter(wl_success.eq(success));
            c = c.filter(wl_success.eq(success));
        }
        let total: i64 = c.count().get_result(&mut conn)?;
        let logs: Vec<WebhookLogEntry> = match page_q {
            PaginatedQuery::All => q
                .order(wl_created_at.desc())
                .select(WebhookLogEntry::as_select())
                .load(&mut conn)?,
            PaginatedQuery::Paginated { page, count } => q
                .order(wl_created_at.desc())
                .limit(count as i64)
                .offset(((page - 1) * count) as i64)
                .select(WebhookLogEntry::as_select())
                .load(&mut conn)?,
        };
        Ok((logs, total))
    })?;

    let data: Vec<WebhookLogResponse> = logs
        .into_iter()
        .map(|l| WebhookLogResponse {
            id: l.id,
            webhook_id: l.webhook_id,
            action: l.action,
            resource_type: l.resource_type,
            resource_id: l.resource_id,
            success: l.success,
            status_code: l.status_code,
            response: l.response,
            webhook_payload: l.webhook_payload,
            created_at: l.created_at,
        })
        .collect();

    let (total_items, total_pages) = match page_q {
        PaginatedQuery::All => (total as u64, 1u32),
        PaginatedQuery::Paginated { count, .. } => {
            let pages = ((total as f64) / (count as f64)).ceil() as u32;
            (total as u64, pages.max(1))
        }
    };

    Ok(Json(PaginatedResponse {
        data,
        total_items,
        total_pages,
    }))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    allow_org = false,
    webhook_allowed = false,
)]
#[get("/{webhook_id}/metrics")]
async fn get_webhook_metrics(
    webhook_id: Path<Uuid>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<WebhookMetrics>> {
    let auth = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    let pool = state.db_pool.clone();
    let wid = webhook_id.into_inner();

    let (total, success): (i64, i64) = run_blocking!({
        let mut conn = pool.get()?;
        let _wh: WebhookEntry = webhooks_table
            .filter(w_id.eq(wid))
            .filter(w_organisation.eq(&organisation))
            .filter(w_application.eq(&application))
            .select(WebhookEntry::as_select())
            .first(&mut conn)?;

        let total: i64 = webhook_logs_table
            .filter(wl_webhook_id.eq(wid))
            .count()
            .get_result(&mut conn)?;
        let success: i64 = webhook_logs_table
            .filter(wl_webhook_id.eq(wid))
            .filter(wl_success.eq(true))
            .count()
            .get_result(&mut conn)?;
        Ok((total, success))
    })?;

    let failed = total - success;
    let success_rate = if total > 0 {
        (success as f64) / (total as f64)
    } else {
        0.0
    };

    Ok(Json(WebhookMetrics {
        total,
        success,
        failed,
        success_rate,
    }))
}

#[derive(serde::Serialize)]
pub struct WebhookableAction {
    pub key: String,
    pub resource: String,
    pub action: String,
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    allow_org = false,
    webhook_allowed = false,
)]
#[get("/actions")]
async fn list_webhookable_actions(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Vec<WebhookableAction>>> {
    let _ = auth_response;
    let _ = state;
    let mut out = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for b in inventory::iter::<crate::provider::authz::permission::EndpointPermissionBinding> {
        if !b.webhook_allowed || !b.allow_app {
            continue;
        }
        let key = format!("{}.{}", b.resource, b.action);
        if seen.insert(key.clone()) {
            out.push(WebhookableAction {
                key,
                resource: b.resource.to_string(),
                action: b.action.to_string(),
            });
        }
    }
    Ok(Json(out))
}

/// Ad-hoc test: send a test payload directly to a URL without persisting the
/// webhook. Used by the "Test" button in the create-webhook form. Returns the
/// delivery result synchronously so the UI can show success/failure inline.
#[authz(
    resource = "webhook",
    action = "test",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"],
    allow_org = false,
    webhook_allowed = false,
)]
#[post("/test")]
async fn adhoc_test_webhook(
    req: Json<AdhocTestWebhookRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<AdhocTestWebhookResponse>> {
    let _ = state;
    let auth = auth_response.into_inner();
    let body = req.into_inner();
    if body.url.trim().is_empty() {
        return Err(ABError::BadRequest("url is required".to_string()));
    }

    let payload = crate::webhook::dispatcher::build_payload(
        true,
        "test",
        "webhook",
        None,
        Some(serde_json::json!({
            "message": "This is a test webhook from Airborne",
            "sent_by": auth.username,
        })),
    );

    let body_str =
        serde_json::to_string(&payload).map_err(|e| ABError::InternalServerError(e.to_string()))?;
    let ts = Utc::now().timestamp().to_string();
    let client = reqwest::Client::new();
    let mut request = client
        .post(&body.url)
        .header("Content-Type", "application/json")
        .header("X-Airborne-Event", &payload.action)
        .header("X-Timestamp", &ts);

    if let Some(secret) = body.secret.as_deref().filter(|s| !s.is_empty()) {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        if let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) {
            mac.update(ts.as_bytes());
            mac.update(b".");
            mac.update(body_str.as_bytes());
            let sig = hex::encode(mac.finalize().into_bytes());
            request = request.header("X-Signature", format!("sha256={}", sig));
        }
    }

    let (success, status_code, response_json) = match request.body(body_str).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16() as i32;
            let ok = resp.status().is_success();
            let text = resp.text().await.unwrap_or_default();
            let json = serde_json::from_str::<serde_json::Value>(&text)
                .unwrap_or_else(|_| serde_json::json!({ "body": text }));
            (ok, Some(status), json)
        }
        Err(err) => (false, None, serde_json::json!({ "error": err.to_string() })),
    };

    Ok(Json(AdhocTestWebhookResponse {
        success,
        status_code,
        response: response_json,
    }))
}

/// Dispatch helper used from other modules. Wraps `send_webhook` but accepts
/// just the app state.
#[allow(clippy::too_many_arguments)]
pub fn fire(
    state: &AppState,
    organisation: String,
    application: String,
    success: bool,
    action: &str,
    resource_type: &str,
    resource_id: Option<String>,
    data: Option<serde_json::Value>,
) {
    send_webhook(
        state,
        organisation,
        application,
        success,
        action,
        resource_type,
        resource_id,
        data,
    );
}
