use chrono::Utc;
use diesel::prelude::*;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use tracing::{error, info};
use uuid::Uuid;

use crate::utils::db::{
    models::{NewWebhookLogEntry, WebhookEntry},
    schema::hyperotaserver::{
        webhook_actions::{
            action as wa_action, table as webhook_actions_table, webhook_id as wa_webhook_id,
        },
        webhook_logs::table as webhook_logs_table,
        webhooks::{
            application as w_application, organisation as w_organisation, status as w_status,
            table as webhooks_table,
        },
    },
    DbPool,
};
use crate::webhook::types::WebhookPayload;

type HmacSha256 = Hmac<Sha256>;

pub fn build_payload(
    success: bool,
    action: &str,
    resource_type: &str,
    resource_id: Option<String>,
    data: Option<serde_json::Value>,
) -> WebhookPayload {
    WebhookPayload {
        success,
        action: action.to_string(),
        timestamp: Utc::now(),
        resource_type: resource_type.to_string(),
        resource_id,
        data,
    }
}

fn compute_signature(secret: &str, body: &str, timestamp: &str) -> Option<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(timestamp.as_bytes());
    mac.update(b".");
    mac.update(body.as_bytes());
    let signature = mac.finalize().into_bytes();
    Some(hex::encode(signature))
}

/// Dispatches a webhook payload for all matching webhooks in an (org, app) scope.
/// Fire-and-forget: spawns a tokio task and returns immediately.
pub fn dispatch(pool: DbPool, organisation: String, application: String, payload: WebhookPayload) {
    tokio::spawn(async move {
        if let Err(err) = dispatch_inner(pool, organisation, application, payload).await {
            error!("Webhook dispatch failed: {}", err);
        }
    });
}

async fn dispatch_inner(
    pool: DbPool,
    organisation: String,
    application: String,
    payload: WebhookPayload,
) -> Result<(), String> {
    let action_str = payload.action.clone();

    // Fetch matching webhooks from DB on a blocking thread
    let pool_clone = pool.clone();
    let action_clone = action_str.clone();
    let org_clone = organisation.clone();
    let app_clone = application.clone();
    let matching: Vec<WebhookEntry> = tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().map_err(|e| e.to_string())?;
        let rows: Vec<WebhookEntry> = webhooks_table
            .inner_join(
                webhook_actions_table
                    .on(wa_webhook_id.eq(crate::utils::db::schema::hyperotaserver::webhooks::id)),
            )
            .filter(w_organisation.eq(&org_clone))
            .filter(w_application.eq(&app_clone))
            .filter(w_status.eq("active"))
            .filter(wa_action.eq(&action_clone))
            .select(WebhookEntry::as_select())
            .load(&mut conn)
            .map_err(|e| e.to_string())?;
        Ok::<_, String>(rows)
    })
    .await
    .map_err(|e| e.to_string())??;

    if matching.is_empty() {
        return Ok(());
    }

    let body = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    let client = reqwest::Client::new();

    for wh in matching {
        let wh_id = wh.id;
        let url = wh.url.clone();
        let secret = wh.secret.clone();
        let body_clone = body.clone();
        let payload_value =
            serde_json::to_value(&payload).unwrap_or_else(|_| serde_json::json!({}));
        let pool_for_log = pool.clone();
        let action_for_log = payload.action.clone();
        let resource_type_for_log = payload.resource_type.clone();
        let resource_id_for_log = payload.resource_id.clone();
        let client = client.clone();

        tokio::spawn(async move {
            let ts = Utc::now().timestamp().to_string();
            let mut req = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("X-Airborne-Event", &action_for_log)
                .header("X-Timestamp", &ts);

            if let Some(sec) = secret.as_deref() {
                if let Some(sig) = compute_signature(sec, &body_clone, &ts) {
                    req = req.header("X-Signature", format!("sha256={}", sig));
                }
            }

            let (success, status_code, response_json) =
                match req.body(body_clone.clone()).send().await {
                    Ok(resp) => {
                        let status = resp.status().as_u16() as i32;
                        let ok = resp.status().is_success();
                        let text = resp.text().await.unwrap_or_default();
                        let body_json = serde_json::from_str::<serde_json::Value>(&text)
                            .unwrap_or_else(|_| serde_json::json!({ "body": text }));
                        (ok, Some(status), body_json)
                    }
                    Err(err) => {
                        error!("webhook {} delivery error: {}", wh_id, err);
                        (false, None, serde_json::json!({ "error": err.to_string() }))
                    }
                };

            persist_log(
                pool_for_log,
                wh_id,
                action_for_log,
                resource_type_for_log,
                resource_id_for_log,
                success,
                status_code,
                response_json,
                payload_value,
            )
            .await;
        });
    }

    info!("Webhook dispatch complete for action '{}'", action_str);
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn persist_log(
    pool: DbPool,
    webhook_id: Uuid,
    action: String,
    resource_type: String,
    resource_id: Option<String>,
    success: bool,
    status_code: Option<i32>,
    response: serde_json::Value,
    webhook_payload: serde_json::Value,
) {
    let entry = NewWebhookLogEntry {
        webhook_id,
        action,
        resource_type,
        resource_id,
        success,
        status_code,
        response,
        webhook_payload,
    };
    let _ = tokio::task::spawn_blocking(move || {
        let mut conn = pool.get().map_err(|e| e.to_string())?;
        diesel::insert_into(webhook_logs_table)
            .values(&entry)
            .execute(&mut conn)
            .map_err(|e| e.to_string())
    })
    .await;
}

/// Fire-and-forget helper for callers. Constructs a payload and dispatches.
#[allow(clippy::too_many_arguments)]
pub fn send_webhook(
    state: &crate::types::AppState,
    organisation: String,
    application: String,
    success: bool,
    action: &str,
    resource_type: &str,
    resource_id: Option<String>,
    data: Option<serde_json::Value>,
) {
    let payload = build_payload(success, action, resource_type, resource_id, data);
    dispatch(state.db_pool.clone(), organisation, application, payload);
}
