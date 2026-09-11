#![deny(unused_crate_dependencies)]
mod common;
mod core;
mod handlers;

use std::{net::SocketAddr, sync::Arc, time::Duration};

use anyhow::Result;
use axum::{
    error_handling::HandleErrorLayer,
    http::{header, HeaderValue, Method},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tower::ServiceBuilder;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing::{error, info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    common::{
        config::{Config, CorsPolicy},
        models::{AppState, ErrorResponse, LoggingInfra},
    },
    core::kafka,
    core::{bootstrap_clickhouse, victoria},
    handlers::{analytics, events, health},
};

/// Builds the CORS layer from the configured policy.
///
/// `AllowAny` reproduces the previous `CorsLayer::permissive()` behaviour and
/// is correct when a CDN or gateway in front of this service owns CORS. When
/// nothing sits in front, an allow-list is what stops an arbitrary site from
/// reading another tenant's analytics out of a visitor's browser.
fn build_cors_layer(policy: &CorsPolicy) -> Result<CorsLayer> {
    match policy {
        CorsPolicy::AllowAny => {
            warn!(
                "CORS is allowing any origin. Set CORS_ALLOWED_ORIGINS to an \
                 allow-list if this service is exposed without a CDN or gateway \
                 that enforces CORS on its behalf."
            );
            Ok(CorsLayer::permissive())
        }
        CorsPolicy::AllowList(origins) => {
            let parsed = origins
                .iter()
                .map(|origin| {
                    HeaderValue::from_str(origin).map_err(|e| {
                        anyhow::anyhow!(
                            "Invalid origin {:?} in CORS_ALLOWED_ORIGINS: {}",
                            origin,
                            e
                        )
                    })
                })
                .collect::<Result<Vec<_>>>()?;

            info!(
                "CORS restricted to {} origin(s): {:?}",
                parsed.len(),
                origins
            );

            Ok(CorsLayer::new()
                .allow_origin(AllowOrigin::list(parsed))
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers([header::CONTENT_TYPE]))
        }
    }
}

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

                let kafka_consumer =
                    kafka::Consumer::new(&config.kafka, Arc::clone(&clickhouse_client)).await?;
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
        match victoria::Client::new(victoria_url).await {
            Ok(victoria_client) => {
                let victoria_client_arc = Arc::new(victoria_client);
                let vm_pusher = victoria_client_arc.clone();
                tokio::spawn(async move {
                    let _ = vm_pusher.run_metrics_pusher().await;
                });
                app_state.victoria = Some(victoria_client_arc);
                info!("Connected to Victoria Metrics");
            }
            Err(e) => {
                error!("Failed to connect to Victoria Metrics: {:?}", e);
                return Err(anyhow::anyhow!(
                    "Failed to initialize Victoria Metrics client: {}",
                    e
                ));
            }
        }
        info!("Using Victoria Metrics logging infrastructure");
    } else {
        return Err(anyhow::anyhow!(
            "Invalid logging infrastructure specified in config"
        ));
    }

    let server_port = config.server.port;

    // Built before the listener binds so a malformed allow-list fails startup
    // loudly rather than silently degrading to a policy nobody chose.
    let cors_layer = build_cors_layer(&config.server.cors)?;

    let safe_layer = ServiceBuilder::new()
        .layer(HandleErrorLayer::new(|err| async move {
            ErrorResponse::internal(err).into_response()
        }))
        .layer(TimeoutLayer::new(Duration::from_secs(7)));

    let app = Router::new()
        .route("/analytics/health", get(health::health_check))
        .route("/analytics/events", post(events::ingest_event))
        .route("/analytics/adoption", get(analytics::get_adoption_metrics))
        .route(
            "/analytics/versions",
            get(analytics::get_version_distribution),
        )
        .route(
            "/analytics/active-devices",
            get(analytics::get_active_devices),
        )
        .route("/analytics/failures", get(analytics::get_failure_metrics))
        .route(
            "/analytics/performance",
            get(analytics::get_performance_metrics),
        )
        .layer(cors_layer)
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

#[cfg(test)]
mod cors_tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    const ALLOWED: &str = "https://airborne.example.com";
    const OTHER: &str = "https://evil.example.com";

    /// Drives a real request through the configured CORS layer and returns the
    /// `access-control-allow-origin` the browser would receive, if any.
    async fn allow_origin_header_for(policy: &CorsPolicy, request_origin: &str) -> Option<String> {
        let app = Router::new()
            .route("/analytics/adoption", get(|| async { "{}" }))
            .layer(build_cors_layer(policy).expect("layer should build"));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/analytics/adoption")
                    .header("origin", request_origin)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        response
            .headers()
            .get("access-control-allow-origin")
            .map(|value| value.to_str().unwrap().to_string())
    }

    /// The security property: an origin outside the allow-list must not receive
    /// permission to read the response, or any site a user visits can pull
    /// another tenant's analytics out of their browser.
    #[tokio::test]
    async fn allow_list_rejects_unlisted_origin() {
        let policy = CorsPolicy::AllowList(vec![ALLOWED.to_string()]);

        assert_eq!(
            allow_origin_header_for(&policy, ALLOWED).await.as_deref(),
            Some(ALLOWED),
            "the listed origin should be permitted"
        );
        assert_eq!(
            allow_origin_header_for(&policy, OTHER).await,
            None,
            "an unlisted origin must not be granted access"
        );
    }

    /// The documented default must keep behaving exactly as the previous
    /// `CorsLayer::permissive()` did, so CDN-fronted deployments are unaffected.
    #[tokio::test]
    async fn allow_any_permits_arbitrary_origins() {
        let policy = CorsPolicy::AllowAny;

        assert_eq!(
            allow_origin_header_for(&policy, OTHER).await.as_deref(),
            Some("*"),
            "AllowAny should keep permitting every origin"
        );
    }

    /// A malformed origin must fail startup rather than degrade to some other
    /// policy the operator did not choose.
    #[test]
    fn malformed_origin_fails_to_build() {
        let policy = CorsPolicy::AllowList(vec!["ht\ntp://broken".to_string()]);

        assert!(
            build_cors_layer(&policy).is_err(),
            "an unparseable origin must be rejected at startup"
        );
    }
}
