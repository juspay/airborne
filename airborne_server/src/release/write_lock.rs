// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

use super::*;
use diesel::{
    prelude::*,
    sql_types::{BigInt, Bool},
};
use sha2::{Digest, Sha256};
use std::error::Error as _;
use std::sync::Mutex;

// Leave headroom for the read/audit pool on a typical 100-connection database.
static WRITERS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(64);

// Dedicated physical connections, never borrowed from the read/audit pool. An app-wide
// lock is deliberately stronger than a dimension lock (including overlapping contexts).
// No waiter holds a connection: contention fails closed immediately.

#[derive(QueryableByName)]
struct Acquired {
    #[diesel(sql_type = Bool)]
    acquired: bool,
}

pub async fn locked<T>(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    operation: impl std::future::Future<Output = airborne_types::Result<T>>,
) -> airborne_types::Result<T> {
    locked_inner(state, org, app, true, operation).await
}
pub(super) async fn bounded_read<T>(
    read: impl std::future::Future<Output = T>,
) -> airborne_types::Result<T> {
    let deadline = SESSION
        .try_with(|s| s.deadline)
        .unwrap_or_else(|_| tokio::time::Instant::now() + std::time::Duration::from_secs(15));
    let deadline = deadline.min(tokio::time::Instant::now() + std::time::Duration::from_secs(15));
    tokio::time::timeout_at(deadline, read)
        .await
        .map_err(|_| ABError::InternalServerError("Release read deadline".into()))
}

pub async fn locked_inner<T>(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    reconcile: bool,
    operation: impl std::future::Future<Output = airborne_types::Result<T>>,
) -> airborne_types::Result<T> {
    let permit = WRITERS
        .try_acquire()
        .map_err(|_| ABError::Conflict("Release writer capacity reached; retry shortly".into()))?;
    let mut url = url::Url::parse(&state.release_write_db_url)
        .map_err(|_| ABError::InternalServerError("Release lock unavailable".into()))?;
    if url
        .query_pairs()
        .any(|(k, v)| k == "pgbouncer" && v == "true")
    {
        return Err(ABError::InternalServerError("Release writes require a session-pinned PostgreSQL connection; PgBouncer transaction mode is unsupported".into()));
    }
    url.query_pairs_mut().append_pair("connect_timeout", "3");
    let url = url.to_string();
    let digest = Sha256::digest(serde_json::to_vec(&(org, app)).unwrap());
    let key = i64::from_be_bytes(digest[..8].try_into().unwrap());
    let state_for_session = state.clone();
    let org_for_session = org.to_owned();
    let app_for_session = app.to_owned();
    let conn = tokio::time::timeout(
        std::time::Duration::from_secs(6),
        web::block(move || -> airborne_types::Result<_> {
            let mut conn = diesel::PgConnection::establish(&url)
                .map_err(|_| ABError::InternalServerError("Release lock unavailable".into()))?;
            diesel::sql_query("SET statement_timeout = '2s'").execute(&mut conn)?;
            let row = diesel::sql_query("SELECT pg_try_advisory_lock($1) AS acquired")
                .bind::<BigInt, _>(key)
                .get_result::<Acquired>(&mut conn)?;
            if !row.acquired {
                return Err(ABError::Conflict(
                    "Another release write is in progress; retry".into(),
                ));
            }
            let lifecycle_key = crate::organisation::journal_lifecycle::KEY;
            diesel::sql_query(format!("SELECT pg_advisory_lock_shared({lifecycle_key})"))
                .bind::<diesel::sql_types::Text, _>(&org_for_session)
                .execute(&mut conn)?;
            Ok(LockSession {
                conn: Mutex::new(conn),
                state: state_for_session,
                org: org_for_session,
                app: app_for_session,
                token: uuid::Uuid::new_v4().to_string(),
                _permit: permit,
                experiments: Mutex::new(None),
                last_reason: Mutex::new(String::new()),
                key,
                deadline: tokio::time::Instant::now() + std::time::Duration::from_secs(90),
            })
        }),
    )
    .await
    .map_err(|_| ABError::InternalServerError("Release lock connection deadline".into()))?
    .map_err(|_| ABError::InternalServerError("Release lock unavailable".into()))??;
    // Dropping this physical session releases its advisory lock, even on cancellation.
    let conn = Arc::new(conn);
    // Do not race the SDK future with a lock heartbeat or a body timeout. A DB
    // hiccup must not discard a definite pre-dispatch error. Release mutations have
    // a 5s deadline; full read listings have a 15s deadline; check the body budget at mutation boundaries instead.
    let result = SESSION
        .scope(conn.clone(), async {
            if reconcile {
                resolve(state, org, app, true).await?;
            }
            operation.await
        })
        .await;
    let result = verify(conn.clone()).await.and(result);
    let result = match super::operations::load(state, org, app, None).await {
        Ok(pending) => {
            if let Some(op) = pending.first().filter(|_| reconcile) {
                match result {
                    Err(ABError::ReleaseOperation { status, body })
                        if body["own_attempt"] == true =>
                    {
                        Err(ABError::ReleaseOperation { status, body })
                    }
                    _ => Err(unresolved(op)),
                }
            } else {
                result
            }
        }
        Err(error) => Err(error),
    };
    // Invalidate on errors too: an upstream timeout can have committed a change.
    super::control_center::invalidate(state, org, app).await;
    drop(conn);
    result
}

