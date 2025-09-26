pub mod models;

use std::collections::BTreeMap;

use anyhow::{anyhow, Ok, Result};
use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};
use clickhouse::{Client as ClickHouseClient, Row};
use serde::{Deserialize, Serialize};
use time::{Date, Duration, OffsetDateTime, Time};
use tracing::info;
use uuid::Uuid;

use crate::{
    common::{
        config::ClickHouseConfig,
        models::{
            ActiveDevicesMetrics, AdoptionMetrics, AdoptionTimeSeries, AnalyticsInterval,
            DailyActiveDevices, DailyFailures, ErrorFrequency, FailureAnalytics, OtaEvent,
            VersionDistribution, VersionMetrics,
        },
    },
    core::clickhouse::models::OtaEventRow,
};

#[derive(Clone)]
pub struct Client {
    pub client: ClickHouseClient,
    #[allow(dead_code)]
    pub database: String,
}

impl Client {
    pub async fn new(config: &ClickHouseConfig) -> Result<Self> {
        let mut client = ClickHouseClient::default()
            .with_url(&config.url)
            .with_database(&config.database);

        if let Some(username) = &config.username {
            client = client.with_user(username);
        }

        if let Some(password) = &config.password {
            client = client.with_password(password);
        }

        let client_instance = Self {
            client,
            database: config.database.clone(),
        };

        // The schema is now initialized via init-clickhouse.sql
        info!(
            "ClickHouse client initialized for database: {}",
            config.database
        );

        Ok(client_instance)
    }

    // Add a method to access the client for health checks
    pub fn query(&self, sql: &str) -> clickhouse::query::Query {
        self.client.query(sql)
    }

    /// Insert OTA event into the raw events table
    #[allow(dead_code)]
    pub async fn insert_ota_event(&self, event: &OtaEvent) -> Result<()> {
        let row = OtaEventRow {
            org_id: event.org_id.clone(),
            app_id: event.app_id.clone(),
            device_id: event.device_id.clone(),
            session_id: event.session_id.clone(),
            event_type: event.event_type.to_string(),
            event_id: event.event_id.unwrap_or_else(uuid::Uuid::new_v4),
            timestamp: event.timestamp.timestamp(),
            event_date: (event.timestamp.num_days_from_ce() - 719_163) as u16, // Convert to ClickHouse date format (days since 1970-01-01),
            release_id: event.release_id.clone(),
            current_js_version: event.current_js_version.clone(),
            target_js_version: event.target_js_version.clone(),
            rollout_percentage: event.rollout_percentage,
            os_version: event.os_version.clone(),
            app_version: event.app_version.clone(),
            device_type: event.device_type.clone(),
            network_type: event.network_type.clone(),
            error_code: event.error_code.clone(),
            error_message: event.error_message.clone(),
            stack_trace: event.stack_trace.clone(),
            download_size_bytes: event.download_size_bytes,
            download_time_ms: event.download_time_ms,
            apply_time_ms: event.apply_time_ms,
            payload: event
                .payload
                .as_ref()
                .map(|p| serde_json::to_string(p).unwrap_or_else(|_| "{}".to_string()))
                .unwrap_or_else(|| "{}".to_string()),
            user_agent: event.user_agent.clone(),
            ip_address: event.ip_address.clone(),
        };

        let mut insert = self.client.insert("ota_events_raw")?;
        insert.write(&row).await?;
        insert.end().await?;

        info!(
            "OTA event inserted: {} for org {} and app {}",
            event.event_type.to_string(),
            event.org_id,
            event.app_id
        );
        Ok(())
    }

    fn try_days_from_epoch_chrono(ts_secs: i64) -> Option<u16> {
        let dt = Utc.timestamp_opt(ts_secs, 0).single()?;
        let epoch_ndt = NaiveDate::from_ymd_opt(1970, 1, 1)?;

        Some(
            dt.date_naive()
                .signed_duration_since(epoch_ndt)
                .num_days()
                .unsigned_abs() as u16,
        )
    }

    fn days_from_epoch_chrono(ts_secs: i64) -> u16 {
        // defaulting to 1st June 2025
        Self::try_days_from_epoch_chrono(ts_secs).unwrap_or(20_219)
    }

