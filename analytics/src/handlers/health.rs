use axum::{extract::State, response::Json};
use chrono::Utc;

use crate::{
    common::{error::AppResult, models::{HealthResponse, LoggingInfra, ServiceHealthCheck, SystemMetrics}},
    AppState,
};

pub async fn health_check(State(state): State<AppState>) -> AppResult<Json<HealthResponse>> {
    // Check ClickHouse connection
    let clickhouse_healthy = 
    if state.config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
        match state.clickhouse {
            Some(client) => {
                let clickhouse_healthy = match client.query("SELECT 1").fetch_one::<u8>().await {
                    Ok(_) => true,
                    Err(e) => {
                        tracing::warn!("ClickHouse health check failed: {:?}", e);
                        false
                    }
                };
                clickhouse_healthy
            }
            None => {
                tracing::warn!("ClickHouse client is None");
                false
            }
        }
    } else {
        false
    };

    // Check Victoria Metrics connection
    let victoria_healthy = 
    if state.config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
        match state.victoria {
            Some(client) => {
                // Simple check by getting metrics - if this works, Victoria Metrics is healthy
                match client.get_metrics() {
                    Ok(_) => true,
                    Err(e) => {
                        tracing::warn!("Victoria Metrics health check failed: {:?}", e);
                        false
                    }
                }
            }
            None => {
                tracing::warn!("Victoria Metrics client is None");
                false
            }
        }
    } else {
        false
    };

    // For Kafka, we'll assume it's healthy if the producer was created successfully
    let kafka_healthy = true;

    let health_response = HealthResponse {
        status: if (clickhouse_healthy || victoria_healthy) && kafka_healthy {
            "healthy".to_string()
        } else {
            "unhealthy".to_string()
        },
        timestamp: Utc::now(),
        services: ServiceHealthCheck {
            clickhouse: clickhouse_healthy,
            kafka: kafka_healthy,
            consumer_lag: None, // Placeholder for consumer lag
        },
        metrics: SystemMetrics {
            events_processed_last_hour: 0,
            storage_size_gb: 0.0,
        },
    };

    Ok(Json(health_response))
}
