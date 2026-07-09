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

use diesel::prelude::*;
use uuid::Uuid;

use crate::run_blocking;
use crate::types::Result;
use crate::utils::db::models::{
    NewWebhookDeliveryEntry, NewWebhookEntry, WebhookChangeset, WebhookDeliveryEntry, WebhookEntry,
};
use crate::utils::db::schema::hyperotaserver::{webhook_deliveries, webhooks};
use crate::utils::db::DbPool;

// ---- webhook configs ----

// A webhook's scope is `Option<app>`: `Some(app)` => application-scoped, `None` =>
// organisation-scoped (`app_id IS NULL`). Postgres' `IS NOT DISTINCT FROM` expresses
// both arms as one predicate — it is `= app` for `Some`, and `IS NULL` for `None`
// (unlike `=`, which is never true against NULL). That keeps every scoped query below
// branch-free and usable as an update/delete target.

pub async fn create_webhook(pool: &DbPool, new: NewWebhookEntry) -> Result<WebhookEntry> {
    let pool = pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = diesel::insert_into(webhooks::table)
            .values(new)
            .get_result::<WebhookEntry>(&mut conn)?;
        Ok(entry)
    })
}

pub async fn get_webhook(
    pool: &DbPool,
    org: &str,
    app: Option<&str>,
    id: Uuid,
) -> Result<WebhookEntry> {
    let pool = pool.clone();
    let org = org.to_string();
    let app = app.map(str::to_string);
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = webhooks::table
            .filter(webhooks::id.eq(id))
            .filter(webhooks::org_id.eq(&org))
            .filter(webhooks::app_id.is_not_distinct_from(&app))
            .select(WebhookEntry::as_select())
            .first::<WebhookEntry>(&mut conn)?;
        Ok(entry)
    })
}

pub async fn get_webhook_by_id(pool: &DbPool, id: Uuid) -> Result<WebhookEntry> {
    let pool = pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = webhooks::table
            .filter(webhooks::id.eq(id))
            .select(WebhookEntry::as_select())
            .first::<WebhookEntry>(&mut conn)?;
        Ok(entry)
    })
}

/// Webhooks belonging to exactly this scope — the org's own when `app` is `None`.
pub async fn list_webhooks(
    pool: &DbPool,
    org: &str,
    app: Option<&str>,
) -> Result<Vec<WebhookEntry>> {
    let pool = pool.clone();
    let org = org.to_string();
    let app = app.map(str::to_string);
    run_blocking!({
        let mut conn = pool.get()?;
        let entries = webhooks::table
            .filter(webhooks::org_id.eq(&org))
            .filter(webhooks::app_id.is_not_distinct_from(&app))
            .order(webhooks::created_at.desc())
            .select(WebhookEntry::as_select())
            .load::<WebhookEntry>(&mut conn)?;
        Ok(entries)
    })
}

/// Enabled webhooks that should receive `event` (fan-out — all matches).
///
/// An event from an app reaches both that app's own webhooks **and** the org's
/// (`app_id IS NULL`), which is what makes an org webhook fire for every app. An
/// org-level event (`app` = `None`) can only reach org webhooks — the predicate below
/// collapses to `app_id IS NULL OR app_id IS NULL` in that case.
pub async fn list_subscribed_webhooks(
    pool: &DbPool,
    org: &str,
    app: Option<&str>,
    event: &str,
) -> Result<Vec<WebhookEntry>> {
    let pool = pool.clone();
    let org = org.to_string();
    let app = app.map(str::to_string);
    let event = event.to_string();
    run_blocking!({
        let mut conn = pool.get()?;
        let all = webhooks::table
            .filter(webhooks::org_id.eq(&org))
            .filter(
                webhooks::app_id
                    .is_not_distinct_from(&app)
                    .or(webhooks::app_id.is_null()),
            )
            .filter(webhooks::enabled.eq(true))
            .select(WebhookEntry::as_select())
            .load::<WebhookEntry>(&mut conn)?;
        let matched = all
            .into_iter()
            .filter(|w| {
                serde_json::from_value::<Vec<String>>(w.events.clone())
                    .map(|evs| evs.iter().any(|e| e == &event))
                    .unwrap_or(false)
            })
            .collect();
        Ok(matched)
    })
}

pub async fn update_webhook(
    pool: &DbPool,
    org: &str,
    app: Option<&str>,
    id: Uuid,
    changeset: WebhookChangeset,
) -> Result<WebhookEntry> {
    let pool = pool.clone();
    let org = org.to_string();
    let app = app.map(str::to_string);
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = diesel::update(
            webhooks::table
                .filter(webhooks::id.eq(id))
                .filter(webhooks::org_id.eq(&org))
                .filter(webhooks::app_id.is_not_distinct_from(&app)),
        )
        .set(changeset)
        .get_result::<WebhookEntry>(&mut conn)?;
        Ok(entry)
    })
}