    pub async fn insert_ota_events_batch(&self, events: Vec<OtaEvent>) -> Result<()> {
        if events.is_empty() {
            return Ok(());
        }

        let events_len = events.len();
        let rows: Vec<OtaEventRow> = events
            .into_iter()
            .map(|event| {
                OtaEventRow {
                    org_id: event.org_id,
                    app_id: event.app_id,
                    device_id: event.device_id,
                    session_id: event.session_id,
                    event_type: event.event_type.to_string(),
                    event_id: event.event_id.unwrap_or_else(Uuid::new_v4),
                    timestamp: event.timestamp.timestamp_millis(),
                    event_date: Self::days_from_epoch_chrono(event.timestamp.timestamp()), // Convert to ClickHouse date format (days since 1970-01-01)
                    release_id: event.release_id,
                    current_js_version: event.current_js_version,
                    target_js_version: event.target_js_version,
                    rollout_percentage: event.rollout_percentage,
                    os_version: event.os_version,
                    app_version: event.app_version,
                    device_type: event.device_type,
                    network_type: event.network_type,
                    error_code: event.error_code,
                    error_message: event.error_message,
                    stack_trace: event.stack_trace,
                    download_size_bytes: event.download_size_bytes,
                    download_time_ms: event.download_time_ms,
                    apply_time_ms: event.apply_time_ms,
                    payload: event
                        .payload
                        .as_ref()
                        .map(|p| serde_json::to_string(p).unwrap_or_else(|_| "{}".to_string()))
                        .unwrap_or_else(|| "{}".to_string()),
                    user_agent: event.user_agent,
                    ip_address: event.ip_address,
                }
            })
            .collect();

        info!("Inserting {}", serde_json::json!(rows));

        let mut insert = self.client.insert("ota_events_raw")?;
        for row in rows {
            insert.write(&row).await?;
        }
        insert.end().await?;

        info!("Batch inserted {} OTA events", events_len);
        Ok(())
    }