// Fail-fast capacity: a stalled app owns only one of 64 slots; no permit waiters.
struct LockSession {
    conn: Mutex<diesel::PgConnection>,
    _permit: tokio::sync::SemaphorePermit<'static>,
    state: web::Data<AppState>,
    org: String,
    app: String,
    token: String,
    experiments: Mutex<Option<(String, Vec<superposition_sdk::types::ExperimentResponse>)>>,
    last_reason: Mutex<String>,
    key: i64,
    deadline: tokio::time::Instant,
}

// Every upstream mutation checks the physical lock session first. Never reconnect:
// a replacement session would not own the advisory lock.
tokio::task_local! { static SESSION: Arc<LockSession>; }
pub async fn check() -> airborne_types::Result<()> {
    let conn = SESSION
        .try_with(Arc::clone)
        .map_err(|_| ABError::InternalServerError("Release lock unavailable".into()))?;
    if tokio::time::Instant::now() >= conn.deadline {
        return Err(ABError::InternalServerError(
            "Release operation deadline; retry to reconcile".into(),
        ));
    }
    verify(conn).await
}
async fn verify(conn: Arc<LockSession>) -> airborne_types::Result<()> {
    let check = web::block(move || {
        diesel::sql_query("SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted AND classid=(($1 >> 32) & 4294967295)::oid AND objid=($1 & 4294967295)::oid AND objsubid=1) AS acquired")
            .bind::<BigInt,_>(conn.key).get_result::<Acquired>(&mut *conn.conn.lock().unwrap())
    });
    let acquired = tokio::time::timeout(std::time::Duration::from_secs(2), check)
        .await
        .map_err(|_| ABError::InternalServerError("Release lock lost; session-pinned PostgreSQL required (RDS Proxy pinning; no PgBouncer transaction mode)".into()))?
        .map_err(|_| ABError::InternalServerError("Release lock lost; session-pinned PostgreSQL required (RDS Proxy pinning; no PgBouncer transaction mode)".into()))?
        .map_err(|_| ABError::InternalServerError("Release lock lost; session-pinned PostgreSQL required (RDS Proxy pinning; no PgBouncer transaction mode)".into()))?;
    if acquired.acquired {
        Ok(())
    } else {
        Err(ABError::InternalServerError("Release lock lost; session-pinned PostgreSQL required (RDS Proxy pinning; no PgBouncer transaction mode)".into()))
    }
}

// Journal writes use the SAME physical advisory session. A cancelled blocking
// write retains that session until completion; a terminated session cannot write
// a stale operation snapshot after another instance acquires the app lock.
pub async fn store(
    f: impl FnOnce(&mut diesel::PgConnection) -> airborne_types::Result<()> + Send + 'static,
) -> airborne_types::Result<()> {
    let session = SESSION
        .try_with(Arc::clone)
        .map_err(|_| ABError::InternalServerError("Release lock unavailable".into()))?;
    web::block(move || {
        let mut c=session.conn.lock().unwrap();
        let row=diesel::sql_query("SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=(($1 >> 32) & 4294967295)::oid AND objid=($1 & 4294967295)::oid AND objsubid=1) AS acquired").bind::<BigInt,_>(session.key).get_result::<Acquired>(&mut *c)?;
        if !row.acquired {return Err(ABError::InternalServerError("Release lock lost; session-pinned PostgreSQL required (RDS Proxy pinning; no PgBouncer transaction mode)".into()));}
        f(&mut c)
    }).await.map_err(|_|ABError::InternalServerError("Operation journal unavailable".into()))?
}

