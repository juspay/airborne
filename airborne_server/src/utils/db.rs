pub mod models;
pub mod schema;

use diesel::Connection;

use crate::config::AppConfig;
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool};
use log::info;
use urlencoding::encode;

// Type alias for Diesel's connection pool
pub type DbPool = Pool<ConnectionManager<PgConnection>>;

/// Read permits for the deployments feed: at most the pool size minus one (and at most 8),
/// so audit fan-out can never hold every connection and starve writes, authorization and
/// every other handler that shares the pool. Shared by all feed requests in the process.
pub fn feed_read_permits(pool: &DbPool) -> std::sync::Arc<tokio::sync::Semaphore> {
    std::sync::Arc::new(tokio::sync::Semaphore::new(feed_concurrency(
        pool.max_size(),
    )))
}
pub fn feed_concurrency(pool_size: u32) -> usize {
    (pool_size as usize).saturating_sub(1).clamp(1, 8)
}

/// The database server's transaction clock: the clock that stamps `created_at` columns.
/// Compare stored timestamps with this, never with the application server's clock.
pub async fn db_now(pool: DbPool) -> crate::types::Result<chrono::DateTime<chrono::Utc>> {
    use diesel::prelude::*;
    #[derive(QueryableByName)]
    struct Now {
        #[diesel(sql_type = diesel::sql_types::Timestamptz)]
        now: chrono::DateTime<chrono::Utc>,
    }
    crate::run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_millis(500))?;
        Ok(diesel::sql_query("SELECT now() AS now")
            .get_result::<Now>(&mut c)?
            .now)
    })
}

pub async fn get_database_url(app_config: &AppConfig, use_migration: bool) -> String {
    // Check if direct URL is set - use it directly if available for local development
    if use_migration {
        if let Some(ref url) = app_config.db_migration_url {
            return url.clone();
        }
    } else if let Some(ref url) = app_config.db_url {
        return url.clone();
    }

    let (user, password, host, port, name) = if use_migration {
        (
            &app_config.db_migration_user,
            &app_config.db_migration_password,
            &app_config.db_host,
            &app_config.db_port,
            &app_config.db_name,
        )
    } else {
        (
            &app_config.db_user,
            &app_config.db_password,
            &app_config.db_host,
            &app_config.db_port,
            &app_config.db_name,
        )
    };

    let encoded_password = encode(password);

    format!(
        "postgres://{}:{}@{}:{}/{}",
        user, encoded_password, host, port, name
    )
}

// Function to create a new connection pool
pub async fn establish_pool(app_config: &AppConfig) -> DbPool {
    let database_url = get_database_url(app_config, false).await;

    let max_connections = app_config.database_pool_size;

    let manager = ConnectionManager::<PgConnection>::new(database_url);

    match Pool::builder().max_size(max_connections).build(manager) {
        Ok(pool) => {
            // Test the connection
            match pool.get() {
                Ok(_) => info!("Successfully connected to the database"),
                Err(e) => info!("Warning: Could not get a test connection: {}", e),
            }
            pool
        }
        Err(e) => {
            panic!("Failed to create DB pool: {}", e);
        }
    }
}

pub async fn establish_connection(app_config: &AppConfig) -> PgConnection {
    // Have a different user with higher access for DB migrations
    let database_url = get_database_url(app_config, true).await;
    PgConnection::establish(&database_url).expect("Failed to connect to database")
}

#[cfg(test)]
mod feed_permit_tests {
    #[test]
    fn feed_reads_always_leave_a_connection_for_everything_else() {
        // The shipped default pool is 4.
        assert_eq!(super::feed_concurrency(4), 3);
        assert_eq!(super::feed_concurrency(2), 1);
        // A pool of one cannot spare a connection; the feed still reads one app at a time.
        assert_eq!(super::feed_concurrency(1), 1);
        assert_eq!(super::feed_concurrency(0), 1);
        assert_eq!(super::feed_concurrency(10), 8);
        assert_eq!(super::feed_concurrency(100), 8);
        for size in 2..200u32 {
            assert!((super::feed_concurrency(size) as u32) < size);
        }
    }
}
