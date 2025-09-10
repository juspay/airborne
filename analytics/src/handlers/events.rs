use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, State},
    http::HeaderMap,
    response::Json,
};
use chrono::Utc;
use serde_json::json;
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    common::{
        error::{AppError, AppResult},
        models::{LoggingInfra, OtaEvent, OtaEventRequest},
    },
    AppState,
};

pub async fn ingest_event(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(request): Json<OtaEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    info!("Ingesting OTA event: {:?}", request.event_type);

    if request.device_id.is_empty() {
        return Err(AppError::Validation(
            "Device ID cannot be empty".to_string(),
        ));
    }

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| Some(addr.ip().to_string()));

    let event = OtaEvent {
        org_id: request.org_id,
        app_id: request.app_id,
        device_id: request.device_id,
        session_id: request.session_id,
        event_type: request.event_type,
        event_id: Some(Uuid::new_v4()),
        timestamp: Utc::now(),
        release_id: request.release_id,
        current_js_version: request.current_js_version,
        target_js_version: request.target_js_version,
        rollout_percentage: request.rollout_percentage,
        os_version: request.os_version,
        app_version: request.app_version,
        device_type: request.device_type,
        network_type: request.network_type,
        error_code: request.error_code,
        error_message: request.error_message,
        stack_trace: request.stack_trace,
        download_size_bytes: request.download_size_bytes,
        download_time_ms: request.download_time_ms,
        apply_time_ms: request.apply_time_ms,
        payload: request.payload,
        user_agent,
        ip_address,
    };

    if state.config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
        match state.kafka {
            Some(kafka) => {
                if let Err(e) = kafka.send_ota_event(&event).await {
                    error!("Failed to send event to Kafka: {:?}", e);
                    return Err(AppError::Internal(
                        "Failed to send event to Kafka".to_string(),
                    ));
                }
                info!("Successfully queued OTA event: {:?}", event.event_id);
            }
            None => {
                return Err(AppError::Internal(
                    "Kafka client not initialized".to_string(),
                ));
            }
        }
    } else if state.config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
        match state.victoria {
            Some(victoria) => {
                if let Err(e) = victoria.insert_ota_event(&event).await {
                    error!("Failed to send event to Victoria Metrics: {:?}", e);
                    return Err(AppError::Internal(
                        "Failed to send event to Victoria Metrics".to_string(),
                    ));
                }
                info!("Successfully saved OTA event: {:?}", event.event_id);
            }
            None => {
                return Err(AppError::Internal(
                    "Victoria Metrics client not initialized".to_string(),
                ));
            }
        }
    } else {
        return Err(AppError::Internal(
            "Unsupported logging infrastructure".to_string(),
        ));
    }

    Ok(Json(json!({
        "status": "success",
        "message": "OTA event queued for processing",
        "event_id": event.event_id,
        "timestamp": Utc::now()
    })))
}