pub fn user_reason(user: &str) -> airborne_types::Result<String> {
    let combined = combine_reason(user, &reason())?;
    SESSION.with(|s| *s.last_reason.lock().unwrap() = user.to_owned());
    Ok(combined)
}
fn combine_reason(user: &str, marker: &str) -> airborne_types::Result<String> {
    validate_user_reason(user)?;
    let combined = format!("{} [{}]", user, marker);
    if combined.len() > 255 {
        return Err(ABError::BadRequest("Change reason exceeds Superposition's 255-byte limit including the operation marker (maximum user reason: 197 bytes)".into()));
    }
    Ok(combined)
}
// Reserved on every Airborne write path, including recovery-only requests.
pub fn validate_user_reason(user: &str) -> airborne_types::Result<()> {
    if user.contains("Airborne operation") {
        return Err(ABError::BadRequest(
            "Change reason contains the reserved Airborne operation marker namespace".into(),
        ));
    }
    Ok(())
}
fn marker_id(marker: &str) -> Option<uuid::Uuid> {
    let id = marker.strip_prefix("Airborne operation ")?;
    let parsed = uuid::Uuid::parse_str(id).ok()?;
    (parsed.to_string() == id).then_some(parsed)
}
fn reason_marker(reason: &str) -> Option<uuid::Uuid> {
    let (user, suffix) = reason.rsplit_once(" [")?;
    if user.contains("Airborne operation") {
        return None;
    }
    marker_id(suffix.strip_suffix(']')?)
}
// Only experiment top-level metadata carries generated operation evidence.
pub fn experiment_matches(actual: &Value, expected: &Value) -> bool {
    let Some(fields) = expected.as_object() else {
        return false;
    };
    let Some(marker) = expected["change_reason"]
        .as_str()
        .and_then(|v| marker_id(v).or_else(|| reason_marker(v)))
    else {
        return false;
    };
    actual["change_reason"].as_str().and_then(reason_marker) == Some(marker)
        && fields
            .iter()
            .filter(|(key, _)| *key != "change_reason")
            .all(|(key, value)| actual.get(key) == Some(value))
}
// Compare complete values of affected config keys, including nested objects.
pub fn contains(actual: &Value, expected: &Value) -> bool {
    match (actual.as_object(), expected.as_object()) {
        (Some(a), Some(e)) => e.iter().all(|(key, value)| a.get(key) == Some(value)),
        _ => actual == expected,
    }
}

