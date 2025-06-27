use axum::{
    extract::{Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::{
    common::{error::{
        AppError, AppResult
    }, models::{
        ActiveDevicesMetrics, AdoptionMetrics, AnalyticsInterval, FailureMetrics, LoggingInfra, PerformanceMetrics, VersionDistribution
    }},
    AppState
};

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub org_id: String,
    pub app_id: String,
    pub release_id: Option<String>,
    pub date: Option<i64>,
    pub days: Option<u32>,
    pub start_date: Option<i64>,
    pub end_date: Option<i64>,
    pub interval: Option<AnalyticsInterval>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse<T> {
    pub success: bool,
    pub data: T,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl<T> AnalyticsResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn _failure(data: T) -> Self {
        Self {
            success: false,
            data,
            timestamp: chrono::Utc::now(),
        }
    }
}

pub async fn get_adoption_metrics(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<AdoptionMetrics>>> {

    let date = params.date.unwrap_or(chrono::Utc::now().timestamp());

    match params.interval {
        Some(AnalyticsInterval::Day) => {
            if params.start_date.is_none() && params.end_date.is_none() {
                return Err(AppError::Validation("start_date and end_date in millis must be specified for daywise metrics.".to_string()));
            }
        },
        Some(AnalyticsInterval::Hour) => {
            if params.date.is_none() {
                return Err(AppError::Validation("date in millis must be specified for hourly metrics.".to_string()));
            }
        },
        _ => {
            return Err(AppError::Validation("Interval must be specified. Allowed intervals: DAY, HOUR".to_string()));
        }
    }

    let metrics = 
        if state.config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
            match state.clickhouse {
                Some(clickhouse) => {
                    clickhouse.get_adoption_metrics(
                        &params.org_id,
                        &params.app_id,
                        params.release_id.as_deref().unwrap_or("default"),
                        date,
                        params.interval.unwrap_or(AnalyticsInterval::Day),
                        params.start_date.unwrap_or(0),
                        params.end_date.unwrap_or(0),
                    ).await
                },
                None => Err(AppError::DatabaseError("Clickhouse client not initialized".to_string()).into()),
            }
        } else if state.config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
            match state.victoria {
                Some(victoria) => {
                    victoria.get_adoption_metrics(
                        &params.org_id,
                        &params.app_id,
                        params.release_id.as_deref().unwrap_or("default"),
                        date,
                        params.interval.unwrap_or(AnalyticsInterval::Day),
                        params.start_date.unwrap_or(0),
                        params.end_date.unwrap_or(0),
                    ).await
                },
                None => Err(AppError::DatabaseError("Victoria Metrics client not initialized".to_string()).into()),
            }
        } else {
            return Err(AppError::Validation("Unsupported logging infrastructure for analytics".to_string()));
        };

    match metrics {
        Ok(metrics) => Ok(Json(AnalyticsResponse::success(metrics))),
        Err(e) => {
            error!("Failed to fetch adoption metrics: {:?}", e);
            Err(AppError::DatabaseError(e.to_string()).into())
        }
    }

}

pub async fn get_version_distribution(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<Vec<VersionDistribution>>>> {

    info!("Fetching version distribution for app_id: {} and org_id: {}", params.app_id, params.org_id);

    let days = params.days.unwrap_or(30);

    let distribution = 
        if state.config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
            match state.clickhouse {
                Some(clickhouse) => clickhouse.get_version_distribution(
                    &params.org_id,
                    &params.app_id,
                    days,
                ).await,
                None => Err(AppError::DatabaseError("Clickhouse client not initialized".to_string()).into()),
            }
        } else if state.config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
            match state.victoria {
                Some(victoria) => victoria.get_version_distribution(
                    &params.org_id,
                    &params.app_id,
                    days,
                ).await,
                None => Err(AppError::DatabaseError("Victoria Metrics client not initialized".to_string()).into()),
            }
        } else {
            return Err(AppError::Validation("Unsupported logging infrastructure for analytics".to_string()));
        };

    match distribution {
        Ok(distribution) => {
            info!("Successfully fetched version distribution for app_id: {} and org_id: {}", params.app_id, params.org_id);
            Ok(Json(AnalyticsResponse::success(vec![distribution])))
        },
        Err(e) => {
            error!("Failed to fetch version distribution: {:?}", e);
            return Err(AppError::DatabaseError(e.to_string()).into());
        }
    }
}

