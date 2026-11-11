// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

use super::*;
use crate::run_blocking;
use diesel::{
    prelude::*,
    sql_types::{Jsonb, Text, Uuid as SqlUuid},
};
use uuid::Uuid;

#[derive(QueryableByName, Debug, Clone)]
pub struct Operation {
    #[diesel(sql_type = SqlUuid)]
    pub id: Uuid,
    #[diesel(sql_type = Text)]
    pub state: String,
    #[diesel(sql_type = Jsonb)]
    pub data: Value,
}
impl Operation {
    pub fn advance(&mut self, next: &str) -> airborne_types::Result<()> {
        if self.state == next
            || matches!(
                (self.state.as_str(), next),
                ("planned", "completed") | ("unresolved", "confirmed" | "rejected")
            )
        {
            self.state = next.into();
            return Ok(());
        }
        Err(ABError::InternalServerError(
            "Invalid durable operation transition".into(),
        ))
    }
}

pub async fn load(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    source: Option<&str>,
) -> airborne_types::Result<Vec<Operation>> {
    let pool = state.db_pool.clone();
    let (org, app, source) = (org.to_owned(), app.to_owned(), source.map(str::to_owned));
    let work = async {
        run_blocking!({
            let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
            c.transaction::<_,ABError,_>(|c| {
            diesel::sql_query("SET LOCAL statement_timeout = '2s'").execute(c)?;
            let rows = if let Some(source) = source {
                diesel::sql_query("SELECT id,state,data FROM hyperotaserver.release_operations WHERE org_id=$1 AND app_id=$2 AND kind='rollback' AND source_release_id=$3")
                .bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(source).load(c)?
            } else {
                diesel::sql_query("SELECT id,state,data FROM hyperotaserver.release_operations WHERE org_id=$1 AND app_id=$2 AND kind='write' AND state='unresolved' ORDER BY created_at")
                .bind::<Text,_>(org).bind::<Text,_>(app).load(c)?
            };
            Ok(rows)
            })
        })
    };
    tokio::time::timeout(std::time::Duration::from_secs(3), work)
        .await
        .map_err(|_| ABError::InternalServerError("Operation journal deadline".into()))?
}
// A replacement retains lineage in the durable journal or scoped abandonment audit, even when
// release-event recording failed. Scope every lookup to the application.
pub async fn rollback_parent(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    replacement: &str,
) -> airborne_types::Result<Option<String>> {
    let pool = state.db_pool.clone();
    let (org, app, replacement) = (org.to_owned(), app.to_owned(), replacement.to_owned());
    #[derive(QueryableByName)]
    struct Parent {
        #[diesel(sql_type = Text)]
        source_release_id: String,
    }
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        c.transaction::<_,ABError,_>(|c| {
            diesel::sql_query("SET LOCAL statement_timeout='2s'").execute(c)?;
            let rows = diesel::sql_query("SELECT source_release_id FROM hyperotaserver.release_operations WHERE org_id=$1 AND app_id=$2 AND kind='rollback' AND data->>'replacement_release_id'=$3 UNION ALL SELECT release_id AS source_release_id FROM hyperotaserver.release_events WHERE org_id=$1 AND app_id=$2 AND action='rollback_abandoned' AND payload->>'replacement_release_id'=$3 LIMIT 1")
                .bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(&replacement).load::<Parent>(c)?;
            Ok(rows.into_iter().next().map(|r| r.source_release_id))
        })
    })
}