pub fn cached(
    org: &str,
    app: &str,
) -> Option<(String, Vec<superposition_sdk::types::ExperimentResponse>)> {
    SESSION
        .try_with(|s| {
            if s.org == org && s.app == app {
                s.experiments.lock().unwrap().clone()
            } else {
                None
            }
        })
        .ok()
        .flatten()
}
pub fn cache(
    org: &str,
    app: &str,
    value: (String, Vec<superposition_sdk::types::ExperimentResponse>),
) {
    let _ = SESSION.try_with(|s| {
        if s.org == org && s.app == app {
            *s.experiments.lock().unwrap() = Some(value);
        }
    });
}
pub fn last_reason() -> Option<String> {
    SESSION
        .try_with(|s| s.last_reason.lock().unwrap().clone())
        .ok()
        .filter(|s| !s.is_empty())
}
pub fn reason() -> String {
    SESSION.with(|s| format!("Airborne operation {}", s.token))
}
pub fn details(op: &super::operations::Operation) -> Value {
    serde_json::json!({"code":"unresolved", "operation_id":op.id,
        "message":"Upstream outcome is not confirmed. Writes are paused for this app. Retry to re-read upstream, or ask an organisation admin to review and resolve this operation.",
        "expected":op.data["expected"], "before":op.data["before"],
        "upstream_workspace":op.data["workspace"], "upstream_org":op.data["upstream_org"]})
}
fn unresolved(op: &super::operations::Operation) -> ABError {
    ABError::ReleaseOperation {
        status: 409,
        body: details(op),
    }
}
// Side-effect free when apply=false (used by rollback preview).
pub async fn resolve(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    apply: bool,
) -> airborne_types::Result<()> {
    let pending = super::operations::load(state, org, app, None).await?;
    if pending.is_empty() {
        return Ok(());
    }
    let (_, exps) = super::control_center::experiments(state, org, app).await?;
    for mut op in pending {
        let found = exps
            .iter()
            .any(|e| experiment_matches(&super::control_center::snapshot(e), &op.data["expected"]))
            || history_confirms(state, &op).await?;
        if !found {
            return Err(unresolved(&op));
        }
        if apply {
            op.advance("confirmed")?;
            super::operations::save(state, org, app, "write", "", &op).await?;
        }
    }
    Ok(())
}
// A later human edit can remove the marker from the current row. Audit history
// is positive upstream evidence of acceptance, never evidence of absence.
pub async fn history_confirms(
    state: &web::Data<AppState>,
    op: &super::operations::Operation,
) -> airborne_types::Result<bool> {
    let Some(workspace) = op.data["workspace"].as_str() else {
        return Ok(false);
    };
    let logs = bounded_read(
        state
            .superposition_client
            .list_audit_logs()
            .org_id(&state.env.superposition_org_id)
            .workspace_id(workspace)
            .tables("experiments")
            .all(true)
            .send(),
    )
    .await?
    .map_err(super::control_center::sp_error)?;
    Ok(logs
        .data
        .iter()
        .filter_map(|l| l.new_data.as_ref())
        .filter_map(utils::document_to_value)
        .any(|v| audit_confirms(v, &op.data["expected"])))
}
fn audit_confirms(mut v: Value, expected: &Value) -> bool {
    if let Some(id) = v["id"].as_i64() {
        v["id"] = serde_json::json!(id.to_string());
    }
    if let Some(variants) = v["variants"].as_array() {
        let values = variants
            .iter()
            .filter_map(|v| {
                Some((
                    v["variant_type"].as_str()?.to_owned(),
                    v["overrides"].clone(),
                ))
            })
            .collect::<serde_json::Map<_, _>>();
        v["variants"] = Value::Object(values);
    }
    experiment_matches(&v, expected)
}
// The unresolved record is committed BEFORE dispatch, so cancellation, a process
// crash, a lost response and a lost advisory session all fail closed durably.
pub async fn mutate<T, E>(
    mut expected: Value,
    future: impl std::future::Future<
        Output = std::result::Result<T, superposition_sdk::error::SdkError<E>>,
    >,
) -> airborne_types::Result<T>
where
    E: std::fmt::Debug,
{
    check().await?;
    let session = SESSION.with(Arc::clone);
    expected["change_reason"] = Value::String(reason());
    let (workspace, exps) =
        super::control_center::experiments(&session.state, &session.org, &session.app).await?;
    let before = exps
        .iter()
        .find(|e| expected["id"] == e.id)
        .map(super::control_center::snapshot);
    // Upstream may commit config/context changes before updating the experiment.
    // Snapshot config for every mutation, not just the non-atomic default conclude.
    let config_before = config_values(&session.state, &workspace).await?;
    let mut op = super::operations::Operation {
        id: uuid::Uuid::new_v4(),
        state: "unresolved".into(),
        data: serde_json::json!({"expected":expected,"before":before,"config_before":config_before,"workspace":workspace,"upstream_org":session.state.env.superposition_org_id}),
    };
    super::operations::save(&session.state, &session.org, &session.app, "write", "", &op).await?;
    let result = future.await;
    *session.experiments.lock().unwrap() = None;
    match result {
        Ok(value) => {
            check().await?;
            op.advance("confirmed")?;
            super::operations::save(&session.state, &session.org, &session.app, "write", "", &op)
                .await?;
            Ok(value)
        }
        Err(error) => {
            let rejection = rejected_upstream_response(&error, &[400, 401, 403, 404, 422]);
            if definitely_rejected(&error) || rejection.is_some() {
                op.advance("rejected")?;
                super::operations::save(
                    &session.state,
                    &session.org,
                    &session.app,
                    "write",
                    "",
                    &op,
                )
                .await?;
                return Err(rejection.unwrap_or_else(|| {
                    ABError::InternalServerError(
                        "Superposition request was not dispatched; retry when it is reachable"
                            .into(),
                    )
                }));
            }
            let mut body = details(&op);
            body["own_attempt"] = Value::Bool(true);
            Err(ABError::ReleaseOperation { status: 409, body })
        }
    }
}

