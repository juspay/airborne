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

// Bounded cooldown cache: transient failures retry, and old apps cannot permanently
// exclude new ones. Borrowed lookups avoid allocations on repeated requests.
const CAPACITY: usize = 4096;
const COOLDOWN: std::time::Duration = std::time::Duration::from_secs(60);
#[derive(Default)]
struct Admissions(
    std::collections::HashMap<String, std::collections::HashMap<String, std::time::Instant>>,
);
impl Admissions {
    fn admit(&mut self, org: &str, app: &str, now: std::time::Instant) -> bool {
        if self
            .0
            .get(org)
            .and_then(|apps| apps.get(app))
            .is_some_and(|at| now.duration_since(*at) < COOLDOWN)
        {
            return false;
        }
        if self.0.values().map(|apps| apps.len()).sum::<usize>() >= CAPACITY {
            let oldest = self
                .0
                .iter()
                .flat_map(|(org, apps)| apps.iter().map(move |(app, at)| (org, app, at)))
                .min_by_key(|(_, _, at)| *at)
                .map(|(o, a, _)| (o.clone(), a.clone()));
            if let Some((o, a)) = oldest {
                if let Some(apps) = self.0.get_mut(&o) {
                    apps.remove(&a);
                    if apps.is_empty() {
                        self.0.remove(&o);
                    }
                }
            }
        }
        self.0
            .entry(org.to_owned())
            .or_default()
            .insert(app.to_owned(), now);
        true
    }
}
static SEEN: std::sync::LazyLock<std::sync::Mutex<Admissions>> =
    std::sync::LazyLock::new(Default::default);
static WRITER: std::sync::LazyLock<std::sync::Arc<tokio::sync::Semaphore>> =
    std::sync::LazyLock::new(|| std::sync::Arc::new(tokio::sync::Semaphore::new(1)));
pub fn record(state: &web::Data<AppState>, org: &str, app: &str) {
    let Ok(mut seen) = SEEN.try_lock() else {
        return;
    };
    if !seen.admit(org, app, std::time::Instant::now()) {
        return;
    }
    drop(seen);
    // Never queue writers or wait for a connection on the serving task.
    let Ok(permit) = WRITER.clone().try_acquire_owned() else {
        return;
    };
    let key = (org.to_owned(), app.to_owned());
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
    fn admission_retries_after_cooldown_and_evicts_for_new_apps() {
        let mut seen = Admissions::default();
        let now = std::time::Instant::now();
        assert!(seen.admit("o", "a", now));
        assert!(!seen.admit("o", "a", now));
        assert!(seen.admit("o", "a", now + COOLDOWN));
        assert!(seen.admit("other", "a", now));
        for i in 2..CAPACITY {
            assert!(seen.admit("o", &i.to_string(), now));
        }
        assert!(seen.admit("new", "app", now));
        assert_eq!(
            seen.0.values().map(|apps| apps.len()).sum::<usize>(),
            CAPACITY
        );
    }
}
