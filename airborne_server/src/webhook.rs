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

mod dispatch;
mod emit;
mod maintenance;
mod mw;
mod sign;
mod store;
mod types;

use std::collections::HashSet;
use std::sync::Arc;

use actix_web::{delete, get, post, put, web, web::Json, web::ReqData, Scope};
use airborne_authz_macros::authz;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::middleware::auth::{require_scope_name, AuthResponse};
use crate::provider::authz::permission::EndpointPermissionBinding;
use crate::run_blocking;
use crate::types::{ABError, AppState, ListResponse, Result};
use crate::utils::db::models::{
    NewWebhookDeliveryEntry, NewWebhookEntry, WebhookChangeset, WebhookDeliveryEntry,
};
use crate::utils::kronos;

pub use emit::emit_event;
pub use mw::{record_event, WebhookEmit};

use types::{
    CreateWebhookRequest, EventCatalogItem, EventsResponse, RotateSecretResponse,
    TestWebhookRequest, UpdateWebhookRequest, WebhookAttempt, WebhookResponse, ALLOWED_METHODS,
    DEFAULT_METHOD, DEFAULT_PAYLOAD_VERSION,
};

/// The dispatch endpoint (per Kronos schema) that points back at Airborne's delivery callback.
pub const DISPATCH_ENDPOINT_NAME: &str = "airborne-webhook-dispatcher";
/// The Kronos secret holding Airborne's internal callback token.
pub const DISPATCHER_SECRET_NAME: &str = "airborne-internal-token";
/// The endpoint the recurring Kronos job calls to run delivery retention.
pub const MAINTENANCE_ENDPOINT_NAME: &str = "airborne-webhook-maintenance";

/// Provision the workspace, store the internal secret, and register the delivery
pub async fn setup_dispatcher(
    client: &dyn kronos::KronosClient,
    schema: &str,
    callback_base_url: &str,
    internal_secret: &str,
    timeout_secs: u64,
) -> Result<()> {
    kronos::provision_workspace(client, schema).await?;
    kronos::upsert_secret(client, schema, DISPATCHER_SECRET_NAME, internal_secret).await?;
    let url = format!(
        "{}/internal/webhooks/dispatch",
        callback_base_url.trim_end_matches('/')
    );
    kronos::register_http_endpoint(
        client,
        schema,
        DISPATCH_ENDPOINT_NAME,
        &url,
        DISPATCHER_SECRET_NAME,
        timeout_secs,
    )
    .await
}

/// Register the retention endpoint (`/internal/webhooks/maintenance`). The workspace and
/// internal secret are already provisioned by [`setup_dispatcher`].
pub async fn setup_maintenance(
    client: &dyn kronos::KronosClient,
    schema: &str,
    callback_base_url: &str,
    timeout_secs: u64,
) -> Result<()> {
    let url = format!(
        "{}/internal/webhooks/maintenance",
        callback_base_url.trim_end_matches('/')
    );
    kronos::register_http_endpoint(
        client,
        schema,
        MAINTENANCE_ENDPOINT_NAME,
        &url,
        DISPATCHER_SECRET_NAME,
        timeout_secs,
    )
    .await
}

/// Enqueue a delivery job. Kronos POSTs `{ "delivery_id": <id> }` to the dispatch endpoint.
pub async fn submit_webhook_job(
    client: &dyn kronos::KronosClient,
    schema: &str,
    delivery_id: &str,
    trigger: kronos::JobTrigger,
    max_attempts: i32,
) -> Result<String> {
    kronos::create_job(
        client,
        schema,
        DISPATCH_ENDPOINT_NAME,
        json!({ "delivery_id": delivery_id }),
        max_attempts.max(1) as i64,
        trigger,
        Some(delivery_id),
    )
    .await
}

