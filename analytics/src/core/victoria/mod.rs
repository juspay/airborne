use prometheus::{
    CounterVec, HistogramVec, GaugeVec, Registry, 
    Opts, HistogramOpts, TextEncoder, Encoder
};
use chrono::{DateTime, Utc};
use anyhow::Result;
use std::time::Duration;
use tracing::{info, error};
use reqwest::Client as HttpClient;
use tokio::time::interval;

use crate::{common::{models::{
    ActiveDevicesMetrics, AdoptionMetrics, AdoptionTimeSeries, AnalyticsInterval, DailyActiveDevices, ErrorFrequency, FailureAnalytics, OtaEvent, VersionDistribution, VersionMetrics
}, utils}, core::victoria::query_builder::VictoriaQuery};


use futures::stream::FuturesUnordered;
use futures::StreamExt;
use std::collections::HashMap;

pub mod client;
mod query_builder;

/// Victoria Metrics client 
#[derive(Clone)]
pub struct Client {
    registry: Registry,
    
    // Core event counters
    ota_events_total: CounterVec,
    ota_downloads_total: CounterVec,
    ota_download_failures_total: CounterVec,
    ota_applies_total: CounterVec,
    ota_apply_failures_total: CounterVec,
    ota_update_checks_total: CounterVec,
    ota_update_available_total: CounterVec,
    ota_rollback_initiated_total: CounterVec,
    ota_rollback_completed_total: CounterVec,
    ota_rollback_failures_total: CounterVec,
    
    // Performance histograms
    ota_download_duration_ms: HistogramVec,
    ota_apply_duration_ms: HistogramVec,
    ota_download_size_bytes: HistogramVec,
    
    // Device tracking gauges
    ota_active_device: GaugeVec,
    ota_device_version: GaugeVec,
    
    // Device metadata counters
    ota_os_version_total: CounterVec,
    ota_device_type_total: CounterVec,
    
    // Query client for reading data
    query_client: client::VictoriaMetricsQueryClient,
}