pub async fn delete_webhook(
    pool: &DbPool,
    org: &str,
    app: Option<&str>,
    id: Uuid,
) -> Result<usize> {
    let pool = pool.clone();
    let org = org.to_string();
    let app = app.map(str::to_string);
    run_blocking!({
        let mut conn = pool.get()?;
        let n = diesel::delete(
            webhooks::table
                .filter(webhooks::id.eq(id))
                .filter(webhooks::org_id.eq(&org))
                .filter(webhooks::app_id.is_not_distinct_from(&app)),
        )
        .execute(&mut conn)?;
        Ok(n)
    })
}

// ---- deliveries ----

pub async fn insert_delivery(
    pool: &DbPool,
    new: NewWebhookDeliveryEntry,
) -> Result<WebhookDeliveryEntry> {
    let pool = pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = diesel::insert_into(webhook_deliveries::table)
            .values(new)
            .get_result::<WebhookDeliveryEntry>(&mut conn)?;
        Ok(entry)
    })
}

pub async fn get_delivery_by_id(pool: &DbPool, id: Uuid) -> Result<WebhookDeliveryEntry> {
    let pool = pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = webhook_deliveries::table
            .filter(webhook_deliveries::id.eq(id))
            .select(WebhookDeliveryEntry::as_select())
            .first::<WebhookDeliveryEntry>(&mut conn)?;
        Ok(entry)
    })
}

/// Deliveries of one webhook. Deliberately **not** scoped by `webhook_deliveries.app_id`:
/// an org-scoped webhook's deliveries carry the *triggering* app, so filtering on it would
/// hide them from the org. Callers authorize by loading the owning webhook in their own
/// scope first (see [`get_webhook`]).
pub async fn list_deliveries(
    pool: &DbPool,
    webhook_id: Uuid,
    page: i64,
    count: i64,
) -> Result<(Vec<WebhookDeliveryEntry>, i64)> {
    let pool = pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;

        let total: i64 = webhook_deliveries::table
            .filter(webhook_deliveries::webhook_id.eq(webhook_id))
            .count()
            .get_result(&mut conn)?;

        let rows = webhook_deliveries::table
            .filter(webhook_deliveries::webhook_id.eq(webhook_id))
            .order(webhook_deliveries::created_at.desc())
            .offset((page - 1).max(0) * count)
            .limit(count)
            .select(WebhookDeliveryEntry::as_select())
            .load::<WebhookDeliveryEntry>(&mut conn)?;

        Ok((rows, total))
    })
}

pub async fn set_delivery_kronos_job(
    pool: &DbPool,
    id: Uuid,
    job_id: &str,
    status: &str,
) -> Result<()> {
    let pool = pool.clone();
    let job_id = job_id.to_string();
    let status = status.to_string();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::update(webhook_deliveries::table.filter(webhook_deliveries::id.eq(id)))
            .set((
                webhook_deliveries::kronos_job_id.eq(job_id),
                webhook_deliveries::status.eq(status),
                webhook_deliveries::updated_at.eq(chrono::Utc::now()),
            ))
            .execute(&mut conn)?;
        Ok(())
    })
}

pub async fn set_delivery_status(pool: &DbPool, id: Uuid, status: &str) -> Result<()> {
    let pool = pool.clone();
    let status = status.to_string();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::update(webhook_deliveries::table.filter(webhook_deliveries::id.eq(id)))
            .set((
                webhook_deliveries::status.eq(status),
                webhook_deliveries::updated_at.eq(chrono::Utc::now()),
            ))
            .execute(&mut conn)?;
        Ok(())
    })
}

/// Store the (appended) attempts array and update the delivery's status/counters.
pub async fn record_attempt(
    pool: &DbPool,
    id: Uuid,
    attempts: serde_json::Value,
    status: &str,
    attempt_count: i32,
    last_status_code: Option<i32>,
) -> Result<()> {
    let pool = pool.clone();
    let status = status.to_string();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::update(webhook_deliveries::table.filter(webhook_deliveries::id.eq(id)))
            .set((
                webhook_deliveries::attempts.eq(attempts),
                webhook_deliveries::status.eq(status),
                webhook_deliveries::attempt_count.eq(attempt_count),
                webhook_deliveries::last_status_code.eq(last_status_code),
                webhook_deliveries::updated_at.eq(chrono::Utc::now()),
            ))
            .execute(&mut conn)?;
        Ok(())
    })
}
