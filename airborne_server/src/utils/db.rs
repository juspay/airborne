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

    info!(
        "Creating database pool with max_connections: {}",
        max_connections
    );

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