/// Schedule the retention run `delay_secs` in the future. The maintenance handler calls
/// this again to form a daily chain; a per-day idempotency key makes it safe across pods.
pub async fn schedule_maintenance(
    client: &dyn kronos::KronosClient,
    schema: &str,
    delay_secs: i64,
) -> Result<()> {
    let run_at = chrono::Utc::now() + chrono::Duration::seconds(delay_secs);
    let key = format!("webhook-maintenance-{}", run_at.format("%Y%m%d"));
    kronos::create_job_idempotent(
        client,
        schema,
        MAINTENANCE_ENDPOINT_NAME,
        json!({}),
        3,
        kronos::JobTrigger::Delayed { run_at },
        &key,
    )
    .await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn parse_uuid(raw: &str) -> Result<Uuid> {
    Uuid::parse_str(raw).map_err(|_| ABError::BadRequest(format!("Invalid id '{raw}'")))
}

fn require_kronos_enabled(state: &web::Data<AppState>) -> Result<()> {
    if state.env.kronos_enabled {
        Ok(())
    } else {
        Err(ABError::BadRequest(
            "Webhooks are disabled on this server".into(),
        ))
    }
}

fn require_kronos(state: &web::Data<AppState>) -> Result<&Arc<dyn kronos::KronosClient>> {
    state
        .kronos
        .as_ref()
        .ok_or_else(|| ABError::BadRequest("Webhooks are disabled on this server".into()))
}

/// The webhook's own scope: `Some(app)` when the request carried an `x-application`
/// header (application-scoped), `None` when it carried only `x-organisation`
/// (organisation-scoped — fires for every app in the org). Scope is fixed at creation.
fn webhook_scope(auth: &AuthResponse) -> Result<(String, Option<String>)> {
    let org = require_scope_name(auth.organisation.clone(), "organisation")?;
    Ok((org, auth.application.as_ref().map(|a| a.name.clone())))
}

/// Events that happen outside any application, so only an **org-scoped** webhook can
/// receive them:
/// - organisation-scoped actions (`organisation*`) — no application is involved;
/// - `application.create` — the application does not exist yet when it fires.
///
/// `event` is the combined `resource.action` key.
fn is_org_only_event(event: &str) -> bool {
    event.starts_with("organisation") || event == "application.create"
}

/// Webhook administration is not itself a webhook event — `mw::maybe_emit` skips the
/// `webhook` resource, so offering these would create subscriptions that never fire.
fn is_self_event(resource: &str) -> bool {
    resource == "webhook"
}

/// The subscribable event catalog = every non-`read` authz action, minus webhook
/// administration. An **app**-scoped webhook additionally cannot see the org-only
/// events (see [`is_org_only_event`]); an org-scoped one sees everything.
fn event_catalog(app_scoped: bool) -> HashSet<String> {
    inventory::iter::<EndpointPermissionBinding>()
        .filter(|b| b.action != "read" && !is_self_event(b.resource))
        .map(|b| format!("{}.{}", b.resource, b.action))
        .filter(|event| !(app_scoped && is_org_only_event(event)))
        .collect()
}

fn validate_events(events: &[String], app_scoped: bool) -> Result<()> {
    if events.is_empty() {
        return Err(ABError::BadRequest("At least one event is required".into()));
    }
    let catalog = event_catalog(app_scoped);
    for e in events {
        if !catalog.contains(e) {
            return Err(ABError::BadRequest(format!("Unknown event '{e}'")));
        }
    }
    Ok(())
}

/// Normalise + reject anything outside [`ALLOWED_METHODS`].
fn validate_method(method: &str) -> Result<String> {
    let m = method.trim().to_uppercase();
    if !ALLOWED_METHODS.contains(&m.as_str()) {
        return Err(ABError::BadRequest(format!(
            "Unsupported method '{m}'. Allowed: {}",
            ALLOWED_METHODS.join(", ")
        )));
    }
    Ok(m)
}

async fn validate_url(allow_insecure: bool, url: &str) -> Result<()> {
    let url = url.to_string();
    run_blocking!({ crate::webhook::sign::validate_url(&url, allow_insecure) })
}

// ---------------------------------------------------------------------------
// Config CRUD
// ---------------------------------------------------------------------------

#[authz(
    resource = "webhook",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("")]