impl Client {
    pub async fn new(victoria_metrics_url: String) -> Result<Self> {
        let registry = Registry::new();
        
        // Core event counters
        let ota_events_total = CounterVec::new(
            Opts::new("ota_events_total", "Total number of OTA events"),
            &["org_id", "app_id", "event_type"]
        )?;
        
        let ota_downloads_total = CounterVec::new(
            Opts::new("ota_downloads_total", "Total number of successful downloads"),
            &["org_id", "app_id", "release_id", "target_js_version"]
        )?;
        
        let ota_download_failures_total = CounterVec::new(
            Opts::new("ota_download_failures_total", "Total number of download failures"),
            &["org_id", "app_id", "release_id", "error_code"]
        )?;
        
        let ota_applies_total = CounterVec::new(
            Opts::new("ota_applies_total", "Total number of successful applies"),
            &["org_id", "app_id", "release_id", "target_js_version"]
        )?;
        
        let ota_apply_failures_total = CounterVec::new(
            Opts::new("ota_apply_failures_total", "Total number of apply failures"),
            &["org_id", "app_id", "release_id", "error_code"]
        )?;
        
        let ota_update_checks_total = CounterVec::new(
            Opts::new("ota_update_checks_total", "Total number of update checks"),
            &["org_id", "app_id", "release_id"]
        )?;
        
        let ota_update_available_total = CounterVec::new(
            Opts::new("ota_update_available_total", "Total number of update available events"),
            &["org_id", "app_id", "release_id"]
        )?;
        
        let ota_rollback_initiated_total = CounterVec::new(
            Opts::new("ota_rollback_initiated_total", "Total number of rollbacks initiated"),
            &["org_id", "app_id", "release_id", "error_code"]
        )?;
        
        let ota_rollback_completed_total = CounterVec::new(
            Opts::new("ota_rollback_completed_total", "Total number of rollbacks completed"),
            &["org_id", "app_id", "release_id"]
        )?;
        
        let ota_rollback_failures_total = CounterVec::new(
            Opts::new("ota_rollback_failures_total", "Total number of rollback failures"),
            &["org_id", "app_id", "release_id", "error_code"]
        )?;
        
        // Performance histograms
        let ota_download_duration_ms = HistogramVec::new(
            HistogramOpts::new("ota_download_duration_ms", "Download duration in milliseconds")
                .buckets(vec![100.0, 500.0, 1000.0, 5000.0, 10000.0, 30000.0, 60000.0]),
            &["org_id", "app_id", "release_id", "target_js_version"]
        )?;
        
        let ota_apply_duration_ms = HistogramVec::new(
            HistogramOpts::new("ota_apply_duration_ms", "Apply duration in milliseconds")
                .buckets(vec![50.0, 100.0, 500.0, 1000.0, 5000.0, 10000.0]),
            &["org_id", "app_id", "release_id", "target_js_version"]
        )?;
        
        let ota_download_size_bytes = HistogramVec::new(
            HistogramOpts::new("ota_download_size_bytes", "Download size in bytes")
                .buckets(vec![1024.0, 10240.0, 102400.0, 1048576.0, 10485760.0, 104857600.0]),
            &["org_id", "app_id", "release_id", "target_js_version"]
        )?;
        
        // Device tracking gauges
        let ota_active_device = GaugeVec::new(
            Opts::new("ota_active_device", "Active device indicator"),
            &["org_id", "app_id", "device_id"]
        )?;
        
        let ota_device_version = GaugeVec::new(
            Opts::new("ota_device_version", "Device version indicator"),
            &["org_id", "app_id", "js_version", "device_id"]
        )?;
        
        // Device metadata counters
        let ota_os_version_total = CounterVec::new(
            Opts::new("ota_os_version_total", "Total events by OS version"),
            &["org_id", "app_id", "os_version"]
        )?;
        
        let ota_device_type_total = CounterVec::new(
            Opts::new("ota_device_type_total", "Total events by device type"),
            &["org_id", "app_id", "device_type"]
        )?;
        
        // Register all metrics
        registry.register(Box::new(ota_events_total.clone()))?;
        registry.register(Box::new(ota_downloads_total.clone()))?;
        registry.register(Box::new(ota_download_failures_total.clone()))?;
        registry.register(Box::new(ota_applies_total.clone()))?;
        registry.register(Box::new(ota_apply_failures_total.clone()))?;
        registry.register(Box::new(ota_update_checks_total.clone()))?;
        registry.register(Box::new(ota_update_available_total.clone()))?;
        registry.register(Box::new(ota_rollback_initiated_total.clone()))?;
        registry.register(Box::new(ota_rollback_completed_total.clone()))?;
        registry.register(Box::new(ota_rollback_failures_total.clone()))?;
        registry.register(Box::new(ota_download_duration_ms.clone()))?;
        registry.register(Box::new(ota_apply_duration_ms.clone()))?;
        registry.register(Box::new(ota_download_size_bytes.clone()))?;
        registry.register(Box::new(ota_active_device.clone()))?;
        registry.register(Box::new(ota_device_version.clone()))?;
        registry.register(Box::new(ota_os_version_total.clone()))?;
        registry.register(Box::new(ota_device_type_total.clone()))?;
        
        let query_client = client::VictoriaMetricsQueryClient::new(victoria_metrics_url);

        let mut buffer = vec![];
        let encoder = TextEncoder::new();
        let metric_families = registry.gather();
        encoder.encode(&metric_families, &mut buffer).unwrap();

        // Output to the standard output.
        println!("Yuvraj Registry {}", String::from_utf8(buffer).unwrap());

        
        Ok(Self {
            registry,
            ota_events_total,
            ota_downloads_total,
            ota_download_failures_total,
            ota_applies_total,
            ota_apply_failures_total,
            ota_update_checks_total,
            ota_update_available_total,
            ota_rollback_initiated_total,
            ota_rollback_completed_total,
            ota_rollback_failures_total,
            ota_download_duration_ms,
            ota_apply_duration_ms,
            ota_download_size_bytes,
            ota_active_device,
            ota_device_version,
            ota_os_version_total,
            ota_device_type_total,
            query_client,
        })
    }

