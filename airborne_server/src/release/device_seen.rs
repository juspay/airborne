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

// No eviction: at most one attempt per app for this process. Once full, observation
// is dropped rather than allowing anonymous traffic to churn the cache or DB.
const CAPACITY: usize = 4096;
static SEEN: std::sync::LazyLock<std::sync::Mutex<std::collections::HashSet<(String, String)>>> =
    std::sync::LazyLock::new(Default::default);
static WRITER: std::sync::LazyLock<std::sync::Arc<tokio::sync::Semaphore>> =
    std::sync::LazyLock::new(|| std::sync::Arc::new(tokio::sync::Semaphore::new(1)));
fn admit(seen: &mut std::collections::HashSet<(String, String)>, key: (String, String)) -> bool {
    seen.len() < CAPACITY && seen.insert(key)
}
pub fn record(state: &web::Data<AppState>, org: &str, app: &str) {
    let key = (org.to_owned(), app.to_owned());
    let Ok(mut seen) = SEEN.try_lock() else {
        return;
    };
    if !admit(&mut seen, key.clone()) {
        return;
    }
    drop(seen);
    // Never queue writers or wait for a connection on the serving task.
    let Ok(permit) = WRITER.clone().try_acquire_owned() else {
        return;
    };
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let Ok(mut c) = pool.get_timeout(std::time::Duration::from_millis(100)) else {
            return;
        };
        let _ = diesel::sql_query("INSERT INTO hyperotaserver.first_device_requests (org_id, app_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind::<Text, _>(key.0).bind::<Text, _>(key.1).execute(&mut c);
    });
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn admission_is_scoped_bounded_and_never_retries() {
        let mut seen = std::collections::HashSet::new();
        assert!(admit(&mut seen, ("o".into(), "a".into())));
        assert!(!admit(&mut seen, ("o".into(), "a".into())));
        assert!(admit(&mut seen, ("other".into(), "a".into())));
        for i in 2..CAPACITY {
            assert!(admit(&mut seen, ("o".into(), i.to_string())));
        }
        assert!(!admit(&mut seen, ("new".into(), "app".into())));
        assert_eq!(seen.len(), CAPACITY);
    }
}
