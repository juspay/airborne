// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

//! What survives when an organisation is deleted and its name is reused.
//!
//! Deleting an organisation only removes its Casbin policies. Everything else is keyed by
//! the organisation *name*, so a new organisation of the same name would inherit the old
//! tenant's approval policy (makers and checkers), its deployment requests (which stay
//! listable, and approvable by anyone the new tenant re-adds), its application groups and,
//! once an application name is reused, its workspace, packages, files, releases and API
//! credentials. Two treatments:
//!   * release *control* state (`PURGED`) is deleted: it is only meaningful while the
//!     organisation lives;
//!   * application *data* (`RETIRED`) is not deleted but re-keyed to a unique tombstone
//!     (`<org>~retired~<uuid>`, listed in `organisation_retirements`). The new tenant then
//!     gets fresh workspaces and sees none of it, while the old Superposition workspaces,
//!     S3 objects and these rows stay put for manual recovery.
//!
//! Audit history (`release_events`) is deliberately kept and is hidden from the new
//! tenant by `organisation_epochs.started_at` instead.
//!
//! Protocol, all of it serialised per organisation name by one advisory lock (exclusive
//! here, shared when a request moves to `executing`, see `maker_checker::save_request`):
//!   1. `close`   before the authz delete: refuse while a request is executing, then mark
//!      the organisation closed so no request can start executing from now on.
//!   2. authz delete. If it fails, `reopen`.
//!      A closure only blocks executions for 10 minutes (so a crash between 1 and 2 cannot
//!      freeze a live organisation); a deleted organisation has no permissions to act with.
//!   3. `purge`   remove the rows. If this fails the rows stay inert (closed) and are
//!      purged again, in the same transaction that opens the new organisation.
use crate::run_blocking;
use crate::types::{ABError, AppState, Result};
use actix_web::web;
use diesel::prelude::*;
use diesel::sql_types::Text;

/// Tables keyed by organisation name whose contents must not outlive the organisation.
/// `app_group_members` goes with `app_groups` (ON DELETE CASCADE). `first_device_requests`
/// is purged first: it references `workspace_names`, which is re-keyed below.
const PURGED: [&str; 5] = [
    "first_device_requests",
    "deployment_requests",
    "approval_policies",
    "release_protections",
    "emergency_reviews",
];

/// Application data that is re-keyed, not deleted, when its organisation goes: (table,
/// organisation column). Block lists and serving policies move with the packages they
/// describe, so nothing fails open for the old data if it is ever recovered.
pub(crate) const RETIRED: [(&str, &str); 12] = [
    ("workspace_names", "organization_id"),
    ("packages_v2", "org_id"),
    ("packages", "org_id"),
    ("files", "org_id"),
    ("configs", "org_id"),
    ("releases", "org_id"),
    ("release_views", "org_id"),
    ("builds", "organisation"),
    ("blocked_packages", "org_id"),
    ("serving_policies", "org_id"),
    ("device_reports", "org_id"),
    ("user_credentials", "organisation"),
];

/// Exclusive for lifecycle changes, shared for `executing` transitions.
pub const LOCK_SQL: &str = "hashtextextended('airborne.organisation-lifecycle:' || $1, 0)";

pub fn lock_exclusive(c: &mut PgConnection, org: &str) -> QueryResult<()> {
    diesel::sql_query(format!("SELECT pg_advisory_xact_lock({LOCK_SQL})"))
        .bind::<Text, _>(org)
        .execute(c)
        .map(|_| ())
}

/// Delete the control-plane rows of `org` and retire its application data. The caller
/// holds the exclusive lock and runs this in one transaction. Idempotent: with nothing
/// left under the name it changes nothing and records nothing.
pub fn purge_rows(c: &mut PgConnection, org: &str) -> QueryResult<()> {
    super::journal_lifecycle::purge_rows(c, org)?;
    for table in PURGED {
        diesel::sql_query(format!(
            "DELETE FROM hyperotaserver.{table} WHERE org_id=$1"
        ))
        .bind::<Text, _>(org)
        .execute(c)?;
    }
    let tombstone = format!("{org}~retired~{}", uuid::Uuid::new_v4());
    let mut retired = 0;
    for (table, column) in RETIRED {
        retired += diesel::sql_query(format!(
            "UPDATE hyperotaserver.{table} SET {column}=$2 WHERE {column}=$1"
        ))
        .bind::<Text, _>(org)
        .bind::<Text, _>(&tombstone)
        .execute(c)?;
    }
    if retired > 0 {
        diesel::sql_query(
            "INSERT INTO hyperotaserver.organisation_retirements(tombstone,org_id) VALUES($1,$2)",
        )
        .bind::<Text, _>(&tombstone)
        .bind::<Text, _>(org)
        .execute(c)?;
        log::warn!(
            "Retired {retired} application data rows of deleted organisation {org} as {tombstone}"
        );
    }
    Ok(())
}

/// Step 1. Fails with 409 while any request of the organisation is executing: that
/// execution was already authorised and cannot be stopped, so deletion waits for it.
pub async fn close(state: &web::Data<AppState>, org: &str) -> Result<()> {
    let pool = state.db_pool.clone();
    let org = org.to_owned();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        c.transaction::<_, ABError, _>(|c| {
            lock_exclusive(c, &org)?;
            let busy = diesel::sql_query("SELECT EXISTS(SELECT 1 FROM hyperotaserver.deployment_requests WHERE org_id=$1 AND status='executing') AS busy")
                .bind::<Text, _>(&org)
                .get_result::<Busy>(c)?
                .busy;
            if busy {
                return Err(ABError::Conflict("A deployment request is executing in this organisation. Let it finish, or have a checker reconcile it, then delete again".into()));
            }
            // '-infinity': organisations that predate organisation_epochs have no start.
            diesel::sql_query("INSERT INTO hyperotaserver.organisation_epochs(org_id,started_at,closed_at) VALUES($1,'-infinity',now()) ON CONFLICT(org_id) DO UPDATE SET closed_at=now()")
                .bind::<Text, _>(&org)
                .execute(c)?;
            Ok(())
        })
    })
}

#[derive(QueryableByName)]
struct Busy {
    #[diesel(sql_type = diesel::sql_types::Bool)]
    busy: bool,
}

/// Step 2 failed: the organisation still exists, so it is open again.
pub async fn reopen(state: &web::Data<AppState>, org: &str) -> Result<()> {
    let pool = state.db_pool.clone();
    let org = org.to_owned();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        diesel::sql_query(
            "UPDATE hyperotaserver.organisation_epochs SET closed_at=NULL WHERE org_id=$1",
        )
        .bind::<Text, _>(org)
        .execute(&mut c)?;
        Ok(())
    })
}

/// Step 3, in one transaction.
pub async fn purge(state: &web::Data<AppState>, org: &str) -> Result<()> {
    let pool = state.db_pool.clone();
    let org = org.to_owned();
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        c.transaction::<_, ABError, _>(|c| {
            lock_exclusive(c, &org)?;
            purge_rows(c, &org)?;
            Ok(())
        })
    })
}
