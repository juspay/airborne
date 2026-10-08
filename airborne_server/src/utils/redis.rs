use std::{future::Future, sync::Arc};

use log::{error, info};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};

use crate::{
    types::ABError,
    utils::metrics::{CACHE_FAILS, CACHE_HITS, CACHE_KEY_LEVELS, CACHE_MISSES, INSTANCE_ID},
};

/// Maximum number of keys sent in a single MGET by [`RedisCache::mget`].
const MGET_CHUNK_SIZE: usize = 500;

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

        let mut labels = Vec::with_capacity(4 + CACHE_KEY_LEVELS);
        labels.push(INSTANCE_ID.clone());
        labels.push(self.prefix.clone());
        labels.push(organisation.to_string());
        labels.push(application.to_string());

        // Fill up to CACHE_KEY_LEVELS levels, pad with "none"
        for i in 0..CACHE_KEY_LEVELS {
            if let Some(p) = parts.get(i) {
                labels.push((*p).to_string());
            } else {
                labels.push("none".to_string());
            }
        }

        RedisKey { key: k, labels }
    }

    /// Like [`key`](Self::key), but records **constant** metric labels: the
    /// key-hierarchy levels are reported as `"none"` instead of the actual
    /// `parts`.
    ///
    /// Use this when a `parts` value is high-cardinality or secret (e.g. an
    /// OAuth state). The value still goes into the Redis key so lookups work,
    /// but it never becomes a metric label value — avoiding a cardinality
    /// explosion and keeping secrets out of the metrics backend. Note the value
    /// can still appear in the key string that is logged, so callers should
    /// pass a non-secret token (e.g. a hash) rather than the raw secret.
    pub fn key_unlabeled(&self, organisation: &str, application: &str, parts: &[&str]) -> RedisKey {
        self.key_with_labeled_levels(organisation, application, parts, 0)
    }

    /// Like [`key`](Self::key), but only the first `labeled_levels` of `parts`
    /// are recorded as metric labels; deeper levels are reported as `"none"`.
    ///
    /// Use this when the leading parts are a low-cardinality namespace (e.g.
    /// `"file_entry"`) but a later part is high-cardinality (e.g. a file key),
    /// so metrics stay grouped by namespace without one series per value.
    pub fn key_with_labeled_levels(
        &self,
        organisation: &str,
        application: &str,
        parts: &[&str],
        labeled_levels: usize,
    ) -> RedisKey {
        let mut redis_key = self.key(organisation, application, parts);
        for level in redis_key.labels.iter_mut().skip(4 + labeled_levels) {
            *level = "none".to_string();
        }
        redis_key
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

    /// GET many keys in one round trip and JSON-deserialize each into T.
    ///
    /// Returns one entry per key, in the same order as `keys`. `None` means a
    /// miss, or a cached value that failed to decode (treated as a miss). Keys
    /// are sent as MGETs of at most [`MGET_CHUNK_SIZE`] keys, all in a single
    /// pipeline, so no one command holds the Redis event loop for long.
    pub async fn mget<T: DeserializeOwned>(
        &self,
        keys: &[RedisKey],
    ) -> Result<Vec<Option<T>>, ABError> {
        if keys.is_empty() {
            return Ok(Vec::new());
        }

        let mut r = (*self.conn).clone();
        let mut pipe = redis::pipe();
        for chunk in keys.chunks(MGET_CHUNK_SIZE) {
            pipe.cmd("MGET");
            for redis_key in chunk {
                pipe.arg(&redis_key.key);
            }
        }

        let replies: Vec<Vec<Option<Vec<u8>>>> = pipe.query_async(&mut r).await.map_err(|e| {
            error!("Failed to MGET {} keys: {e}", keys.len());
            for redis_key in keys {
                CACHE_FAILS.with_label_values(&redis_key.labels).inc();
            }
            ABError::InternalServerError("service error".to_string())
        })?;

        decode_mget_replies(keys, replies)
    }

    /// Atomically GET and DELETE (Redis `GETDEL`), JSON-deserializing into T.
    /// Returns `Ok(None)` if the key was absent.
    pub async fn get_del<T: DeserializeOwned>(
        &self,
        redis_key: &RedisKey,
    ) -> Result<Option<T>, ABError> {
        let mut r = (*self.conn).clone();
        let key = redis_key.key.clone();
        let bytes: Option<Vec<u8>> = r.get_del(&key).await.map_err(|e| {
            error!("Failed to GETDEL {key}: {e}");
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

    /// SET with TTL (seconds) for many keys in one round trip (pipelined),
    /// JSON-serializing each value. A value that fails to encode is skipped
    /// and the rest are still written.
    pub async fn set_ex_many<T: Serialize>(
        &self,
        entries: &[(RedisKey, &T)],
        ttl_secs: usize,
    ) -> Result<(), ABError> {
        let mut pipe = redis::pipe();
        let mut queued: Vec<&RedisKey> = Vec::with_capacity(entries.len());
        for (redis_key, value) in entries {
            match serde_json::to_vec(value) {
                Ok(payload) => {
                    pipe.cmd("SET")
                        .arg(&redis_key.key)
                        .arg(payload)
                        .arg("EX")
                        .arg(ttl_secs)
                        .ignore();
                    queued.push(redis_key);
                }
                Err(e) => {
                    error!("Failed to encode cache {}: {e}", redis_key.key);
                    CACHE_FAILS.with_label_values(&redis_key.labels).inc();
                }
            }
        }

        if queued.is_empty() {
            return Ok(());
        }

        let mut r = (*self.conn).clone();
        let _: () = pipe.query_async(&mut r).await.map_err(|e| {
            error!("Failed to SET {} keys: {e}", queued.len());
            for redis_key in &queued {
                CACHE_FAILS.with_label_values(&redis_key.labels).inc();
            }
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

/// Flatten the per-chunk MGET replies into one value per key, in key order,
/// decoding each and recording hit/miss/fail metrics. A nil or undecodable
/// value becomes `None`. A reply whose length doesn't match `keys` is an
/// error, since pairing it with the keys would mislabel values.
fn decode_mget_replies<T: DeserializeOwned>(
    keys: &[RedisKey],
    replies: Vec<Vec<Option<Vec<u8>>>>,
) -> Result<Vec<Option<T>>, ABError> {
    let values: Vec<Option<Vec<u8>>> = replies.into_iter().flatten().collect();
    if values.len() != keys.len() {
        error!(
            "MGET returned {} values for {} keys",
            values.len(),
            keys.len()
        );
        for redis_key in keys {
            CACHE_FAILS.with_label_values(&redis_key.labels).inc();
        }
        return Err(ABError::InternalServerError("service error".to_string()));
    }

    Ok(keys
        .iter()
        .zip(values)
        .map(|(redis_key, bytes)| match bytes {
            None => {
                CACHE_MISSES.with_label_values(&redis_key.labels).inc();
                None
            }
            Some(b) => match serde_json::from_slice::<T>(&b) {
                Ok(val) => {
                    CACHE_HITS.with_label_values(&redis_key.labels).inc();
                    Some(val)
                }
                Err(e) => {
                    error!("Failed to decode cache {}: {e}", redis_key.key);
                    CACHE_FAILS.with_label_values(&redis_key.labels).inc();
                    None
                }
            },
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key(name: &str) -> RedisKey {
        RedisKey {
            key: name.to_string(),
            labels: vec!["test".to_string(); 4 + CACHE_KEY_LEVELS],
        }
    }

    fn json(value: &str) -> Option<Vec<u8>> {
        Some(serde_json::to_vec(value).unwrap())
    }

    #[test]
    fn test_decode_mget_replies_preserves_key_order_across_chunks() {
        let keys = vec![test_key("a"), test_key("b"), test_key("c"), test_key("d")];
        let replies = vec![vec![json("A"), None], vec![json("C"), json("D")]];

        let values = decode_mget_replies::<String>(&keys, replies).unwrap();

        assert_eq!(
            values,
            vec![
                Some("A".to_string()),
                None,
                Some("C".to_string()),
                Some("D".to_string())
            ]
        );
    }

    #[test]
    fn test_decode_mget_replies_treats_undecodable_value_as_miss() {
        let keys = vec![test_key("a"), test_key("b")];
        let replies = vec![vec![Some(b"not json".to_vec()), json("B")]];

        let values = decode_mget_replies::<String>(&keys, replies).unwrap();

        assert_eq!(values, vec![None, Some("B".to_string())]);
    }

    #[test]
    fn test_decode_mget_replies_rejects_length_mismatch() {
        let keys = vec![test_key("a"), test_key("b")];
        let replies = vec![vec![json("A")]];

        assert!(decode_mget_replies::<String>(&keys, replies).is_err());
    }
}