pub async fn get_active_devices(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<ActiveDevicesMetrics>>> {

    info!("Fetching active devices for org_id: {} and app_id: {}", params.org_id, params.app_id);

    let days = params.days.unwrap_or(30);

    let metrics = 
        if state.config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
            match state.clickhouse {
                Some(clickhouse) => clickhouse.get_active_devices_metrics(
                    &params.org_id,
                    &params.app_id,
                    days,
                ).await,
                None => Err(AppError::DatabaseError("Clickhouse client not initialized".to_string()).into()),
            }
        } else if state.config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
            match state.victoria {
                Some(victoria) => victoria.get_active_devices_metrics(
                    &params.org_id,
                    &params.app_id,
                    days,
                ).await,
                None => Err(AppError::DatabaseError("Victoria Metrics client not initialized".to_string()).into()),
            }
        } else {
            return Err(AppError::Validation("Unsupported logging infrastructure for analytics".to_string()));
        };

    match metrics {
        Ok(metrics) => {
            Ok(Json(AnalyticsResponse::success(metrics)))
        },
        Err(e) => {
            error!("Failed to fetch active devices metrics: {:?}", e);
            Err(AppError::DatabaseError(e.to_string()).into())
        }
    }
}

pub async fn get_failure_metrics(
    State(state): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<FailureMetrics>>> {

    info!("Fetching failure metrics for org_id: {} and app_id: {}", params.org_id, params.app_id);

    let days = params.days.unwrap_or(30);

    let metrics: Result<FailureMetrics, Box<dyn std::error::Error + Send + Sync>> = 
        if state.config.logging_infrastructure == LoggingInfra::KafkaClickhouse {
            match state.clickhouse {
                Some(clickhouse) => {
                    let failure_analytics = clickhouse.get_failure_analytics(
                        &params.org_id,
                        &params.app_id,
                        params.release_id.as_deref(),
                        days,
                    ).await?;
                    let failure_metrics = FailureMetrics {
                        org_id: failure_analytics.org_id,
                        app_id: failure_analytics.app_id,
                        release_id: failure_analytics.release_id,
                        total_failures: failure_analytics.total_failures,
                        failure_rate: if failure_analytics.total_failures > 0 { 100.0 } else { 0.0 },
                        common_errors: failure_analytics.common_errors,
                    };
                    Ok(failure_metrics)
                },
                None => Err(AppError::DatabaseError("Clickhouse client not initialized".to_string()).into()),
            }
        } else if state.config.logging_infrastructure == LoggingInfra::VictoriaMetrics {
            match state.victoria {
                Some(victoria) => {
                    let failure_analytics = victoria.get_failure_analytics(
                        &params.org_id,
                        &params.app_id,
                        params.release_id.as_deref(),
                        days,
                    ).await?;
                    let failure_metrics = FailureMetrics {
                        org_id: failure_analytics.org_id,
                        app_id: failure_analytics.app_id,
                        release_id: failure_analytics.release_id,
                        total_failures: failure_analytics.total_failures,
                        failure_rate: if failure_analytics.total_failures > 0 { 100.0 } else { 0.0 },
                        common_errors: failure_analytics.common_errors,
                    };
                    Ok(failure_metrics)
                },
                None => Err(AppError::DatabaseError("Victoria Metrics client not initialized".to_string()).into()),
            }
        } else {
            return Err(AppError::Validation("Unsupported logging infrastructure for analytics".to_string()));
        };

    match metrics {
        Ok(failure_metrics) => {
            info!("Successfully fetched failure metrics for org_id: {} and app_id: {}", params.org_id, params.app_id);
            Ok(Json(AnalyticsResponse::success(failure_metrics)))
        },
        Err(e) => {
            error!("Failed to fetch failure metrics: {:?}", e);
            return Err(AppError::DatabaseError(e.to_string()).into());
        }
    }
}

pub async fn get_performance_metrics(
    State(_): State<AppState>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<Json<AnalyticsResponse<PerformanceMetrics>>> {

    info!("Fetching performance metrics for org_id: {} and app_id: {}", params.org_id, params.app_id);

    let _days = params.days.unwrap_or(30);

    let metrics = PerformanceMetrics {
        org_id: params.org_id.clone(),
        app_id: params.app_id.clone(),
        release_id: Some(params.release_id.clone().unwrap_or_else(|| "default".to_string())),
        avg_download_time_ms: 0.0,
        avg_apply_time_ms: 0.0,
        avg_download_size_bytes: 0.0,
    };

    Ok(Json(AnalyticsResponse::success(metrics)))
}