    /// Get metrics in Prometheus format for exposition
    pub fn get_metrics(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }

    /// Insert OTA event into metrics (mirrors ClickHouse insert_ota_event)
    pub async fn insert_ota_event(&self, event: &OtaEvent) -> Result<()> {
        let labels = &[
            event.org_id.as_str(),
            event.app_id.as_str(),
            &event.event_type.to_string(),
        ];

        // Core event counter
        self.ota_events_total.with_label_values(labels).inc();

        // Event-specific counters based on event type
        match event.event_type.to_string().as_str() {
            "DOWNLOAD_COMPLETED" => {
                let download_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                    event.target_js_version.as_deref().unwrap_or("unknown"),
                ];
                self.ota_downloads_total.with_label_values(download_labels).inc();

                // Record download performance metrics
                if let Some(download_time) = event.download_time_ms {
                    self.ota_download_duration_ms
                        .with_label_values(download_labels)
                        .observe(download_time as f64);
                }
                if let Some(download_size) = event.download_size_bytes {
                    self.ota_download_size_bytes
                        .with_label_values(download_labels)
                        .observe(download_size as f64);
                }
            },
            "DOWNLOAD_FAILED" => {
                let failure_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                    event.error_code.as_deref().unwrap_or("unknown"),
                ];
                self.ota_download_failures_total.with_label_values(failure_labels).inc();
            },
            "APPLY_SUCCESS" => {
                let apply_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                    event.target_js_version.as_deref().unwrap_or("unknown"),
                ];
                self.ota_applies_total.with_label_values(apply_labels).inc();