    pub async fn get_adoption_metrics_hourly_parallel(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        ts_millis: i64,
    ) -> Result<Vec<AdoptionTimeSeries>> {
        fn hour_to_datetime(date_millis: i64, hour: u8) -> DateTime<Utc> {
            let nd = Utc
                .timestamp_millis_opt(date_millis)
                .single()
                .unwrap_or_else(Utc::now);
            nd.date_naive()
                .and_hms_opt(hour as u32, 0, 0)
                .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc))
                .unwrap_or_else(Utc::now)
        }

        let make_fetch = |view_name: &'static str, column_alias: &'static str| {
            let client = self.client.clone();
            let org_id = org_id.to_string();
            let app_id = app_id.to_string();
            let release_id = release_id.to_string();
            async move {
                let sql = format!(
                    r#"
                    SELECT
                        event_hour   AS hour,
                        {col}        AS cnt
                    FROM {view}
                    WHERE
                          org_id      = '{org}'
                      AND app_id      = '{app}'
                      AND release_id  = '{release}'
                      AND event_date  = toDate(toDateTime64('{ts}', 3))
                    "#,
                    col = column_alias,
                    view = view_name,
                    org = org_id,
                    app = app_id,
                    release = release_id,
                    ts = ts_millis
                );

                let mut cursor = client.query(&sql).fetch::<(u8, u64)>()?;
                let mut rows = Vec::new();
                while let Some((hour, cnt)) = cursor.next().await? {
                    rows.push((hour, cnt));
                }
                info!("Fetched {} rows from {}", rows.len(), view_name);
                Ok(rows)
            }
        };

        let downloads_fut = make_fetch("hourly_downloads", "download_count");
        let applies_fut = make_fetch("hourly_applies", "apply_count");
        let dl_failures_fut = make_fetch("hourly_download_failures", "download_failure_count");
        let ap_failures_fut = make_fetch("hourly_apply_failures", "apply_failure_count");
        let rb_inits_fut = make_fetch("hourly_rollback_initiates", "rollback_initiate_count");
        let rollbacks_fut = make_fetch("hourly_rollback_completes", "rollback_complete_count");
        let rb_failures_fut = make_fetch("hourly_rollback_failures", "rollback_failures_count");
        let update_checks_fut = make_fetch("hourly_update_checks", "update_check_count");
        let update_available_fut =
            make_fetch("hourly_update_availables", "update_availability_count");

        let (
            downloads_res,
            applies_res,
            dl_failures_res,
            ap_failures_res,
            rollback_inits_res,
            rollbacks_res,
            rb_failures_res,
            update_checks_res,
            update_available_res,
        ) = tokio::join!(
            downloads_fut,
            applies_fut,
            dl_failures_fut,
            ap_failures_fut,
            rb_inits_fut,
            rollbacks_fut,
            rb_failures_fut,
            update_checks_fut,
            update_available_fut,
        );

        let downloads_rows = downloads_res?;
        let applies_rows = applies_res?;
        let dl_failures_rows = dl_failures_res?;
        let ap_failures_rows = ap_failures_res?;
        let rollback_inits_rows = rollback_inits_res?;
        let rollbacks_rows = rollbacks_res?;
        let rb_failures_rows = rb_failures_res?;
        let update_checks_rows = update_checks_res?;
        let update_available_rows = update_available_res?;

        let mut adoption_map: BTreeMap<u8, AdoptionTimeSeries> = BTreeMap::new();

        for hour in 0..24 {
            adoption_map.insert(
                hour,
                AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    download_success: 0,
                    apply_success: 0,
                    download_failures: 0,
                    apply_failures: 0,
                    rollbacks_completed: 0,
                    rollback_failures: 0,
                    rollbacks_initiated: 0,
                    update_checks: 0,
                    update_available: 0,
                },
            );
        }

        for (hour, cnt) in downloads_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.download_success += cnt;
        }
        for (hour, cnt) in applies_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.apply_success += cnt;
        }
        for (hour, cnt) in dl_failures_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.download_failures += cnt;
        }
        for (hour, cnt) in ap_failures_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.apply_failures += cnt;
        }
        for (hour, cnt) in rollback_inits_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.rollbacks_initiated = cnt;
        }
        for (hour, cnt) in rollbacks_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.rollbacks_completed = cnt;
        }
        for (hour, cnt) in rb_failures_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.rollback_failures = cnt;
        }
        for (hour, cnt) in update_checks_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.update_checks = cnt;
        }
        for (hour, cnt) in update_available_rows {
            let entry = adoption_map
                .entry(hour)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: hour_to_datetime(ts_millis, hour),
                    ..Default::default()
                });
            entry.update_available = cnt;
        }

        let result = adoption_map.into_values().collect();
        Ok(result)
    }

    fn dates_between(start_ms: i64, end_ms: i64) -> Option<Vec<Date>> {
        if start_ms > end_ms {
            return None;
        }

        let start_dt =
            OffsetDateTime::from_unix_timestamp_nanos((start_ms * 1_000_000).into()).ok()?;
        let end_dt = OffsetDateTime::from_unix_timestamp_nanos((end_ms * 1_000_000).into()).ok()?;

        let mut current_date = start_dt.date();
        let end_date = end_dt.date();

        let mut out = Vec::new();
        while current_date <= end_date {
            out.push(current_date);

            let midnight = current_date.with_time(Time::MIDNIGHT).assume_utc();
            let next = midnight + Duration::days(1);
            current_date = next.date();
        }

        Some(out)
    }

    pub async fn get_adoption_metrics_daywise_parallel(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: &str,
        start_date_millis: i64,
        end_date_millis: i64,
    ) -> Result<Vec<AdoptionTimeSeries>> {
        fn date_millis_to_datetime(date_millis: i64) -> DateTime<Utc> {
            let nd = Utc
                .timestamp_millis_opt(date_millis)
                .single()
                .unwrap_or_else(Utc::now);
            nd.date_naive()
                .and_hms_opt(0, 0, 0)
                .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc))
                // fallback in the unlikely case of invalid hour
                .unwrap_or_else(Utc::now)
        }

        #[derive(Row, Serialize, Deserialize, Debug)]
        struct RawCHEventAggregate {
            cnt: u64,
            #[serde(with = "clickhouse::serde::time::date")]
            event_date: time::Date,
        }

        let make_fetch = |view_name: &'static str, column_alias: &'static str| {
            let client = self.client.clone();
            let org_id = org_id.to_string();
            let app_id = app_id.to_string();
            let release_id = release_id.to_string();
            async move {
                let sql = format!(
                    r#"
                    SELECT
                        {col}        AS cnt,
                        event_date   AS event_date
                    FROM {view}
                    WHERE
                          org_id      = '{org}'
                      AND app_id      = '{app}'
                      AND release_id  = '{release}'
                      AND event_date >= toDate(toDateTime64('{ts_start}', 3))
                      AND event_date <= toDate(toDateTime64('{ts_end}', 3))
                    "#,
                    col = column_alias,
                    view = view_name,
                    org = org_id,
                    app = app_id,
                    release = release_id,
                    ts_start = start_date_millis,
                    ts_end = end_date_millis
                );

                let mut cursor = client.query(&sql).fetch::<RawCHEventAggregate>()?;
                let mut rows = Vec::new();
                while let Some(raw_aggregate) = cursor.next().await? {
                    rows.push(raw_aggregate);
                }
                info!(
                    "Fetched {} rows from {} and rows: {:?}",
                    rows.len(),
                    view_name,
                    rows
                );
                Ok(rows)
            }
        };

        // Spawn six futures in parallel:
        let downloads_fut = make_fetch("daily_downloads", "download_count");
        let applies_fut = make_fetch("daily_applies", "apply_count");
        let dl_failures_fut = make_fetch("daily_download_failures", "download_failure_count");
        let ap_failures_fut = make_fetch("daily_apply_failures", "apply_failure_count");
        let rb_inits_fut = make_fetch("daily_rollback_initiates", "rollback_initiate_count");
        let rollbacks_fut = make_fetch("daily_rollback_completes", "rollback_complete_count");
        let rb_failures_fut = make_fetch("daily_rollback_failures", "rollback_failures_count");
        let update_checks_fut = make_fetch("daily_update_checks", "update_check_count");
        let update_available_fut =
            make_fetch("daily_update_availables", "update_availability_count");

        // Run them concurrently
        let (
            downloads_res,
            applies_res,
            dl_failures_res,
            ap_failures_res,
            rollback_inits_res,
            rollbacks_res,
            rb_failures_res,
            update_checks_res,
            update_available_res,
        ) = tokio::join!(
            downloads_fut,
            applies_fut,
            dl_failures_fut,
            ap_failures_fut,
            rb_inits_fut,
            rollbacks_fut,
            rb_failures_fut,
            update_checks_fut,
            update_available_fut,
        );

        let downloads_rows = downloads_res?;
        let applies_rows = applies_res?;
        let dl_failures_rows = dl_failures_res?;
        let ap_failures_rows = ap_failures_res?;
        let rollback_inits_rows = rollback_inits_res?;
        let rollbacks_rows = rollbacks_res?;
        let rb_failures_rows = rb_failures_res?;
        let update_checks_rows = update_checks_res?;
        let update_available_rows = update_available_res?;

        let mut adoption_map: BTreeMap<i64, AdoptionTimeSeries> = BTreeMap::new();

        fn make_map_key(date: time::Date) -> Result<i64> {
            let naive_date =
                NaiveDate::from_ymd_opt(date.year(), date.month() as u32, date.day() as u32)
                    .and_then(|d| d.and_hms_opt(0, 0, 0))
                    .ok_or_else(|| anyhow!("Invalid date"))?;

            let dt =
                chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(naive_date, chrono::Utc);
            Ok(dt.timestamp_millis())
        }
        for date in Self::dates_between(start_date_millis, end_date_millis).unwrap_or_default() {
            let key = make_map_key(date)?;
            adoption_map.insert(
                key,
                AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    download_success: 0,
                    apply_success: 0,
                    download_failures: 0,
                    apply_failures: 0,
                    rollbacks_completed: 0,
                    rollback_failures: 0,
                    rollbacks_initiated: 0,
                    update_checks: 0,
                    update_available: 0,
                },
            );
        }

        for row in downloads_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.download_success += row.cnt;
        }
        for row in applies_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.apply_success += row.cnt;
        }
        for row in dl_failures_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.download_failures += row.cnt;
        }
        for row in ap_failures_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.apply_failures += row.cnt;
        }
        for row in rollback_inits_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.rollbacks_initiated = row.cnt;
        }
        for row in rollbacks_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.rollbacks_completed = row.cnt;
        }
        for row in rb_failures_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.rollback_failures = row.cnt;
        }
        for row in update_checks_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.update_checks = row.cnt;
        }
        for row in update_available_rows {
            let key = make_map_key(row.event_date)?;
            let entry = adoption_map
                .entry(key)
                .or_insert_with(|| AdoptionTimeSeries {
                    time_slot: date_millis_to_datetime(key),
                    ..Default::default()
                });
            entry.update_available = row.cnt;
        }

        let result = adoption_map.into_values().collect();
        Ok(result)
    }

    #[allow(clippy::too_many_arguments)]
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
                let hourly_adoption_metrics = self.get_adoption_metrics_hourly_parallel(
                    org_id,
                    app_id,
                    release_id,
                    date_millis,
                );

                Ok(AdoptionMetrics {
                    org_id: org_id.to_string(),
                    app_id: app_id.to_string(),
                    release_id: release_id.to_string(),
                    time_breakdown: hourly_adoption_metrics.await?,
                })
            }
            AnalyticsInterval::Day => {
                let daywise_adoption_metrics = self.get_adoption_metrics_daywise_parallel(
                    org_id,
                    app_id,
                    release_id,
                    start_date_millis,
                    end_date_millis,
                );

                Ok(AdoptionMetrics {
                    org_id: org_id.to_string(),
                    app_id: app_id.to_string(),
                    release_id: release_id.to_string(),
                    time_breakdown: daywise_adoption_metrics.await?,
                })
            }
            AnalyticsInterval::Week => todo!(),
            AnalyticsInterval::Month => todo!(),
        }
    }

    pub async fn get_version_distribution(
        &self,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<VersionDistribution> {
        let sql = format!(
            r#"
            SELECT 
                ifNull(currentJsVersion, '') as js_version,
                uniq(deviceId) as device_count
            FROM ota_events_raw 
            WHERE 
                  orgId = '{}' 
              AND appId = '{}' 
              AND currentJsVersion IS NOT NULL
              AND timestamp >= subtractDays(now(), {})
            GROUP BY js_version
            ORDER BY device_count DESC
            "#,
            org_id, app_id, days
        );

        let mut cursor = self.client.query(&sql).fetch::<(String, u64)>()?;
        let mut versions = Vec::new();
        let mut total_devices = 0u64;

        while let Some((js_version, device_count)) = cursor.next().await? {
            total_devices += device_count;
            versions.push(VersionMetrics {
                js_version,
                device_count,
                percentage: 0.0, // Will be calculated below
            });
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

    pub async fn get_active_devices_metrics(
        &self,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<ActiveDevicesMetrics> {
        let sql = format!(
            r#"
        SELECT
            eventDate AS event_date,
            uniq(deviceId) AS active_devices
        FROM ota_events_raw
        WHERE
              orgId    = '{}'
          AND appId    = '{}'
          AND eventDate >= subtractDays(today(), {})
        GROUP BY eventDate
        ORDER BY eventDate
        "#,
            org_id, app_id, days
        );

        // Fetch (Date, UInt64) directly—Date maps to chrono::NaiveDate
        #[derive(Row, Serialize, Deserialize, Debug)]
        struct ActiveDevicesRow {
            #[serde(with = "clickhouse::serde::time::date")]
            event_date: time::Date,
            active_devices: u64,
        }

        let mut cursor = self.client.query(&sql).fetch::<ActiveDevicesRow>()?;
        let mut daily_breakdown = Vec::new();
        let mut total_active_devices = 0u64;

        while let Some(row) = cursor.next().await? {
            if row.active_devices > total_active_devices {
                total_active_devices = row.active_devices;
            }

            let date = chrono::NaiveDate::from_ymd_opt(
                row.event_date.year(),
                row.event_date.month() as u32,
                row.event_date.day() as u32,
            )
            .ok_or_else(|| {
                anyhow!("Invalid date conversion from time::Date to chrono::NaiveDate")
            })?;
            daily_breakdown.push(DailyActiveDevices {
                date,
                active_devices: row.active_devices,
            });
        }

        Ok(ActiveDevicesMetrics {
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            daily_breakdown,
            total_active_devices,
        })
    }

    /// Get active devices metrics
    #[allow(dead_code)]
    pub async fn get_active_devices_metrics1(
        &self,
        org_id: &str,
        app_id: &str,
        days: u32,
    ) -> Result<ActiveDevicesMetrics> {
        let sql = format!(
            r#"
            SELECT 
                eventDate as event_date,
                uniq(deviceId) as active_devices
            FROM ota_events_raw 
            WHERE
                  orgId = '{}' 
              AND appId = '{}' 
              AND eventDate >= subtractDays(today(), {})
            GROUP BY eventDate
            ORDER BY eventDate
            "#,
            org_id, app_id, days
        );

        let mut cursor = self.client.query(&sql).fetch::<(u32, u64)>()?;
        let mut daily_breakdown = Vec::new();
        let mut total_active_devices = 0u64;

        while let Some((date_days, active_devices)) = cursor.next().await? {
            if active_devices > total_active_devices {
                total_active_devices = active_devices;
            }
            // Convert ClickHouse Date (days since 1900-01-01) to NaiveDate
            let date = chrono::NaiveDate::from_num_days_from_ce_opt(date_days as i32 + 693_594)
                .unwrap_or_else(|| chrono::Utc::now().date_naive());
            daily_breakdown.push(DailyActiveDevices {
                date,
                active_devices,
            });
        }

        Ok(ActiveDevicesMetrics {
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            daily_breakdown,
            total_active_devices,
        })
    }

    /// Get failure analytics
    pub async fn get_failure_analytics(
        &self,
        org_id: &str,
        app_id: &str,
        release_id: Option<&str>,
        days: u32,
    ) -> Result<FailureAnalytics> {
        let mut where_clause = format!(
            "orgId = '{}' AND appId = '{}' AND timestamp >= subtractDays(now(), {})",
            org_id, app_id, days
        );

        if let Some(release_id) = release_id {
            where_clause.push_str(&format!(" AND releaseId = '{}'", release_id));
        }

        // Get total failures and rollbacks
        let totals_sql = format!(
            r#"
            SELECT 
                countIf(eventType IN ('APPLY_FAILURE', 'DOWNLOAD_FAILED')) as total_failures,
                countIf(eventType = 'rollback_triggered') as total_rollbacks
            FROM ota_events_raw 
            WHERE {}
            "#,
            where_clause
        );

        let (total_failures, total_rollbacks): (u64, u64) = self
            .client
            .query(&totals_sql)
            .fetch_one()
            .await
            .unwrap_or((0, 0));

        // Get daily breakdown
        let daily_sql = format!(
            r#"
            SELECT 
                toDate(timestamp) as event_date,
                countIf(eventType IN ('APPLY_FAILURE', 'DOWNLOAD_FAILED')) as failures,
                countIf(eventType = 'rollback_triggered') as rollbacks
            FROM ota_events_raw 
            WHERE {}
            GROUP BY event_date
            ORDER BY event_date
            "#,
            where_clause
        );

        let mut daily_cursor = self.client.query(&daily_sql).fetch::<(u32, u64, u64)>()?;
        let mut failure_rate_trend = Vec::new();

        while let Some((date_days, failures, rollbacks)) = daily_cursor.next().await? {
            // Convert ClickHouse Date (days since 1900-01-01) to NaiveDate
            let date = chrono::NaiveDate::from_num_days_from_ce_opt(date_days as i32 + 693_594)
                .unwrap_or_else(|| chrono::Utc::now().date_naive());
            failure_rate_trend.push(DailyFailures {
                date,
                failures,
                rollbacks,
            });
        }

        // Get common errors
        let errors_sql = format!(
            r#"
            SELECT 
                errorCode,
                count() as frequency
            FROM ota_events_raw 
            WHERE {} 
              AND eventType IN ('APPLY_FAILURE', 'DOWNLOAD_FAILED')
              AND errorCode IS NOT NULL
            GROUP BY errorCode
            ORDER BY frequency DESC
            LIMIT 10
            "#,
            where_clause
        );

        let mut errors_cursor = self.client.query(&errors_sql).fetch::<(String, u64)>()?;
        let mut common_errors = Vec::new();
        let mut total_error_count = 0u64;

        // First pass: collect errors and calculate total
        let mut error_data = Vec::new();
        while let Some((error_code, frequency)) = errors_cursor.next().await? {
            total_error_count += frequency;
            error_data.push((error_code, frequency));
        }

        // Second pass: calculate percentages
        for (error_code, count) in error_data {
            let percentage = if total_error_count > 0 {
                (count as f64 / total_error_count as f64) * 100.0
            } else {
                0.0
            };
            common_errors.push(ErrorFrequency {
                error_code,
                count,
                percentage,
            });
        }

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
}
