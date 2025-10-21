use std::{future::Future, sync::Arc};

use log::{error, info};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};

use crate::{
    types::ABError,
    utils::metrics::{CACHE_FAILS, CACHE_HITS, CACHE_MISSES, INSTANCE_ID},
};

#[derive(Debug)]
pub struct RedisKey {
    key: String,
    labels: Vec<String>,
}

#[derive(Clone)]
pub struct RedisCache {
    conn: Arc<ConnectionManager>,
    prefix: String,
}

impl RedisCache {
    /// Create a Redis-backed cache with a shared (multiplexed) connection.
    pub async fn new(client: redis::Client, prefix: impl Into<String>) -> Result<Self, ABError> {
        let mgr = ConnectionManager::new(client)
            .await
            .map_err(|e| ABError::InternalServerError(format!("redis connect: {e}")))?;
        info!("Connected to Redis cache");
        Ok(Self {
            conn: Arc::new(mgr),
            prefix: prefix.into(),
        })
    }

    /// Build a namespaced key: "prefix:org:app:part1:part2:...".
    pub fn key(&self, organisation: &str, application: &str, parts: &[&str]) -> RedisKey {
        let mut k = String::with_capacity(
            self.prefix.len()
                + 1
                + organisation.len()
                + 1
                + application.len()
                + 1
                + parts.iter().map(|s| s.len() + 1).sum::<usize>(),
        );
        k.push_str(&self.prefix);
        k.push(':');
        k.push_str(organisation);
        k.push(':');
        k.push_str(application);
        for p in parts {
            k.push(':');
            k.push_str(p);
        }

        let mut labels = Vec::with_capacity(9);
        labels.push(INSTANCE_ID.clone());
        labels.push(self.prefix.clone());
        labels.push(organisation.to_string());
        labels.push(application.to_string());

        // Fill up to 5 levels, pad with "none"
        for i in 0..5 {
            if let Some(p) = parts.get(i) {
                labels.push((*p).to_string());
            } else {
                labels.push("none".to_string());
            }
        }

        RedisKey { key: k, labels }
    }

    /// GET and JSON-deserialize into T. Returns Ok(None) on cache miss.
    pub async fn get<T: DeserializeOwned>(
        &self,
        redis_key: &RedisKey,
    ) -> Result<Option<T>, ABError> {
        let mut r = (*self.conn).clone();
        let key = redis_key.key.clone();
        let bytes: Option<Vec<u8>> = r.get(&key).await.map_err(|e| {
            error!("Failed to GET {key}: {e}");
            CACHE_FAILS.with_label_values(&redis_key.labels).inc();
            ABError::InternalServerError("service error".to_string())
        })?;

        match bytes {
            None => {
                CACHE_MISSES.with_label_values(&redis_key.labels).inc();
                Ok(None)
            }
            Some(b) => {
                let val = serde_json::from_slice::<T>(&b).map_err(|e| {
                    CACHE_FAILS.with_label_values(&redis_key.labels).inc();
                    error!("Failed to decode cache {key}: {e}");
                    ABError::InternalServerError("service error".to_string())
                })?;
                info!("Cache hit for key {:?}", redis_key);
                CACHE_HITS.with_label_values(&redis_key.labels).inc();
                Ok(Some(val))
            }
        }
    }

    /// SET with TTL (seconds), JSON-serializing the value.
    pub async fn set_ex<T: Serialize>(
        &self,
        redis_key: &RedisKey,
        value: &T,
        ttl_secs: usize,
    ) -> Result<(), ABError> {
        let mut r = (*self.conn).clone();
        let key = redis_key.key.clone();
        let payload = serde_json::to_vec(value).map_err(|e| {
            error!("Failed to encode cache {key}: {e}");
            CACHE_FAILS.with_label_values(&redis_key.labels).inc();
            ABError::InternalServerError("service error".to_string())
        })?;

        let _: () = redis::cmd("SET")
            .arg(&key)
            .arg(payload)
            .arg("EX")
            .arg(ttl_secs)
            .query_async(&mut r)
            .await
            .map_err(|e| {
                error!("Failed to SET {key}: {e}");
                CACHE_FAILS.with_label_values(&redis_key.labels).inc();
                ABError::InternalServerError("service error".to_string())
            })?;
        Ok(())
    }

    #[allow(unused)]
    pub async fn del(&self, redis_key: &RedisKey) -> Result<(), ABError> {
        let mut r = (*self.conn).clone();
        let key = redis_key.key.clone();
        let _: () = r.del(&key).await.map_err(|e| {
            error!("Failed to DEL {key}: {e}");
            CACHE_FAILS.with_label_values(&redis_key.labels).inc();
            ABError::InternalServerError("service error".to_string())
        })?;
        Ok(())
    }

    /// Get the cached value, or compute it via `fetch_fn`, then cache it.
    ///
    /// - `key`: Redis key
    /// - `ttl_secs`: expiration time in seconds
    /// - `fetch_fn`: async closure returning the value if not cached
    pub async fn get_or_try_set<T, F, Fut>(
        &self,
        key: &RedisKey,
        ttl_secs: usize,
        fetch_fn: F,
    ) -> Result<T, ABError>
    where
        T: Serialize + DeserializeOwned + Clone + Send + Sync + 'static,
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, ABError>>,
    {
        if let Some(val) = self.get::<T>(key).await? {
            return Ok(val);
        }

        let val = fetch_fn().await?;

        let _ = self.set_ex(key, &val, ttl_secs).await;

        Ok(val)
    }
}
