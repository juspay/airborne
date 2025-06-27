mod common;
mod core;
mod handlers;

use anyhow::Result;
use axum::{
    response::IntoResponse, routing::{get, post}, Router
};
use axum::error_handling::HandleErrorLayer;
use tower::ServiceBuilder;
use tower_http::timeout::TimeoutLayer;
use std::{net::SocketAddr, time::Duration};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{common::config::Config, core::bootstrap_clickhouse, common::models::{AppState, ErrorResponse, LoggingInfra}};
use crate::handlers::{health, events, analytics};
use crate::core::kafka;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "analytics_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::load()?;
    info!("Loaded configuration: {:?}", config);

    let mut consumer_handle: Option<tokio::task::JoinHandle<()>> = None;
    let mut app_state = AppState {
        clickhouse: None,
        victoria: None,
        kafka: None,
        config: Arc::new(config.clone()),
    };

    if config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
        let clickhouse_client_res = bootstrap_clickhouse(&config).await;
        match clickhouse_client_res {
            Ok(clickhouse_client) => {
                info!("Connected to ClickHouse");

                let kafka_producer = Arc::new(kafka::Producer::new(&config.kafka).await?);
                info!("Connected to Kafka");

                let kafka_consumer = kafka::Consumer::new(&config.kafka, Arc::clone(&clickhouse_client)).await?;
                info!("Kafka consumer initialized");

                consumer_handle = Some(tokio::spawn(async move {
                    info!("Starting Kafka consumer...");
                    if let Err(e) = kafka_consumer.start_consuming().await {
                        error!("Kafka consumer error: {:?}", e);
                    }
                }));

                app_state.clickhouse = Some(Arc::clone(&clickhouse_client));
                app_state.kafka = Some(Arc::clone(&kafka_producer));
            }
            Err(e) => {
                error!("Failed to connect to ClickHouse: {:?}", e);
                return Err(e);
            }
            
        }
        info!("Using Kafka-ClickHouse logging infrastructure");
    } else if config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
        // Initialize Victoria Metrics client
        // For now, use a default Victoria Metrics URL (this should be configurable in the future)
        let victoria_url = std::env::var("VICTORIA_METRICS_URL")
            .unwrap_or_else(|_| "http://localhost:8428".to_string());
        match crate::core::victoria::Client::new(victoria_url).await {
            Ok(victoria_client) => {
                info!("Connected to Victoria Metrics");
                app_state.victoria = Some(Arc::new(victoria_client));
            },
            Err(e) => {
                error!("Failed to connect to Victoria Metrics: {:?}", e);
                return Err(anyhow::anyhow!("Failed to initialize Victoria Metrics client: {}", e));
            }
        }
        info!("Using Victoria Metrics logging infrastructure");
    } else {
        return Err(anyhow::anyhow!("Invalid logging infrastructure specified in config"));
    }

    let server_port = config.server.port;

    let safe_layer = ServiceBuilder::new()
        .layer(HandleErrorLayer::new(|err| async move {
            ErrorResponse::internal(err).into_response()
        }))
        .layer(TimeoutLayer::new(Duration::from_secs(7)));

    let app = Router::new()
        .route("/analytics/health", get(health::health_check))
        .route("/analytics/events", post(events::ingest_event))
        .route("/analytics/adoption", get(analytics::get_adoption_metrics))
        .route("/analytics/versions", get(analytics::get_version_distribution))
        .route("/analytics/active-devices", get(analytics::get_active_devices))
        .route("/analytics/failures", get(analytics::get_failure_metrics))
        .route("/analytics/performance", get(analytics::get_performance_metrics))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .layer(safe_layer)
        .with_state(app_state.clone());

    let app = app.into_make_service_with_connect_info::<SocketAddr>();

    let addr = SocketAddr::from(([0, 0, 0, 0], server_port));
    info!("OTA Analytics Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    let shutdown_signal = async move {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        info!("Shutdown signal received, stopping server...");
        
        match consumer_handle {
            Some(handle) => {
                handle.abort();
                if let Err(e) = handle.await {
                    error!("Error while shutting down Kafka consumer: {:?}", e);
                }
            }
            None => info!("No Kafka consumer to shut down"),
        };
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await?;

    info!("OTA Analytics Server stopped");

    Ok(())
}
