use std::{future::Future, sync::Arc};

use log::{error, info};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};

use crate::{
    types::ABError,
    utils::metrics::{CACHE_FAILS, CACHE_HITS, CACHE_KEY_LEVELS, CACHE_MISSES, INSTANCE_ID},
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
        let mut redis_key = self.key(organisation, application, parts);
        for level in redis_key.labels.iter_mut().skip(4) {
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

    /// Delete every key of an organisation (or of one of its applications). Used when an
    /// organisation's data is retired: the cached workspace name outlives the database
    /// row by up to a week and would send a recreated application of the same name to
    /// the previous tenant's workspace. Returns how many keys were removed.
    pub async fn purge_scope(
        &self,
        organisation: &str,
        application: Option<&str>,
    ) -> Result<usize, ABError> {
        fn glob_escape(s: &str) -> String {
            s.chars().fold(String::new(), |mut out, c| {
                if matches!(c, '*' | '?' | '[' | ']' | '\\') {
                    out.push('\\');
                }
                out.push(c);
                out
            })
        }
        let mut pattern = format!(
            "{}:{}:",
            glob_escape(&self.prefix),
            glob_escape(organisation)
        );
        if let Some(app) = application {
            pattern.push_str(&format!("{}:", glob_escape(app)));
        }
        pattern.push('*');
        let fail = |e: redis::RedisError| {
            error!("Failed to purge cache keys {pattern}: {e}");
            ABError::InternalServerError("service error".to_string())
        };
        let mut r = (*self.conn).clone();
        let (mut cursor, mut removed) = (0u64, 0usize);
        loop {
            let (next, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(500)
                .query_async(&mut r)
                .await
                .map_err(fail)?;
            if !keys.is_empty() {
                let n: usize = redis::cmd("DEL")
                    .arg(&keys)
                    .query_async(&mut r)
                    .await
                    .map_err(fail)?;
                removed += n;
            }
            if next == 0 {
                return Ok(removed);
            }
            cursor = next;
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    // Needs a Redis; keys live under a throwaway prefix.
    #[actix_web::test]
    #[ignore = "requires TEST_REDIS_URL"]
    async fn purge_scope_removes_one_organisation_or_application_only() {
        let url = std::env::var("TEST_REDIS_URL").expect("TEST_REDIS_URL");
        let prefix = format!("purge-test-{}", uuid::Uuid::new_v4().simple());
        let cache = RedisCache::new(redis::Client::open(url.as_str()).unwrap(), prefix)
            .await
            .unwrap();
        for (org, app, part) in [
            ("o1", "a1", "workspace_name"),
            ("o1", "a1", "package"),
            ("o1", "a2", "workspace_name"),
            ("o2", "a1", "workspace_name"),
            ("o10", "a1", "workspace_name"),
        ] {
            cache
                .set_ex(&cache.key(org, app, &[part]), &"value", 60)
                .await
                .unwrap();
        }
        let present = |org: &'static str, app: &'static str, part: &'static str| {
            let (cache, key) = (cache.clone(), cache.key(org, app, &[part]));
            async move { cache.get::<String>(&key).await.unwrap().is_some() }
        };
        assert_eq!(cache.purge_scope("o1", Some("a1")).await.unwrap(), 2);
        assert!(
            !present("o1", "a1", "workspace_name").await && !present("o1", "a1", "package").await
        );
        assert!(
            present("o1", "a2", "workspace_name").await,
            "another application of the organisation"
        );
        assert_eq!(cache.purge_scope("o1", None).await.unwrap(), 1);
        assert!(!present("o1", "a2", "workspace_name").await);
        assert!(
            present("o2", "a1", "workspace_name").await,
            "another organisation"
        );
        assert!(
            present("o10", "a1", "workspace_name").await,
            "an organisation whose name starts with the same text"
        );
        assert_eq!(cache.purge_scope("nobody", None).await.unwrap(), 0);
        cache.purge_scope("o2", None).await.unwrap();
        cache.purge_scope("o10", None).await.unwrap();
    }
}
