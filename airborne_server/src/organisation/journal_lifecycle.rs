// Copyright 2025 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

//! Q9's lifecycle barrier. Q18 extends this with epochs and application retirement.
use crate::types::{ABError, AppState, Result};
use actix_web::web;
use diesel::{
    prelude::*,
    sql_types::{Bool, Text},
};

pub const KEY: &str = "hashtextextended('airborne.organisation-lifecycle:' || $1, 0)";
#[derive(QueryableByName)]
struct Acquired {
    #[diesel(sql_type = Bool)]
    acquired: bool,
}
// The connection owns the session lock across asynchronous authz changes.
pub async fn exclusive(state: &web::Data<AppState>, org: &str) -> Result<PgConnection> {
    let url = state.release_write_db_url.clone();
    let org = org.to_owned();
    web::block(move || {
        let mut c = PgConnection::establish(&url)
            .map_err(|_| ABError::InternalServerError("Organisation lock unavailable".into()))?;
        diesel::sql_query("SET statement_timeout = '2s'").execute(&mut c)?;
        if !diesel::sql_query(format!("SELECT pg_try_advisory_lock({KEY}) AS acquired"))
            .bind::<Text, _>(&org)
            .get_result::<Acquired>(&mut c)?
            .acquired
        {
            return Err(ABError::Conflict(
                "An organisation write is in progress; retry deletion".into(),
            ));
        }
        Ok(c)
    })
    .await
    .map_err(|_| ABError::InternalServerError("Organisation lock unavailable".into()))?
}

/// Used by Q9 directly and by Q18's broader retirement transaction.
pub fn purge_rows(c: &mut PgConnection, org: &str) -> QueryResult<()> {
    for table in ["release_operations", "app_groups"] {
        diesel::sql_query(format!(
            "DELETE FROM hyperotaserver.{table} WHERE org_id=$1"
        ))
        .bind::<Text, _>(org)
        .execute(c)?;
    }
    Ok(())
}
pub async fn reset(mut c: PgConnection, org: &str) -> Result<PgConnection> {
    let org = org.to_owned();
    web::block(move || {
        c.transaction::<_, ABError, _>(|c| {
            purge_rows(c, &org)?;
            diesel::sql_query("UPDATE hyperotaserver.release_events SET org_id=$2 WHERE org_id=$1")
                .bind::<Text, _>(&org)
                .bind::<Text, _>(format!("{org}~retired~{}", uuid::Uuid::new_v4()))
                .execute(c)?;
            Ok(())
        })?;
        Ok(c)
    })
    .await
    .map_err(|_| ABError::InternalServerError("Organisation journal cleanup unavailable".into()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use diesel_migrations::MigrationHarness;
    #[actix_web::test]
    #[ignore = "requires disposable TEST_DATABASE_URL"]
    async fn q9_name_reuse_does_not_inherit_groups_or_journal() {
        let url = std::env::var("TEST_DATABASE_URL").unwrap();
        assert!(url.contains("scratch"));
        let mut c = PgConnection::establish(&url).unwrap();
        c.run_pending_migrations(crate::MIGRATIONS).unwrap();
        let org = format!("scratch-{}", uuid::Uuid::new_v4());
        let group = uuid::Uuid::new_v4();
        diesel::sql_query(
            "INSERT INTO hyperotaserver.app_groups(id,org_id,name) VALUES($1,$2,'private product')",
        )
        .bind::<diesel::sql_types::Uuid, _>(group)
        .bind::<Text, _>(&org)
        .execute(&mut c)
        .unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.release_operations(id,org_id,app_id,kind,source_release_id,state,data) VALUES($1,$2,'app','write','','unresolved','{}')").bind::<diesel::sql_types::Uuid,_>(uuid::Uuid::new_v4()).bind::<Text,_>(&org).execute(&mut c).unwrap();
        let mut c = reset(c, &org).await.unwrap();
        #[derive(QueryableByName)]
        struct Count {
            #[diesel(sql_type = diesel::sql_types::BigInt)]
            n: i64,
        }
        for table in ["app_groups", "release_operations"] {
            let n = diesel::sql_query(format!(
                "SELECT count(*) AS n FROM hyperotaserver.{table} WHERE org_id=$1"
            ))
            .bind::<Text, _>(&org)
            .get_result::<Count>(&mut c)
            .unwrap()
            .n;
            assert_eq!(n, 0, "new owner inherited {table}");
        }
        // Retrying an interrupted delete/create cleanup is safe.
        reset(c, &org).await.unwrap();
    }
}
