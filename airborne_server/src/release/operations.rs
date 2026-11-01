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
// A replacement retains lineage in the durable rollback journal, even when
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
        let rows = diesel::sql_query("SELECT source_release_id FROM hyperotaserver.release_operations WHERE org_id=$1 AND app_id=$2 AND kind='rollback' AND data->>'replacement_release_id'=$3")
            .bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(replacement).load::<Parent>(&mut c)?;
        Ok(rows.into_iter().next().map(|r| r.source_release_id))
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
pub async fn pending_apps(state: &web::Data<AppState>) -> airborne_types::Result<Vec<PendingApp>> {
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        let rows=diesel::sql_query("SELECT org_id,app_id,jsonb_agg(jsonb_build_object('operation_id',id,'message','Upstream outcome is not confirmed. Writes are paused for this app.','expected',data->'expected','before',data->'before','upstream_workspace',data->'workspace') ORDER BY created_at) AS operations FROM hyperotaserver.release_operations WHERE kind='write' AND state='unresolved' GROUP BY org_id,app_id").load::<PendingApp>(&mut c)?;
        Ok(rows)
    })
}
// A rejected/pre-dispatch plan owns no upstream transition. Re-plan it, even
// after a source/registry change; retain the row id for the unique source index.
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
pub async fn save(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    kind: &str,
    source: &str,
    op: &Operation,
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
        diesel::sql_query("INSERT INTO hyperotaserver.release_operations (id,org_id,app_id,kind,source_release_id,state,data) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET state=excluded.state,data=excluded.data,updated_at=now()")
            .bind::<SqlUuid,_>(op.id).bind::<Text,_>(org).bind::<Text,_>(app).bind::<Text,_>(kind).bind::<Text,_>(source).bind::<Text,_>(op.state).bind::<Jsonb,_>(op.data).execute(c)?;
        Ok(())
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