#[derive(QueryableByName)]
pub struct PendingApp {
    #[diesel(sql_type=Text)]
    pub org_id: String,
    #[diesel(sql_type=Text)]
    pub app_id: String,
    #[diesel(sql_type=Jsonb)]
    pub operations: Value,
}
pub async fn pending_apps(
    state: &web::Data<AppState>,
    pairs: &[(String, String)],
) -> airborne_types::Result<Vec<PendingApp>> {
    let pairs = serde_json::json!(pairs
        .iter()
        .map(|(org, app)| serde_json::json!({"org_id":org,"app_id":app}))
        .collect::<Vec<_>>());
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_millis(250))?;
        c.transaction::<_,ABError,_>(|c| {
        diesel::sql_query("SET LOCAL statement_timeout='500ms'").execute(c)?;
        let rows=diesel::sql_query("SELECT org_id,app_id,jsonb_agg(jsonb_build_object('operation_id',id,'message','Upstream outcome is not confirmed. Writes are paused for this app.') ORDER BY created_at) AS operations FROM hyperotaserver.release_operations WHERE kind='write' AND state='unresolved' AND (org_id,app_id) IN (SELECT org_id,app_id FROM jsonb_to_recordset($1) AS allowed(org_id text,app_id text)) GROUP BY org_id,app_id").bind::<Jsonb,_>(pairs).load::<PendingApp>(c)?;
        Ok(rows)
        })
    })
}
// A rejected/pre-dispatch plan owns no upstream transition. Re-plan it, even
// after a source/registry change; retain the row id for the unique source index.
pub async fn has_confirmed(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    marker: &str,
) -> airborne_types::Result<bool> {
    let pending = (org.to_owned(), app.to_owned(), marker.to_owned());
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        use diesel::sql_types::Bool;
        #[derive(QueryableByName)]
        struct Row {
            #[diesel(sql_type=Bool)]
            found: bool,
        }
        let r=diesel::sql_query("SELECT EXISTS(SELECT 1 FROM hyperotaserver.release_operations WHERE org_id=$1 AND app_id=$2 AND kind='write' AND state='confirmed' AND data->'expected'->>'change_reason'=$3) AS found")
            .bind::<Text,_>(pending.0).bind::<Text,_>(pending.1).bind::<Text,_>(pending.2).get_result::<Row>(&mut c)?;
        Ok(r.found)
    })
}
/// The audit event a mutation will produce when (and only when) its journal entry
/// reaches `confirmed`. It is recorded on the unresolved journal row before dispatch, so
/// every later confirmation path (own response, next-write reconcile) can write the
/// same event with the original actor, in the same transaction as the state change.
#[derive(Clone, Debug)]
pub struct Audit {
    pub actor: String,
    pub action: String,
    pub payload: Value,
}
impl Audit {
    pub fn new(auth: &AuthResponse, action: &str, payload: Value) -> Self {
        Self {
            actor: auth.sub.clone(),
            action: action.into(),
            payload: super::control_center::decorate(payload),
        }
    }
    pub fn journal(&self) -> Value {
        serde_json::json!({"actor":self.actor,"action":self.action,"payload":self.payload})
    }
    fn from_journal(op: &Operation) -> Option<Self> {
        let a = op.data.get("audit")?;
        Some(Self {
            actor: a["actor"].as_str()?.to_owned(),
            action: a["action"].as_str()?.to_owned(),
            payload: a["payload"].clone(),
        })
    }
}
pub struct NewEvent {
    id: Uuid,
    release_id: String,
    action: String,
    actor: String,
    payload: Value,
}
// Same derivation as `required_event`, keyed by the journal operation: replays dedupe.
pub fn event_id(org: &str, app: &str, release: &str, action: &str, op: Uuid) -> Uuid {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(format!("{org}/{app}/{release}/{action}/{op}"));
    Uuid::from_bytes(digest[..16].try_into().unwrap())
}
pub fn new_event(
    org: &str,
    app: &str,
    op: &Operation,
    audit: Audit,
    release: &str,
    reconciled: bool,
) -> NewEvent {
    let mut payload = audit.payload;
    payload["journal_operation_id"] = serde_json::json!(op.id);
    if reconciled {
        // The upstream result was ambiguous; the event is written when it is later confirmed.
        payload["reconciled_after_ambiguous_result"] = serde_json::json!(true);
    }
    NewEvent {
        id: event_id(org, app, release, &audit.action, op.id),
        release_id: release.to_owned(),
        action: audit.action,
        actor: audit.actor,
        payload,
    }
}
/// Event for an unresolved journal entry that is now known to have been applied, if the
/// entry recorded its audit intent (journals written before this change did not).
pub fn reconciled_event(org: &str, app: &str, op: &Operation, release: &str) -> Option<NewEvent> {
    Audit::from_journal(op).map(|a| new_event(org, app, op, a, release, true))
}
/// The deployment action an operation represents, for operator recovery rows.
pub fn resolved_action(op: &Operation) -> Option<String> {
    if let Some(a) = op.data["audit"]["action"].as_str() {
        return Some(a.to_owned());
    }
    let e = &op.data["expected"];
    match e["status"].as_str()? {
        "CREATED" if e["id"].is_null() => Some("created"),
        "INPROGRESS" => Some("ramped"),
        "CONCLUDED" => Some("concluded"),
        "DISCARDED" => Some("discarded"),
        _ => None,
    }
    .map(str::to_owned)
}

pub async fn save(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    kind: &str,
    source: &str,
    op: &Operation,
) -> airborne_types::Result<()> {
    save_with_event(state, org, app, kind, source, op, None).await
}
/// Journal write and audit row commit or fail together (one transaction on the
/// advisory-lock session), so a confirmed mutation cannot exist without its event.
pub async fn save_with_event(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    kind: &str,
    source: &str,
    op: &Operation,
    event: Option<NewEvent>,
) -> airborne_types::Result<()> {
    let _ = state;
    let mut op = op.clone();
    if let Some(approval) = super::maker_checker::audit_context() {
        op.data["approval"] = approval;
    }
    let (org, app, kind, source, op) = (
        org.to_owned(),
        app.to_owned(),
        kind.to_owned(),
        source.to_owned(),
        op.clone(),
    );
    super::write_lock::store(move |c| {
        c.transaction::<_, ABError, _>(|c| {
            diesel::sql_query("INSERT INTO hyperotaserver.release_operations (id,org_id,app_id,kind,source_release_id,state,data) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET state=excluded.state,data=excluded.data,updated_at=now()")
                .bind::<SqlUuid,_>(op.id).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(kind).bind::<Text,_>(source).bind::<Text,_>(op.state).bind::<Jsonb,_>(op.data).execute(c)?;
            if let Some(ev) = event {
                diesel::sql_query("INSERT INTO hyperotaserver.release_events (id,org_id,app_id,release_id,action,actor,payload) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING")
                    .bind::<SqlUuid,_>(ev.id).bind::<Text,_>(&org).bind::<Text,_>(&app).bind::<Text,_>(ev.release_id).bind::<Text,_>(ev.action).bind::<Text,_>(ev.actor).bind::<Jsonb,_>(ev.payload).execute(c)?;
            }
            Ok(())
        })
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_durable_state_transition_and_terminal_state_is_checked() {
        let states = [
            "planned",
            "unresolved",
            "confirmed",
            "rejected",
            "completed",
        ];
        for from in states {
            for to in states {
                let mut op = Operation {
                    id: Uuid::new_v4(),
                    state: from.into(),
                    data: Value::Null,
                };
                let allowed = from == to
                    || matches!(
                        (from, to),
                        ("planned", "completed") | ("unresolved", "confirmed" | "rejected")
                    );
                assert_eq!(op.advance(to).is_ok(), allowed, "{from} -> {to}");
                assert_eq!(op.state, if allowed { to } else { from });
            }
        }
    }
}