pub async fn config_values(
    state: &web::Data<AppState>,
    workspace: &str,
) -> airborne_types::Result<Value> {
    let defaults = default_values(state, workspace).await?;
    let contexts = bounded_read(
        state
            .superposition_client
            .list_contexts()
            .org_id(&state.env.superposition_org_id)
            .workspace_id(workspace)
            .all(true)
            .send(),
    )
    .await?
    .map_err(super::control_center::sp_error)?
    .data;
    let contexts = contexts
        .into_iter()
        .map(|c| {
            let condition = utils::document_to_value(&Document::Object(c.value));
            let overrides = utils::document_to_value(&Document::Object(c.r#override));
            (
                c.id,
                serde_json::json!({"condition":condition,"overrides":overrides,"weight":c.weight}),
            )
        })
        .collect::<serde_json::Map<_, _>>();
    Ok(serde_json::json!({"defaults":defaults,"contexts":contexts}))
}

pub async fn default_values(
    state: &web::Data<AppState>,
    workspace: &str,
) -> airborne_types::Result<Value> {
    let keys = bounded_read(
        state
            .superposition_client
            .list_default_configs()
            .org_id(&state.env.superposition_org_id)
            .workspace_id(workspace)
            .all(true)
            .send(),
    )
    .await?
    .map_err(super::control_center::sp_error)?
    .data;
    Ok(Value::Object(
        keys.into_iter()
            .map(|k| {
                Ok((
                    k.key,
                    utils::document_to_value(&k.value).ok_or_else(|| {
                        ABError::InternalServerError("Default config unavailable".into())
                    })?,
                ))
            })
            .collect::<airborne_types::Result<serde_json::Map<_, _>>>()?,
    ))
}

// Smithy uses the Hyper connector. Only typed connect-phase failures are safe;
// socket resets, generic IO errors, read/operation timeouts and responses are not.
fn rejected_upstream_response<E>(
    error: &superposition_sdk::error::SdkError<E>,
    definite_statuses: &[u16],
) -> Option<ABError> {
    use superposition_sdk::error::SdkError;
    let SdkError::ServiceError(service_error) = error else {
        return None;
    };
    let status = service_error.raw().status().as_u16();
    if !definite_statuses.contains(&status) {
        return None;
    }
    let message = format!("Superposition rejected the request (HTTP {status})");
    Some(ABError::BadRequest(message))
}

fn definitely_rejected<E>(error: &superposition_sdk::error::SdkError<E>) -> bool {
    use superposition_sdk::error::SdkError;
    match error {
        SdkError::ConstructionFailure(_) => true,
        SdkError::DispatchFailure(d) => {
            let mut source = d.as_connector_error().and_then(|e| e.source());
            while let Some(e) = source {
                if e.downcast_ref::<google_sheets4::hyper_util::client::legacy::Error>()
                    .is_some_and(|e| e.is_connect())
                {
                    return true;
                }
                // Smithy's private timeout type has no phase accessor. Match its
                // exact connect-only diagnostic, never generic timeout wording.
                if e.to_string()
                    .starts_with("HTTP connect timeout occurred after ")
                {
                    return true;
                }
                source = e.source();
            }
            false
        }
        // A service rejection may follow config writes; only pre-dispatch failures
        // establish non-application without independent config verification.
        _ => false,
    }
}

// Reader contract deliberately excludes config snapshots and upstream identifiers.
pub fn reader_details(op: &super::operations::Operation) -> Value {
    serde_json::json!({"code":"unresolved","operation_id":op.id,
        "message":"Upstream outcome is not confirmed. Writes are paused for this app."})
}

#[cfg(test)]
mod read_deadline_tests {
    use super::*;
    #[tokio::test]
    async fn hung_read_expires_without_waiting_for_writer_body_budget() {
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(16),
            bounded_read(std::future::pending::<()>()),
        )
        .await;
        assert!(result
            .expect("read exceeded its independent deadline")
            .is_err());
    }
}
