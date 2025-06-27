use std::{fs, sync::Arc};

use crate::{common::config::Config, common::utils::strip_sql_comments};
use anyhow::Result;
use tracing::info;

pub mod clickhouse;
pub mod victoria;
pub mod kafka;

pub async fn bootstrap_clickhouse(config: &Config) -> Result<Arc<clickhouse::Client>> {
    // Initialize ClickHouse client
    let clickhouse_client = Arc::new(clickhouse::Client::new(&config.clickhouse).await?);
    info!("Connected to ClickHouse");

    // Initialize tables and views
    let sql_text = fs::read_to_string("init-clickhouse.sql")?;
    let stripped_sql = strip_sql_comments(&sql_text);
    for raw_stmt in stripped_sql.split(';') {
        let stmt = raw_stmt.trim();
        if stmt.is_empty() {
            continue;
        }
        info!("Running ClickHouse migrations");
        clickhouse_client
            .query(stmt)
            .execute()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to run statement `{}`: {}", stmt, e))?;
    }

    Ok(clickhouse_client)
}