async fn create_webhook_handler(
    req: Json<CreateWebhookRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<WebhookResponse>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    require_kronos_enabled(&state)?;
    let req = req.into_inner();

    if req.name.trim().is_empty() {
        return Err(ABError::BadRequest("name is required".into()));
    }
    validate_events(&req.events, app.is_some())?;
    let method = validate_method(req.method.as_deref().unwrap_or(DEFAULT_METHOD))?;
    validate_url(state.env.webhook_allow_insecure, &req.url).await?;

    // Optional signing secret (user-provided or generated on the page). None => unsigned.
    let secret_encrypted = match req.secret.as_deref() {
        Some(s) if !s.trim().is_empty() => {
            Some(sign::encrypt_secret(s.trim(), state.master_encryption_key.as_deref()).await?)
        }
        _ => None,
    };
    let max_retries = req
        .max_retries
        .unwrap_or(state.env.webhook_max_retries)
        .clamp(0, 20);

    let new = NewWebhookEntry {
        org_id: org,
        app_id: app,
        name: req.name.trim().to_string(),
        description: req.description.unwrap_or_default(),
        url: req.url,
        method,
        events: serde_json::to_value(&req.events).unwrap_or_else(|_| json!([])),
        secret_encrypted,
        custom_headers: req.custom_headers.unwrap_or_else(|| json!({})),
        enabled: req.enabled.unwrap_or(true),
        payload_version: DEFAULT_PAYLOAD_VERSION.to_string(),
        max_retries,
        created_by: auth.sub.clone(),
        updated_by: auth.sub.clone(),
    };
    let entry = store::create_webhook(&state.db_pool, new).await?;
    Ok(Json(WebhookResponse::from_entry(&entry)))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn list_webhooks_handler(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ListResponse<Vec<WebhookResponse>>>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    let entries = store::list_webhooks(&state.db_pool, &org, app.as_deref()).await?;
    let data = entries.iter().map(WebhookResponse::from_entry).collect();
    Ok(Json(ListResponse { data }))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/events")]
async fn list_events_handler(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<EventsResponse>> {
    let auth = auth_response.into_inner();
    // An org-scoped webhook can subscribe to everything, including the org-only events.
    let (_org, app) = webhook_scope(&auth)?;
    let catalog = event_catalog(app.is_some());
    let conclude_delay = state.env.webhook_conclude_delay_secs;

    let mut seen = HashSet::new();
    let mut events: Vec<EventCatalogItem> = Vec::new();
    for b in inventory::iter::<EndpointPermissionBinding>() {
        let key = format!("{}.{}", b.resource, b.action);
        if !catalog.contains(&key) {
            continue;
        }
        if !seen.insert(key.clone()) {
            continue;
        }
        let default_delay_seconds = if key == "release.conclude" {
            conclude_delay
        } else {
            0
        };
        events.push(EventCatalogItem {
            key,
            resource: b.resource.to_string(),
            action: b.action.to_string(),
            default_delay_seconds,
        });
    }
    events.sort_by(|a, b| a.key.cmp(&b.key));
    Ok(Json(EventsResponse { events }))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{webhook_id}")]
async fn get_webhook_handler(
    path: web::Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<WebhookResponse>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    let id = parse_uuid(&path)?;
    let entry = store::get_webhook(&state.db_pool, &org, app.as_deref(), id).await?;
    Ok(Json(WebhookResponse::from_entry(&entry)))
}

#[authz(
    resource = "webhook",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[put("/{webhook_id}")]
async fn update_webhook_handler(
    path: web::Path<String>,
    req: Json<UpdateWebhookRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<WebhookResponse>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    require_kronos_enabled(&state)?;
    let id = parse_uuid(&path)?;
    let req = req.into_inner();

    if let Some(events) = &req.events {
        validate_events(events, app.is_some())?;
    }
    let method = req.method.as_deref().map(validate_method).transpose()?;
    if let Some(url) = &req.url {
        validate_url(state.env.webhook_allow_insecure, url).await?;
    }

    // Secret: absent => unchanged, empty => clear (unsign), value => set.
    let secret_encrypted = match req.secret.as_deref() {
        None => None,
        Some(s) if s.trim().is_empty() => Some(None),
        Some(s) => Some(Some(
            sign::encrypt_secret(s.trim(), state.master_encryption_key.as_deref()).await?,
        )),
    };
    let changeset = WebhookChangeset {
        description: req.description,
        url: req.url,
        method,
        events: req
            .events
            .map(|e| serde_json::to_value(e).unwrap_or_else(|_| json!([]))),
        custom_headers: req.custom_headers,
        enabled: req.enabled,
        max_retries: req.max_retries.map(|m| m.clamp(0, 20)),
        secret_encrypted,
        updated_by: Some(auth.sub.clone()),
        updated_at: Some(chrono::Utc::now()),
    };
    let entry = store::update_webhook(&state.db_pool, &org, app.as_deref(), id, changeset).await?;
    Ok(Json(WebhookResponse::from_entry(&entry)))
}

#[authz(
    resource = "webhook",
    action = "delete",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[delete("/{webhook_id}")]
async fn delete_webhook_handler(
    path: web::Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<serde_json::Value>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    let id = parse_uuid(&path)?;
    let n = store::delete_webhook(&state.db_pool, &org, app.as_deref(), id).await?;
    if n == 0 {
        return Err(ABError::NotFound("webhook not found".into()));
    }
    Ok(Json(json!({ "success": true })))
}

#[authz(
    resource = "webhook",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{webhook_id}/rotate-secret")]
async fn rotate_secret_handler(
    path: web::Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<RotateSecretResponse>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    require_kronos_enabled(&state)?;
    let id = parse_uuid(&path)?;

    // Ensure it exists / is in scope.
    let _ = store::get_webhook(&state.db_pool, &org, app.as_deref(), id).await?;

    let secret = sign::generate_secret();
    let secret_encrypted =
        sign::encrypt_secret(&secret, state.master_encryption_key.as_deref()).await?;
    let changeset = WebhookChangeset {
        secret_encrypted: Some(Some(secret_encrypted)),
        updated_by: Some(auth.sub.clone()),
        updated_at: Some(chrono::Utc::now()),
        ..Default::default()
    };
    store::update_webhook(&state.db_pool, &org, app.as_deref(), id, changeset).await?;
    Ok(Json(RotateSecretResponse { secret }))
}

// ---------------------------------------------------------------------------
// Deliveries, test, resend
// ---------------------------------------------------------------------------

/// Load a delivery, but only if its **owning webhook** is visible in the caller's scope.
/// A delivery's own `app_id` is the app that *triggered* it, not the webhook's scope — an
/// org webhook's deliveries carry a triggering app — so it cannot be used to authorize.
async fn get_delivery_in_scope(
    state: &web::Data<AppState>,
    org: &str,
    app: Option<&str>,
    id: Uuid,
) -> Result<WebhookDeliveryEntry> {
    let delivery = store::get_delivery_by_id(&state.db_pool, id).await?;
    store::get_webhook(&state.db_pool, org, app, delivery.webhook_id).await?;
    Ok(delivery)
}

#[derive(Debug, Deserialize)]
struct DeliveryListQuery {
    #[serde(default)]
    page: Option<i64>,
    #[serde(default)]
    count: Option<i64>,
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{webhook_id}/deliveries")]
async fn list_deliveries_handler(
    path: web::Path<String>,
    query: web::Query<DeliveryListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<crate::types::PaginatedResponse<crate::utils::db::models::WebhookDeliveryEntry>>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    let id = parse_uuid(&path)?;
    let page = query.page.unwrap_or(1).max(1);
    let count = query.count.unwrap_or(20).clamp(1, 100);
    // Authorize on the webhook, then list by webhook id — see `store::list_deliveries`.
    store::get_webhook(&state.db_pool, &org, app.as_deref(), id).await?;
    let (rows, total) = store::list_deliveries(&state.db_pool, id, page, count).await?;
    let total_pages = ((total as f64) / (count as f64)).ceil() as u32;
    Ok(Json(crate::types::PaginatedResponse {
        data: rows,
        total_items: total as u64,
        total_pages: total_pages.max(1),
    }))
}

#[authz(
    resource = "webhook",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/deliveries/{delivery_id}")]
async fn get_delivery_handler(
    path: web::Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<WebhookDeliveryEntry>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    let id = parse_uuid(&path)?;
    // The delivery row carries its full attempt history in the `attempts` JSONB array.
    let delivery = get_delivery_in_scope(&state, &org, app.as_deref(), id).await?;
    Ok(Json(delivery))
}

#[authz(
    resource = "webhook",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/deliveries/{delivery_id}/resend")]
async fn resend_handler(
    path: web::Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<serde_json::Value>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    let kronos = require_kronos(&state)?;
    let id = parse_uuid(&path)?;

    let original = get_delivery_in_scope(&state, &org, app.as_deref(), id).await?;
    let new_id = Uuid::now_v7();
    let mut payload = original.payload.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("id".into(), json!(new_id.to_string()));
    }
    let max_attempts = original.max_attempts.max(1);

    let new_delivery = NewWebhookDeliveryEntry {
        id: new_id,
        webhook_id: original.webhook_id,
        org_id: org,
        // The app that triggered the original event — not the caller's scope, which is
        // `None` for an org webhook even when the event came from an app.
        app_id: original.app_id.clone(),
        event: original.event.clone(),
        payload,
        status: "scheduled".to_string(),
        kronos_job_id: None,
        scheduled_for: chrono::Utc::now(),
        max_attempts,
        is_test: false,
        idempotency_key: new_id.to_string(),
    };
    store::insert_delivery(&state.db_pool, new_delivery).await?;

    match submit_webhook_job(
        kronos.as_ref(),
        &state.env.kronos_workspace,
        &new_id.to_string(),
        kronos::immediate(),
        max_attempts,
    )
    .await
    {
        Ok(job_id) => {
            store::set_delivery_kronos_job(&state.db_pool, new_id, &job_id, "queued")
                .await
                .ok();
        }
        Err(e) => {
            store::set_delivery_status(&state.db_pool, new_id, "failed")
                .await
                .ok();
            return Err(e);
        }
    }
    Ok(Json(json!({ "delivery_id": new_id.to_string() })))
}

#[authz(
    resource = "webhook",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{webhook_id}/test")]
async fn test_handler(
    path: web::Path<String>,
    req: Json<TestWebhookRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<serde_json::Value>> {
    let auth = auth_response.into_inner();
    let (org, app) = webhook_scope(&auth)?;
    require_kronos_enabled(&state)?;
    let id = parse_uuid(&path)?;
    let req = req.into_inner();

    let webhook = store::get_webhook(&state.db_pool, &org, app.as_deref(), id).await?;
    let event = req.event.unwrap_or_else(|| "webhook.test".to_string());
    let data = req.payload.unwrap_or_else(|| {
        json!({ "message": "This is a test webhook delivery from Airborne", "webhook_id": id.to_string() })
    });

    let ctx = emit::EventContext {
        org: &org,
        app: app.as_deref(),
        event: &event,
        data: &data,
        created_at: chrono::Utc::now(),
    };
    let new_delivery = emit::build_delivery(&ctx, &webhook, 0, true);
    let delivery_id = new_delivery.id;
    store::insert_delivery(&state.db_pool, new_delivery).await?;

    // Deliver inline (bypasses Kronos) so the caller sees the response immediately.
    dispatch::execute_delivery(&state, delivery_id).await?;

    let delivery = store::get_delivery_by_id(&state.db_pool, delivery_id).await?;
    let attempts: Vec<WebhookAttempt> =
        serde_json::from_value(delivery.attempts.clone()).unwrap_or_default();
    let last = attempts.last();
    Ok(Json(json!({
        "delivery_id": delivery_id.to_string(),
        "status": delivery.status,
        "response_status": last.and_then(|a| a.response_status),
        "response_body": last.and_then(|a| a.response_body.clone()),
        "error": last.and_then(|a| a.error.clone()),
        "duration_ms": last.and_then(|a| a.duration_ms),
    })))
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/// Authenticated, app-scoped routes mounted at `/api/webhooks`.
pub fn add_routes() -> Scope {
    web::scope("")
        .service(create_webhook_handler)
        .service(list_webhooks_handler)
        .service(list_events_handler)
        .service(get_delivery_handler)
        .service(resend_handler)
        .service(get_webhook_handler)
        .service(update_webhook_handler)
        .service(delete_webhook_handler)
        .service(rotate_secret_handler)
        .service(test_handler)
        .service(list_deliveries_handler)
}

/// Internal, unauthenticated-by-JWT route (guarded by the internal secret) that
/// Kronos calls back into. Mounted at `/internal/webhooks/dispatch`.
pub fn add_internal_routes() -> Scope {
    web::scope("/webhooks")
        .route("/dispatch", web::post().to(dispatch::dispatch_handler))
        .route(
            "/maintenance",
            web::post().to(dispatch::maintenance_handler),
        )
}
