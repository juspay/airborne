use lazy_static::lazy_static;
use log::error;
use prometheus::{register_int_counter_vec, Encoder, IntCounterVec, TextEncoder};
use reqwest::Client;
use std::time::Duration;
use tokio::time::interval;

lazy_static! {
    pub static ref INSTANCE_ID: String = uuid::Uuid::new_v4().to_string();
    pub static ref CACHE_HITS: IntCounterVec = register_int_counter_vec!(
        "redis_cache_hits_total",
        "Number of cache hits by prefix and key hierarchy (pod-specific)",
        &[
            "instance", "prefix", "org", "app", "level_1", "level_2", "level_3", "level_4",
            "level_5"
        ]
    )
    .unwrap();
    pub static ref CACHE_MISSES: IntCounterVec = register_int_counter_vec!(
        "redis_cache_misses_total",
        "Number of cache misses by prefix and key hierarchy (pod-specific)",
        &[
            "instance", "prefix", "org", "app", "level_1", "level_2", "level_3", "level_4",
            "level_5"
        ]
    )
    .unwrap();
    pub static ref CACHE_FAILS: IntCounterVec = register_int_counter_vec!(
        "redis_cache_fails_total",
        "Number of cache fails by prefix and key hierarchy (pod-specific)",
        &[
            "instance", "prefix", "org", "app", "level_1", "level_2", "level_3", "level_4",
            "level_5"
        ]
    )
    .unwrap();
}

pub async fn push_metrics_task(vm_url: String) {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to build HTTP client for pushing metrics");

    let encoder = TextEncoder::new();
    let mut ticker = interval(Duration::from_secs(30));

    loop {
        ticker.tick().await;
        let metric_families = prometheus::gather();
        let mut buffer = Vec::new();
        if encoder.encode(&metric_families, &mut buffer).is_ok() {
            if let Err(e) = client
                .post(format!("{}/api/v1/import/prometheus", vm_url))
                .body(buffer)
                .send()
                .await
            {
                error!("Failed to push metrics: {e}");
            }
        }
    }
}
