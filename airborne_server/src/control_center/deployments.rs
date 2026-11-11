//! Cross-application durable audit feed. No upstream fan-out or synthetic events.
use super::*;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, Utc};
use diesel::sql_types::{Array, BigInt, Jsonb, Nullable, Text, Timestamptz, Uuid as SqlUuid};

const MAX_APPS: usize = 1000;
const ACTIONS: &[&str] = &[
    "created",
    "ramped",
    "concluded",
    "rolled_back",
    "discarded",
    "emergency_rollback",
    "requested",
    "approved",
    "rejected",
    "expired",
    "cache_failed",
    "cache_retried",
    "policy_changed",
    // Request and operation outcomes: without these an approval whose execution failed,
    // went stale, was cancelled or was abandoned would read as merely "Approved".
    "executed",
    "failed",
    "stale",
    "cancelled",
    "rollback_abandoned",
    "emergency_acknowledged",
];
// How each feed action reaches the audit table. Kept next to ACTIONS and checked against
// it in tests, so a new action cannot be added without saying how reliable its row is.
// Transactional: committed in the same transaction as the state change it describes.
const TRANSACTIONAL: &[&str] = &[
    "created",
    "ramped",
    "concluded",
    "discarded",
    "rolled_back",
    "emergency_rollback",
    "emergency_acknowledged",
    "requested",
    "approved",
    "rejected",
    "cancelled",
    "stale",
    "executed",
    "failed",
    "expired",
    "policy_changed",
    "rollback_abandoned",
    "cache_retried",
];
// Written afterwards, in a separate statement: a crash in between loses the row.
const BEST_EFFORT: &[&str] = &["cache_failed"];
fn audit_completeness() -> Value {
    json!({
        "complete": false,
        "transactional_actions": TRANSACTIONAL,
        "best_effort_actions": BEST_EFFORT,
        "notes": [
            "Release created, ramped, concluded and discarded events are committed with the write's durable journal entry. Releases changed before that rule existed were audited best-effort, so an event from that period can be missing.",
            "A release write whose upstream result is unresolved has no event until it is resolved: its change may be live while the feed does not show it. The overview lists unresolved operations.",
            "cache_failed is recorded after the CDN invalidation attempt in a separate statement; a crash between the two loses it.",
            "expired is recorded when the expiry is first processed, which can be later than the request's expiry time.",
            "Edits to a release that has not started rolling out are not audited.",
            "The feed shows events as recorded. An absent event is not proof that nothing happened."
        ]
    })
}
#[derive(Clone, Default, Deserialize, Serialize)]
pub(super) struct ScopeFilter {
    pub org: Option<String>,
    pub group: Option<String>,
    pub app: Option<String>,
}
impl ScopeFilter {
    pub fn includes_org(&self, org: &str) -> bool {
        self.org.as_deref().is_none_or(|o| o == org)
    }
    pub fn includes_app(&self, app: &str) -> bool {
        self.app.as_deref().is_none_or(|a| a == app)
    }
}
pub(super) async fn scope_apps(
    state: &web::Data<AppState>,
    org: &str,
    scope: &ScopeFilter,
) -> Result<Option<Vec<String>>> {
    let Some(group) = &scope.group else {
        return Ok(None);
    };
    let id =
        Uuid::parse_str(group).map_err(|_| ABError::BadRequest("group must be a UUID".into()))?;
    let pool = state.db_pool.clone();
    let org = org.to_owned();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(1))?;
        let apps = m::table
            .filter(m::org_id.eq(org))
            .filter(m::group_id.eq(id))
            .select(m::app_id)
            .limit(MAX_APPS as i64 + 1)
            .load::<String>(&mut c)?;
        if apps.len() > MAX_APPS {
            return Err(ABError::BadRequest(
                "Group exceeds application limit; narrow scope to an app".into(),
            ));
        }
        Ok(Some(apps))
    })
}
#[derive(Clone, Default, Deserialize, Serialize)]
struct Filters {
    #[serde(flatten)]
    scope: ScopeFilter,
    platform: Option<String>,
    actor: Option<String>,
    since: Option<DateTime<Utc>>,
    #[serde(default)]
    action: Vec<String>,
}
#[derive(Serialize, Deserialize)]
struct Cursor {
    snapshot: DateTime<Utc>,
    at: DateTime<Utc>,
    id: Uuid,
    filters: String,
}
#[derive(QueryableByName)]
struct Event {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
    #[diesel(sql_type = Timestamptz)]
    created_at: DateTime<Utc>,
    #[diesel(sql_type = Text)]
    release_id: String,
    #[diesel(sql_type = Text)]
    action: String,
    #[diesel(sql_type = Text)]
    raw_action: String,
    #[diesel(sql_type = Text)]
    actor: String,
    #[diesel(sql_type = Jsonb)]
    payload: Value,
    #[diesel(sql_type = Nullable<Text>)]
    group_id: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    platform: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    history_version: Option<String>,
}
// Postgres orders uuids bytewise, as `Uuid` does, so this matches the SQL ORDER BY.
fn newest_first(items: &mut Vec<(DateTime<Utc>, Uuid, Value)>, keep: usize) {
    items.sort_unstable_by(|a, b| (b.0, b.1).cmp(&(a.0, a.1)));
    items.truncate(keep);
}
fn summary(event: &Event, p: &Value) -> String {
    let reason = p.get("reason").and_then(Value::as_str);
    match event.raw_action.as_str() {
        "operation_resolved" => format!(
            "Confirmed by an operator after an ambiguous upstream result: {}",
            reason.unwrap_or("no reason recorded")
        ),
        // Two kinds of change share this action; say which one it was.
        "policy_changed" => {
            let on = |v: Option<bool>| match v {
                Some(true) => "turned on",
                Some(false) => "turned off",
                None => "changed",
            };
            if event.payload.get("policy").and_then(Value::as_str) == Some("strict_serving") {
                format!(
                    "Serving policy: strict serving {}",
                    on(event
                        .payload
                        .pointer("/after/strict")
                        .and_then(Value::as_bool))
                )
            } else {
                format!(
                    "Approval policy {}",
                    on(event
                        .payload
                        .pointer("/after/enabled")
                        .and_then(Value::as_bool))
                )
            }
        }
        // Approval request outcomes: say which request and how it ended.
        "executed" | "failed" | "stale" | "cancelled" => {
            let what = event
                .payload
                .get("action")
                .and_then(Value::as_str)
                .unwrap_or("approval");
            let why = event
                .payload
                .get("decision_reason")
                .and_then(Value::as_str)
                .filter(|r| !r.is_empty());
            format!(
                "{} request {}{}",
                what.replace('_', " "),
                event.action,
                why.map(|r| format!(": {r}")).unwrap_or_default()
            )
        }
        _ => reason
            .map(str::to_owned)
            .unwrap_or_else(|| event.action.replace('_', " ")),
    }
}
/// The approval request an event belongs to, when the audit row says so. A request's own rows (requested,
/// approved, rejected, cancelled, expired, stale, failed, executed) store the request as their payload, so its `id`
/// is the request id; a release write made by an approved request records `approval.request_id`. Older rows
/// and writes made without approval have neither, so there is no id and nothing is guessed from the release.
fn request_id(event: &Event, p: &Value) -> Option<String> {
    let text = |v: Option<&Value>| {
        v.and_then(Value::as_str)
            .filter(|s| Uuid::parse_str(s).is_ok())
            .map(str::to_owned)
    };
    match event.raw_action.as_str() {
        "requested" | "approved" | "rejected" | "cancelled" | "expired" | "stale" | "failed"
        | "executed" => text(event.payload.get("id")),
        _ => text(event.payload.pointer("/approval/request_id"))
            .or_else(|| text(p.pointer("/approval/request_id"))),
    }
}
fn item(event: Event, org: &str, app: &str) -> Value {
    let p = event
        .payload
        .get("payload")
        .and_then(|p| p.get("body"))
        .unwrap_or(&event.payload);
    let summary = summary(&event, p);
    let request_id = request_id(&event, p);
    json!({"event_id":event.id,"at":event.created_at,"org":org,"group":event.group_id,"app":app,"platform":event.platform,
        "release_id":if event.release_id.is_empty(){None}else{Some(event.release_id)},
        "package_version":event.payload.get("package_version").or_else(||p.get("package_version")).or_else(||p.get("version")).and_then(|v| if let Some(s)=v.as_str(){Some(s.to_owned())}else if v.is_number(){Some(v.to_string())}else{None}).or(event.history_version),
        "request_id":request_id,"action":event.action,"recovered":event.raw_action=="operation_resolved","actor":if event.actor.trim().is_empty(){None}else{Some(event.actor)},
        "from_target":p.get("from_target"),"to_target":p.get("to_target").or_else(||p.get("traffic_percentage")),
        "summary":summary})
}
// Indexed keyset lookup, restricted to exactly one authorized org/app. SQL timeout
// and limit apply before rows are materialized; no full audit-table reads.
fn read_events(
    c: &mut PgConnection,
    org: &str,
    app: &str,
    f: &Filters,
    cursor: &Cursor,
    limit: i64,
) -> Result<Vec<Event>> {
    c.transaction::<_, ABError, _>(|c| {
        diesel::sql_query("SET LOCAL statement_timeout = '750ms'").execute(c)?;
        Ok(diesel::sql_query(include_str!("deployments.sql"))
            .bind::<Text, _>(org)
            .bind::<Text, _>(app)
            .bind::<Timestamptz, _>(cursor.snapshot)
            .bind::<Timestamptz, _>(cursor.at)
            .bind::<SqlUuid, _>(cursor.id)
            .bind::<Nullable<Timestamptz>, _>(f.since)
            .bind::<Array<Text>, _>(&f.action)
            .bind::<Nullable<Text>, _>(&f.actor)
            .bind::<Nullable<Text>, _>(&f.platform)
            .bind::<BigInt, _>(limit)
            .bind::<Array<Text>, _>(ACTIONS)
            .load(c)?)
    })
}
#[get("/deployments")]
pub(super) async fn feed(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
    req: actix_web::HttpRequest,
) -> Result<Json<Value>> {
    // serde_urlencoded does not support repeated keys; parse action explicitly.
    let pairs = url::form_urlencoded::parse(req.query_string().as_bytes())
        .into_owned()
        .collect::<Vec<_>>();
    let mut f = Filters::default();
    let mut encoded_cursor = None;
    let mut limit = 50usize;
    for (key, value) in pairs {
        match key.as_str() {
            "org" => f.scope.org = Some(value),
            "group" => f.scope.group = Some(value),
            "app" => f.scope.app = Some(value),
            "platform" => f.platform = Some(value),
            "actor" => f.actor = Some(value),
            "action" => f.action.push(value),
            "since" => {
                f.since = Some(
                    DateTime::parse_from_rfc3339(&value)
                        .map_err(|_| ABError::BadRequest("Invalid since".into()))?
                        .with_timezone(&Utc),
                )
            }
            "cursor" => encoded_cursor = Some(value),
            "limit" => {
                limit = value
                    .parse()
                    .map_err(|_| ABError::BadRequest("Invalid limit".into()))?
            }
            _ => {}
        }
    }
    if !(1..=200).contains(&limit)
        || f.action.iter().any(|a| !ACTIONS.contains(&a.as_str()))
        || f.platform
            .as_deref()
            .is_some_and(|p| !["web", "ios", "android"].contains(&p))
    {
        return Err(ABError::BadRequest(
            "Invalid deployment filters or limit".into(),
        ));
    }
    if f.scope
        .group
        .as_ref()
        .is_some_and(|g| Uuid::parse_str(g).is_err())
    {
        return Err(ABError::BadRequest("group must be a UUID".into()));
    }
    f.action.sort();
    f.action.dedup();
    let fingerprint = serde_json::to_string(&f).unwrap();
    let cursor = if let Some(encoded) = encoded_cursor {
        if encoded.len() > 8192 {
            return Err(ABError::BadRequest("Invalid cursor".into()));
        }
        let c: Cursor = URL_SAFE_NO_PAD
            .decode(encoded)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .ok_or_else(|| ABError::BadRequest("Invalid cursor".into()))?;
        if c.filters != fingerprint {
            return Err(ABError::BadRequest("Cursor filters changed".into()));
        }
        c
    } else {
        // `created_at` is stamped by the database. A snapshot taken from this server's
        // clock would hide fresh events from the first page while the clocks differ.
        let now = crate::utils::db::db_now(state.db_pool.clone())
            .await
            .map_err(|_| ABError::InternalServerError("Audit snapshot unavailable".into()))?;
        Cursor {
            snapshot: now,
            at: now,
            id: Uuid::max(),
            filters: fingerprint.clone(),
        }
    };
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    let access = tokio::time::timeout_at(
        deadline,
        state
            .authz_provider
            .get_user_access_summary(&state, &auth_response.sub),
    )
    .await
    .map_err(|_| ABError::InternalServerError("Authorization timed out".into()))??;
    let mut errors = Vec::new();
    let mut jobs = Vec::new();
    let mut considered = 0usize;
    for org in access
        .organisations
        .into_iter()
        .filter(|o| f.scope.includes_org(&o.name))
    {
        let scoped = match scope_apps(&state, &org.name, &f.scope).await {
            Ok(s) => s,
            Err(_) => {
                errors.push(json!({"org":org.name,"app":null,"reason":"Scope lookup failed"}));
                continue;
            }
        };
        for app in org.applications {
            if !f.scope.includes_app(&app.application)
                || scoped
                    .as_ref()
                    .is_some_and(|a| !a.contains(&app.application))
            {
                continue;
            }
            if considered >= MAX_APPS {
                errors.push(json!({"org":org.name,"app":null,"reason":"Application limit exceeded; narrow scope"}));
                break;
            }
            considered += 1;
            let allowed = tokio::time::timeout_at(deadline, async {
                if state
                    .authz_provider
                    .enforce_permission(
                        &state,
                        &auth_response.sub,
                        &org.name,
                        None,
                        "release",
                        "read",
                    )
                    .await?
                {
                    return Ok(true);
                }
                state
                    .authz_provider
                    .enforce_permission(
                        &state,
                        &auth_response.sub,
                        &org.name,
                        Some(&app.application),
                        "release",
                        "read",
                    )
                    .await
            })
            .await;
            match allowed {Ok(Ok(true))=>jobs.push((org.name.clone(),app.application)),Ok(Ok(false))=>{},_=>errors.push(json!({"org":org.name,"app":app.application,"reason":"Authorization lookup failed"}))}
        }
    }
    // Only the newest limit+1 rows can matter: merge as pages arrive instead of holding
    // every app's page (apps x 201 rows) until the end.
    let keep = limit + 1;
    let mut items: Vec<(DateTime<Utc>, Uuid, Value)> = Vec::new();
    let permits = state.feed_read_permits.clone();
    let work = stream::iter(jobs.iter().cloned().map(|(org, app)| {
        let pool = state.db_pool.clone();
        let permits = permits.clone();
        let f = f.clone();
        let cursor = Cursor {
            snapshot: cursor.snapshot,
            at: cursor.at,
            id: cursor.id,
            filters: fingerprint.clone(),
        };
        async move {
            let (o, a) = (org.clone(), app.clone());
            // The permit is held until the blocking read finishes, even if this request's
            // deadline passes first, so abandoned reads still count against the bound.
            let result: Result<Vec<Event>> = match permits.acquire_owned().await {
                Ok(permit) => run_blocking!({
                    let _permit = permit;
                    let mut c = pool.get_timeout(std::time::Duration::from_millis(250))?;
                    read_events(&mut c, &o, &a, &f, &cursor, limit as i64 + 1)
                }),
                Err(_) => Err(ABError::InternalServerError(
                    "Audit reads unavailable".into(),
                )),
            };
            (org, app, result)
        }
    }))
    .buffer_unordered(crate::utils::db::feed_concurrency(state.db_pool.max_size()));
    tokio::pin!(work);
    let mut completed = std::collections::HashSet::new();
    while let Ok(Some((org, app, result))) = tokio::time::timeout_at(deadline, work.next()).await {
        completed.insert((org.clone(), app.clone()));
        match result {
            Ok(rows) => {
                items.extend(
                    rows.into_iter()
                        .map(|e| (e.created_at, e.id, item(e, &org, &app))),
                );
                if items.len() > keep * 2 {
                    newest_first(&mut items, keep);
                }
            }
            Err(_) => errors.push(json!({"org":org,"app":app,"reason":"Audit read failed"})),
        }
    }
    for (org, app) in &jobs {
        if !completed.contains(&(org.clone(), app.clone())) {
            errors.push(json!({"org":org,"app":app,"reason":"Audit read deadline exceeded"}));
        }
    }
    newest_first(&mut items, keep);
    let more = items.len() > limit;
    items.truncate(limit);
    let items = items.into_iter().map(|(_, _, v)| v).collect::<Vec<_>>();
    let next_cursor = if more {
        let last = items.last().unwrap();
        Some(
            URL_SAFE_NO_PAD.encode(
                serde_json::to_vec(&Cursor {
                    snapshot: cursor.snapshot,
                    at: serde_json::from_value(last["at"].clone()).unwrap(),
                    id: serde_json::from_value(last["event_id"].clone()).unwrap(),
                    filters: fingerprint.clone(),
                })
                .unwrap(),
            ),
        )
    } else {
        None
    };
    Ok(Json(
        json!({"items":items,"next_cursor":next_cursor,"partial":!errors.is_empty(),"errors":errors,"audit_completeness":audit_completeness()}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn merge_keeps_only_the_newest_rows_in_database_order() {
        let t = |s: i64| DateTime::from_timestamp(s, 0).unwrap();
        let id = |n: u128| Uuid::from_u128(n);
        let mut items = vec![
            (t(5), id(1), json!("a")),
            (t(9), id(2), json!("b")),
            (t(9), id(7), json!("c")),
            (t(1), id(9), json!("d")),
            (t(7), id(3), json!("e")),
        ];
        newest_first(&mut items, 3);
        assert_eq!(
            items.iter().map(|i| i.2.clone()).collect::<Vec<_>>(),
            [json!("c"), json!("b"), json!("e")]
        );
    }
    #[test]
    fn every_feed_action_is_classified_exactly_once() {
        for a in ACTIONS {
            let n = TRANSACTIONAL
                .iter()
                .chain(BEST_EFFORT)
                .filter(|x| *x == a)
                .count();
            assert_eq!(n, 1, "{a} must be listed in exactly one reliability class");
        }
        for a in TRANSACTIONAL.iter().chain(BEST_EFFORT) {
            assert!(ACTIONS.contains(a), "{a} is not a feed action");
        }
        assert_eq!(audit_completeness()["complete"], false);
    }
}