                // Record apply performance metrics
                if let Some(apply_time) = event.apply_time_ms {
                    self.ota_apply_duration_ms
                        .with_label_values(apply_labels)
                        .observe(apply_time as f64);
                }
            },
            "APPLY_FAILURE" => {
                let failure_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                    event.error_code.as_deref().unwrap_or("unknown"),
                ];
                self.ota_apply_failures_total.with_label_values(failure_labels).inc();
            },
            "UPDATE_CHECK" => {
                let check_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                ];
                self.ota_update_checks_total.with_label_values(check_labels).inc();
            },
            "UPDATE_AVAILABLE" => {
                let available_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                ];
                self.ota_update_available_total.with_label_values(available_labels).inc();
            },
            "ROLLBACK_INITIATED" => {
                let rollback_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                    event.error_code.as_deref().unwrap_or("unknown"),
                ];
                self.ota_rollback_initiated_total.with_label_values(rollback_labels).inc();
            },
            "ROLLBACK_COMPLETED" => {
                let rollback_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                ];
                self.ota_rollback_completed_total.with_label_values(rollback_labels).inc();
            },
            "ROLLBACK_FAILED" => {
                let rollback_failure_labels = &[
                    event.org_id.as_str(),
                    event.app_id.as_str(),
                    event.release_id.as_deref().unwrap_or("default"),
                    event.error_code.as_deref().unwrap_or("unknown"),
                ];
                self.ota_rollback_failures_total.with_label_values(rollback_failure_labels).inc();
            },
            _ => {
                // Handle any other event types - already counted in ota_events_total
            }
        }

        // Track active devices (unique device IDs)
        let device_labels = &[
            event.org_id.as_str(),
            event.app_id.as_str(),
            event.device_id.as_str(),
        ];
        self.ota_active_device.with_label_values(device_labels).set(1.0);

        // Track version distribution
        if let Some(current_version) = &event.current_js_version {
            let version_labels = &[
                event.org_id.as_str(),
                event.app_id.as_str(),
                current_version.as_str(),
                event.device_id.as_str(),
            ];
            self.ota_device_version.with_label_values(version_labels).set(1.0);
        }

        // Track device metadata
        if let Some(os_version) = &event.os_version {
            let os_labels = &[
                event.org_id.as_str(),
                event.app_id.as_str(),
                os_version.as_str(),
            ];
            self.ota_os_version_total.with_label_values(os_labels).inc();
        }

        if let Some(device_type) = &event.device_type {
            let device_labels = &[
                event.org_id.as_str(),
                event.app_id.as_str(),
                device_type.as_str(),
            ];
            self.ota_device_type_total.with_label_values(device_labels).inc();
        }

        Ok(())
    }

    /// Insert batch of OTA events (mirrors ClickHouse insert_ota_events_batch)
    pub async fn insert_ota_events_batch(&self, events: Vec<OtaEvent>) -> Result<()> {
        for event in events {
            self.insert_ota_event(&event).await?;
        }
        Ok(())
    }

    /// Get version distribution (mirrors ClickHouse get_version_distribution)
    pub async fn get_version_distribution(
        &self,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<VersionDistribution> {
        // Query for version distribution over the specified days period
        let query = format!(
            r#"count by (js_version) (
                ota_device_version{{org_id="{}",app_id="{}"}}[{}d]
            )"#,
            org_id, app_id, days
        );

        let response = self.query_client.query(&query).await?;
        let mut versions = Vec::new();
        let mut total_devices = 0;

        for result in response.data.result {
            if let Some(js_version) = result.metric.get("js_version") {
                if let Some((_, count_str)) = result.value {
                    let count: u64 = count_str.parse().unwrap_or(0);
                    total_devices += count;
                    versions.push(VersionMetrics {
                        js_version: js_version.clone(),
                        device_count: count,
                        percentage: 0.0, // Will calculate after we have total
                    });
                }
            }
        }

        // Calculate percentages
        for version in &mut versions {
            version.percentage = if total_devices > 0 {
                (version.device_count as f64 / total_devices as f64) * 100.0
            } else {
                0.0
            };
        }

        Ok(VersionDistribution {
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            total_devices,
            versions,
        })
    }

    /// Get active devices metrics (mirrors ClickHouse get_active_devices_metrics)
    pub async fn get_active_devices_metrics(
        &self,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<ActiveDevicesMetrics> {
        let query = format!(
            r#"count by (time) (
                count by (device_id) (
                    ota_active_device{{org_id="{}",app_id="{}"}}[{}d]
                )
            )"#,
            org_id, app_id, days
        );

        let end_time = Utc::now().timestamp();
        let start_time = end_time - (days as i64 * 24 * 60 * 60);

        let response = self.query_client.query_range(
            &query,
            start_time,
            end_time,
            "1d"
        ).await?;

        let mut daily_breakdown = Vec::new();
        let mut total_active_devices = 0;

        for result in response.data.result {
            if let Some(values) = result.values {
                for (timestamp, count_str) in values {
                    let count: u64 = count_str.parse().unwrap_or(0);
                    let dt = DateTime::from_timestamp(timestamp as i64, 0)
                        .unwrap_or_else(|| Utc::now());
                    let date = dt.date_naive();
                    
                    daily_breakdown.push(DailyActiveDevices {
                        date,
                        active_devices: count,
                    });
                    
                    if count > total_active_devices {
                        total_active_devices = count;
                    }
                }
            }
        }

        Ok(ActiveDevicesMetrics {
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            daily_breakdown,
            total_active_devices,
        })
    }

    /// Get failure analytics (mirrors ClickHouse get_failure_analytics)
    pub async fn get_failure_analytics(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: Option<&str>,
        days: u32,
    ) -> Result<FailureAnalytics> {
        let release_filter = if let Some(rid) = release_id {
            format!(r#",release_id="{}""#, rid)
        } else {
            String::new()
        };

        // Get total failures over the specified days
        let failure_query = format!(
            r#"sum(
                increase(ota_download_failures_total{{org_id="{}",app_id="{}"{}}}[{}d]) +
                increase(ota_apply_failures_total{{org_id="{}",app_id="{}"{}}}[{}d])
            )"#,
            org_id, app_id, release_filter, days,
            org_id, app_id, release_filter, days
        );

        // Get rollbacks over the specified days
        let rollback_query = format!(
            r#"sum(increase(ota_rollback_initiated_total{{org_id="{}",app_id="{}"{}}}[{}d]))"#,
            org_id, app_id, release_filter, days
        );

        // Get common errors
        let error_query = format!(
            r#"sum by (error_code) (
                ota_download_failures_total{{org_id="{}",app_id="{}"{}}} +
                ota_apply_failures_total{{org_id="{}",app_id="{}"{}}}
            )"#,
            org_id, app_id, release_filter,
            org_id, app_id, release_filter
        );

        let failure_response = self.query_client.query(&failure_query).await?;
        let rollback_response = self.query_client.query(&rollback_query).await?;
        let error_response = self.query_client.query(&error_query).await?;

        let total_failures = failure_response.data.result.first()
            .and_then(|r| r.value.as_ref())
            .map(|(_, v)| v.parse().unwrap_or(0))
            .unwrap_or(0);

        let total_rollbacks = rollback_response.data.result.first()
            .and_then(|r| r.value.as_ref())
            .map(|(_, v)| v.parse().unwrap_or(0))
            .unwrap_or(0);

        let mut common_errors = Vec::new();
        let mut total_error_count = 0u64;

        for result in error_response.data.result {
            if let Some(error_code) = result.metric.get("error_code") {
                if let Some((_, count_str)) = result.value {
                    let count: u64 = count_str.parse().unwrap_or(0);
                    total_error_count += count;
                    common_errors.push((error_code.clone(), count));
                }
            }
        }

        // Calculate percentages for common errors
        let common_errors = common_errors.into_iter().map(|(error_code, count)| {
            let percentage = if total_error_count > 0 {
                (count as f64 / total_error_count as f64) * 100.0
            } else {
                0.0
            };
            ErrorFrequency {
                error_code,
                count,
                percentage,
            }
        }).collect();

        // Get failure rate trend (simplified - would need more complex query for actual trend)
        let failure_rate_trend = Vec::new(); // Placeholder - would implement complex time-series query

        Ok(FailureAnalytics {
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            release_id: release_id.map(|s| s.to_string()),
            total_failures,
            total_rollbacks,
            common_errors,
            failure_rate_trend,
        })
    }

    /// Get adoption metrics (mirrors ClickHouse get_adoption_metrics)
    pub async fn get_adoption_metrics(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        date_millis: i64,
        interval: AnalyticsInterval,
        start_date_millis: i64,
        end_date_millis: i64,
    ) -> Result<AdoptionMetrics> {
        match interval {
            AnalyticsInterval::Hour => {
                let hourly_adoption_metrics = self.get_adoption_metrics_hourly_parallel(org_id, app_id, release_id, date_millis);
                Ok(
                    AdoptionMetrics {
                        org_id: org_id.to_string(),
                        app_id: app_id.to_string(),
                        release_id: release_id.to_string(),
                        time_breakdown: hourly_adoption_metrics.await?,
                    }
                )
            },
            AnalyticsInterval::Day => {
                let daywise_adoption_metrics = self.get_adoption_metrics_daywise_parallel(org_id, app_id, release_id, start_date_millis, end_date_millis);
                Ok(
                    AdoptionMetrics {
                        org_id: org_id.to_string(),
                        app_id: app_id.to_string(),
                        release_id: release_id.to_string(),
                        time_breakdown: daywise_adoption_metrics.await?,
                    }
                )
            },
            AnalyticsInterval::Week => todo!(),
            AnalyticsInterval::Month => todo!(),
        }
    }

    fn create_victoria_queries_for_counters(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        interval: AnalyticsInterval
    ) -> Vec<(String, String)> {
        let mut queries = Vec::new();
        for metric in [
            "ota_downloads_total",
            "ota_download_failures_total",
            "ota_applies_total",
            "ota_apply_failures_total",
            "ota_rollback_initiated_total",
            "ota_rollback_completed_total",
            "ota_rollback_failures_total",
            "ota_update_checks_total",
            "ota_update_available_total",
        ] {
            let base_query = VictoriaQuery::new()
                .metric_name(metric)
                .labels(vec![
                    ("org_id".to_string(), org_id.to_string()),
                    ("app_id".to_string(), app_id.to_string()),
                    ("release_id".to_string(), release_id.to_string())
                ])
                .operation("sum")
                .time_bucket(match interval {
                    AnalyticsInterval::Hour => "1h",
                    AnalyticsInterval::Day => "1d",
                    AnalyticsInterval::Week => "7d",
                    AnalyticsInterval::Month => "30d",
                })
                .group_by_labels(vec!["org_id", "app_id", "release_id"])
                .build();

            queries.push((metric.to_string(), base_query));
        }

        queries
    }

    /// Get adoption metrics hourly parallel
    pub async fn get_adoption_metrics_hourly_parallel(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        ts_millis: i64,
    ) -> Result<Vec<AdoptionTimeSeries>> {
        let end_time = utils::floor_to_hour(ts_millis);
        let start_time = end_time - 24 * 60 * 60; // last 24 h

        info!(
            "Getting hourly adoption metrics for org: {}, app: {}, release: {}, from: {}, to: {}",
            org_id, app_id, release_id, start_time, end_time
        );

        let queries = self.create_victoria_queries_for_counters(
            org_id,
            app_id,
            release_id,
            AnalyticsInterval::Hour,
        );

        let mut futures = FuturesUnordered::new();
        for (metric_name, promql) in queries {
            let client = self.query_client.clone();
            futures.push(async move {
                let resp = client
                    .query_range(&promql, start_time, end_time, "1h")
                    .await?;
                let points = resp
                    .data
                    .result
                    .into_iter()
                    .flat_map(|series| {
                        series
                            .values
                            .unwrap_or_default()
                            .into_iter()
                            .map(|(ts, v)| (ts as i64, v.parse().unwrap_or(0)))
                    })
                    .collect::<Vec<_>>();
                Ok::<_, anyhow::Error>((metric_name, points))
            });
        }

        let mut map: HashMap<i64, AdoptionTimeSeries> = HashMap::new();
        while let Some(batch) = futures.next().await {
            let (metric, data_points) = batch?; // propagate error if any
            for (ts, count) in data_points {
                let entry = map.entry(ts).or_insert_with(|| AdoptionTimeSeries {
                    time_slot: DateTime::from_timestamp(ts, 0)
                        .unwrap_or(Utc::now()),
                    download_success: 0,
                    download_failures: 0,
                    apply_success: 0,
                    apply_failures: 0,
                    rollbacks_initiated: 0,
                    rollbacks_completed: 0,
                    rollback_failures: 0,
                    update_checks: 0,
                    update_available: 0,
                });
                match metric.as_str() {
                    "ota_downloads_total"           => entry.download_success      = count,
                    "ota_download_failures_total"   => entry.download_failures     = count,
                    "ota_applies_total"             => entry.apply_success         = count,
                    "ota_apply_failures_total"      => entry.apply_failures        = count,
                    "ota_rollback_initiated_total"  => entry.rollbacks_initiated   = count,
                    "ota_rollback_completed_total"  => entry.rollbacks_completed   = count,
                    "ota_rollback_failures_total"   => entry.rollback_failures     = count,
                    "ota_update_checks_total"       => entry.update_checks         = count,
                    "ota_update_available_total"    => entry.update_available      = count,
                    _                               => {}
                }
            }
        }

        let mut series = map.into_iter()
            .map(|(_, v)| v)
            .collect::<Vec<_>>();
        series.sort_by_key(|s| s.time_slot.timestamp());

        Ok(series)
    }


    /// Get adoption metrics daywise parallel (mirrors ClickHouse get_adoption_metrics_daywise_parallel)
    pub async fn get_adoption_metrics_daywise_parallel(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        start_date_millis: i64,
        end_date_millis: i64,
    ) -> Result<Vec<AdoptionTimeSeries>> {
        let start_time = utils::floor_to_day(start_date_millis);
        let end_time   = utils::ceil_to_day(end_date_millis);

        info!(
            "Getting daywise adoption metrics for org: {}, app: {}, release: {}, from: {}, to: {}",
            org_id, app_id, release_id, start_time, end_time
        );

        let queries = self.create_victoria_queries_for_counters(
            org_id,
            app_id,
            release_id,
            AnalyticsInterval::Day,
        );

        let mut futures = FuturesUnordered::new();
        for (metric_name, promql) in queries {
            let client = self.query_client.clone();
            futures.push(async move {
                let resp = client
                    .query_range(&promql, start_time, end_time, "1d")
                    .await?;
                // flatten each series’ values into Vec<(timestamp_sec, count)>
                let points = resp
                    .data
                    .result
                    .into_iter()
                    .flat_map(|series| {
                        series
                            .values
                            .unwrap_or_default()
                            .into_iter()
                            .map(|(ts, v)| (ts as i64, v.parse().unwrap_or(0)))
                    })
                    .collect::<Vec<_>>();
                Ok::<_, anyhow::Error>((metric_name, points))
            });
        }

        let mut map: HashMap<i64, AdoptionTimeSeries> = HashMap::new();
        while let Some(batch) = futures.next().await {
            let (metric, data_points) = batch?; // bubbles up errors
            for (ts, count) in data_points {
                let entry = map.entry(ts).or_insert_with(|| AdoptionTimeSeries {
                    time_slot: DateTime::from_timestamp(ts, 0)
                        .unwrap_or(Utc::now()),
                    download_success:      0,
                    download_failures:     0,
                    apply_success:         0,
                    apply_failures:        0,
                    rollbacks_initiated:   0,
                    rollbacks_completed:   0,
                    rollback_failures:     0,
                    update_checks:         0,
                    update_available:      0,
                });
                match metric.as_str() {
                    "ota_downloads_total"           => entry.download_success      = count,
                    "ota_download_failures_total"   => entry.download_failures     = count,
                    "ota_applies_total"             => entry.apply_success         = count,
                    "ota_apply_failures_total"      => entry.apply_failures        = count,
                    "ota_rollback_initiated_total"  => entry.rollbacks_initiated   = count,
                    "ota_rollback_completed_total"  => entry.rollbacks_completed   = count,
                    "ota_rollback_failures_total"   => entry.rollback_failures     = count,
                    "ota_update_checks_total"       => entry.update_checks         = count,
                    "ota_update_available_total"    => entry.update_available      = count,
                    _                               => {}
                }
            }
        }

        let mut series = map.into_iter()
            .map(|(_, v)| v)
            .collect::<Vec<_>>();
        series.sort_by_key(|s| s.time_slot.timestamp());

        

        Ok(series)
    }

    pub async fn run_metrics_pusher(&self) -> Result<()> {

        let http = HttpClient::new();

        let mut ticker = interval(Duration::from_secs(60));

        loop {
            ticker.tick().await;

            let encoder = TextEncoder::new();
            let metric_families = self.registry.gather();
            let mut buffer = Vec::new();
            encoder.encode(&metric_families, &mut buffer)?;
            let body = String::from_utf8(buffer)?;

            let push_url = format!("{}/api/v1/import/prometheus", self.query_client.base_url);
            match http.post(&push_url).body(body).send().await {
                Ok(resp) if resp.status().is_success() => {
                    info!("[{}] Metrics pushed successfully", Utc::now());
                }
                Ok(resp) => {
                    error!(
                        "[{}] Push failed (status={}): {}",
                        Utc::now(),
                        resp.status(),
                        resp.text().await.unwrap_or_default()
                    );
                }
                Err(err) => {
                    error!("[{}] HTTP error pushing metrics: {}", Utc::now(), err);
                }
            }
        }
    }

}