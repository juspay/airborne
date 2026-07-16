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

use actix_web::web;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::types::{AppState, Result};
use crate::utils::db::models::{NewWebhookDeliveryEntry, WebhookEntry};
use crate::utils::kronos;
use crate::webhook::{store, types::WebhookEnvelope};

/// An event to be turned into deliveries. Built once per emit so that every webhook
/// subscribed to the same event stamps an identical `created_at`.
pub struct EventContext<'a> {
    pub org: &'a str,
    /// The application the event happened in, or `None` for an org-level event.
    pub app: Option<&'a str>,
    pub event: &'a str,
    pub data: &'a serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Build the `scheduled` delivery row for one webhook, envelope payload included.
pub fn build_delivery(
    ctx: &EventContext,
    webhook: &WebhookEntry,
    delay_secs: i64,
    is_test: bool,
) -> NewWebhookDeliveryEntry {
    let delivery_id = Uuid::now_v7();
    let envelope = WebhookEnvelope {
        id: delivery_id.to_string(),
        event: ctx.event.to_string(),
        api_version: webhook.payload_version.clone(),
        created_at: ctx.created_at.to_rfc3339(),
        organisation: ctx.org.to_string(),
        // `None` for org-level events — the subscriber sees `"application": null`.
        application: ctx.app.map(str::to_string),
        data: ctx.data.clone(),
    };
    NewWebhookDeliveryEntry {
        id: delivery_id,
        webhook_id: webhook.id,
        org_id: ctx.org.to_string(),
        app_id: ctx.app.map(str::to_string),
        event: ctx.event.to_string(),
        payload: serde_json::to_value(&envelope).unwrap_or(serde_json::Value::Null),
        status: "scheduled".to_string(),
        kronos_job_id: None,
        scheduled_for: ctx.created_at + chrono::Duration::seconds(delay_secs.max(0)),
        max_attempts: if is_test { 1 } else { webhook.max_retries.max(1) },
        is_test,
        idempotency_key: delivery_id.to_string(),
    }
}

/// Emit an event to every subscribed webhook. `app` is the application the event happened
/// in, or `None` for an org-level event (`application.create`, `organisation_user.*`) that
/// belongs to no application; either way the org's own webhooks also receive it.
/// `delay_secs > 0` schedules the delivery in the future (e.g. 60s after a release concludes).
pub fn emit_event(
    state: &web::Data<AppState>,
    org: String,
    app: Option<String>,
    event: String,
    data: serde_json::Value,
    delay_secs: i64,
) {
    if state.kronos.is_none() {
        return;
    }
    let state = state.clone();
    tokio::spawn(async move {
        if let Err(e) = emit_inner(&state, org, app, event, data, delay_secs).await {
            log::error!("webhook emit failed: {e:?}");
        }
    });
}

async fn emit_inner(
    state: &web::Data<AppState>,
    org: String,
    app: Option<String>,
    event: String,
    data: serde_json::Value,
    delay_secs: i64,
) -> Result<()> {
    let kronos = match state.kronos.clone() {
        Some(k) => k,
        None => return Ok(()),
    };

    let webhooks =
        store::list_subscribed_webhooks(&state.db_pool, &org, app.as_deref(), &event).await?;
    if webhooks.is_empty() {
        return Ok(());
    }

    let ctx = EventContext {
        org: &org,
        app: app.as_deref(),
        event: &event,
        data: &data,
        created_at: chrono::Utc::now(),
    };

    for wh in webhooks {
        let new_delivery = build_delivery(&ctx, &wh, delay_secs, false);
        let delivery_id = new_delivery.id;
        let max_attempts = new_delivery.max_attempts;
        store::insert_delivery(&state.db_pool, new_delivery).await?;

        let trigger = if delay_secs > 0 {
            kronos::delayed(delay_secs)
        } else {
            kronos::immediate()
        };
        match super::submit_webhook_job(
            kronos.as_ref(),
            &state.env.kronos_workspace,
            &delivery_id.to_string(),
            trigger,
            max_attempts,
        )
        .await
        {
            Ok(job_id) => {
                store::set_delivery_kronos_job(&state.db_pool, delivery_id, &job_id, "queued")
                    .await
                    .ok();
            }
            Err(e) => {
                log::error!("failed to enqueue webhook job for delivery {delivery_id}: {e:?}");
                store::set_delivery_status(&state.db_pool, delivery_id, "failed")
                    .await
                    .ok();
            }
        }
    }

    Ok(())
}
