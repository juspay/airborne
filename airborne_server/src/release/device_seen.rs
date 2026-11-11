//! First manifest request, including strict 404s before the first release exists.
//! Public and unverified: this records a request, never successful device recovery.
use super::*;
use diesel::{
    prelude::*,
    sql_types::{Text, Timestamptz},
};

#[derive(QueryableByName)]
struct Seen {
    #[diesel(sql_type = Timestamptz)]
    first_device_seen_at: DateTime<Utc>,
}

pub async fn record(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> airborne_types::Result<()> {
    let pool = state.db_pool.clone();
    let (org, app) = (org.to_owned(), app.to_owned());
    crate::run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        diesel::sql_query("INSERT INTO hyperotaserver.first_device_requests (org_id, app_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind::<Text, _>(org).bind::<Text, _>(app).execute(&mut c)?;
        Ok(())
    })
}

pub async fn read(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> airborne_types::Result<Option<DateTime<Utc>>> {
    let pool = state.db_pool.clone();
    let (org, app) = (org.to_owned(), app.to_owned());
    crate::run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        Ok(diesel::sql_query("SELECT first_device_seen_at FROM hyperotaserver.first_device_requests WHERE org_id=$1 AND app_id=$2")
            .bind::<Text, _>(org).bind::<Text, _>(app).get_result::<Seen>(&mut c).optional()?.map(|r|r.first_device_seen_at))
    })
}
