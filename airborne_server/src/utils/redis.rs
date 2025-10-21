use std::{future::Future, sync::Arc};

use log::{error, info};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};

use crate::types::ABError;

pub struct RedisKey(String);

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

    /// Build a namespaced key: "prefix:part1:part2:...".
    pub fn key(&self, parts: &[&str]) -> RedisKey {
        let mut k = String::with_capacity(
            self.prefix.len() + 1 + parts.iter().map(|s| s.len() + 1).sum::<usize>(),
        );
        k.push_str(&self.prefix);
        for p in parts {
            k.push(':');
            k.push_str(p);
        }
        RedisKey(k)
    }

    /// GET and JSON-deserialize into T. Returns Ok(None) on cache miss.
    pub async fn get<T: DeserializeOwned>(&self, key: &RedisKey) -> Result<Option<T>, ABError> {
        let mut r = (*self.conn).clone();
        let key = key.0.clone();
        let bytes: Option<Vec<u8>> = r.get(&key).await.map_err(|e| {
            error!("Failed to GET {key}: {e}");
            ABError::InternalServerError("service error".to_string())
        })?;

        match bytes {
            None => Ok(None),
            Some(b) => {
                let val = serde_json::from_slice::<T>(&b).map_err(|e| {
                    error!("Failed to decode cache {key}: {e}");
                    ABError::InternalServerError("service error".to_string())
                })?;
                Ok(Some(val))
            }
        }
    }

    /// SET with TTL (seconds), JSON-serializing the value.
    pub async fn set_ex<T: Serialize>(
        &self,
        key: &RedisKey,
        value: &T,
        ttl_secs: usize,
    ) -> Result<(), ABError> {
        let mut r = (*self.conn).clone();
        let key = key.0.clone();
        let payload = serde_json::to_vec(value).map_err(|e| {
            error!("Failed to encode cache {key}: {e}");
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
                ABError::InternalServerError("service error".to_string())
            })?;
        Ok(())
    }

    #[allow(unused)]
    pub async fn del(&self, key: &RedisKey) -> Result<(), ABError> {
        let mut r = (*self.conn).clone();
        let key = key.0.clone();
        let _: () = r.del(&key).await.map_err(|e| {
            error!("Failed to DEL {key}: {e}");
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
