use std::{
    future::Future,
    sync::{Arc, LazyLock},
};

use log::{error, info};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use redis::Script;
use serde::{de::DeserializeOwned, Serialize};

use crate::{
    types::ABError,
    utils::metrics::{CACHE_FAILS, CACHE_HITS, CACHE_KEY_LEVELS, CACHE_MISSES, INSTANCE_ID},
};

/// Add a member to an index SET and (re)arm the SET's TTL in one step.
///
/// `KEYS[1]` index key, `ARGV[1]` member key, `ARGV[2]` TTL in seconds.
static INDEX_ADD: LazyLock<Script> = LazyLock::new(|| {
    Script::new(
        r"redis.call('SADD', KEYS[1], ARGV[1])
          redis.call('EXPIRE', KEYS[1], ARGV[2])",
    )
});

/// Delete every member an index SET names, then the index, in one step.
///
/// Members go out in batches: one variadic `DEL` over a large index would
/// overflow Lua's stack.
///
/// `KEYS[1]` index key.
static INDEX_DROP: LazyLock<Script> = LazyLock::new(|| {
    Script::new(
        r"local members = redis.call('SMEMBERS', KEYS[1])
          for i = 1, #members, 500 do
              redis.call('DEL', unpack(members, i, math.min(i + 499, #members)))
          end
          redis.call('DEL', KEYS[1])",
    )
});

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

    /// Record `member` in the SET at `index`, so a family of cache entries can be
    /// dropped together later. The SET is given the same TTL as its members, so a
    /// forgotten index cannot outlive them.
    ///
    /// One script, so the SET can never be left without its TTL: a SADD whose
    /// EXPIRE failed would leave an index that outlives every member it names.
    pub async fn index_add(
        &self,
        index: &RedisKey,
        member: &RedisKey,
        ttl_secs: usize,
    ) -> Result<(), ABError> {
        let mut r = (*self.conn).clone();
        let (index_key, member_key) = (index.key.clone(), member.key.clone());

        let _: () = INDEX_ADD
            .key(&index_key)
            .arg(&member_key)
            .arg(ttl_secs as i64)
            .invoke_async(&mut r)
            .await
            .map_err(|e| {
                error!("Failed to index {member_key} under {index_key}: {e}");
                CACHE_FAILS.with_label_values(&index.labels).inc();
                ABError::InternalServerError("service error".to_string())
            })?;

        Ok(())
    }

    /// Delete every key recorded in the SET at `index`, then the index itself.
    ///
    /// One script, so no `index_add` can slip between the read and the deletes:
    /// a member added in that window would survive with its index gone, and go on
    /// being served as a cache hit that nothing can invalidate.
    pub async fn index_drop(&self, index: &RedisKey) -> Result<(), ABError> {
        let mut r = (*self.conn).clone();
        let index_key = index.key.clone();

        let _: () = INDEX_DROP
            .key(&index_key)
            .invoke_async(&mut r)
            .await
            .map_err(|e| {
                error!("Failed to drop index {index_key}: {e}");
                CACHE_FAILS.with_label_values(&index.labels).inc();
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
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;

    const TEST_REDIS_URL: &str = "redis://127.0.0.1:6379";
    /// Short enough that anything a failing test leaves behind expires on its own.
    const TTL: usize = 60;

    /// A cache under a prefix unique to this process, so tests can run against a
    /// developer's local Redis without touching anything else in it. Returns
    /// `None` when no Redis is reachable — `cargo test` has to stay green on a
    /// machine that isn't running one.
    async fn test_cache(name: &str) -> Option<RedisCache> {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let client = redis::Client::open(TEST_REDIS_URL).ok()?;
        match RedisCache::new(client, format!("airborne-test:{name}:{nanos}")).await {
            Ok(cache) => Some(cache),
            Err(_) => {
                eprintln!("skipping {name}: no Redis at {TEST_REDIS_URL}");
                None
            }
        }
    }

    async fn raw_conn() -> redis::aio::MultiplexedConnection {
        redis::Client::open(TEST_REDIS_URL)
            .expect("client")
            .get_multiplexed_async_connection()
            .await
            .expect("connect")
    }

    #[tokio::test]
    async fn index_add_records_the_member_and_arms_the_index_ttl() {
        let Some(cache) = test_cache("index-add").await else {
            return;
        };
        let index = cache.key("org", "app", &["sig_index"]);
        let member = cache.key("org", "app", &["sig", "v1"]);

        cache.index_add(&index, &member, TTL).await.expect("add");

        let mut raw = raw_conn().await;
        let members: Vec<String> = raw.smembers(&index.key).await.expect("smembers");
        assert_eq!(members, vec![member.key.clone()]);

        // The SADD and the EXPIRE are one script precisely so this can never be -1.
        let ttl: i64 = raw.ttl(&index.key).await.expect("ttl");
        assert!(ttl > 0 && ttl <= TTL as i64, "index TTL was {ttl}");

        cache.index_drop(&index).await.expect("cleanup");
    }

    #[tokio::test]
    async fn index_drop_removes_every_member_and_the_index() {
        let Some(cache) = test_cache("index-drop").await else {
            return;
        };
        let index = cache.key("org", "app", &["sig_index"]);
        let members: Vec<RedisKey> = (0..5)
            .map(|i| cache.key("org", "app", &["sig", &i.to_string()]))
            .collect();

        for member in &members {
            cache.set_ex(member, &"signature", TTL).await.expect("set");
            cache.index_add(&index, member, TTL).await.expect("add");
        }

        cache.index_drop(&index).await.expect("drop");

        let mut raw = raw_conn().await;
        for member in &members {
            let exists: bool = raw.exists(&member.key).await.expect("exists");
            assert!(!exists, "{} survived the drop", member.key);
        }
        let index_exists: bool = raw.exists(&index.key).await.expect("exists");
        assert!(!index_exists, "the index itself survived the drop");
    }

    #[tokio::test]
    async fn index_drop_deletes_more_members_than_one_variadic_del_can_take() {
        let Some(cache) = test_cache("index-drop-batched").await else {
            return;
        };
        // Over the script's 500-per-DEL batch size, so the loop runs more than
        // once. A single `DEL unpack(members)` would risk the Lua stack here.
        const COUNT: usize = 1_200;

        let index = cache.key("org", "app", &["sig_index"]);
        let members: Vec<RedisKey> = (0..COUNT)
            .map(|i| cache.key("org", "app", &["sig", &i.to_string()]))
            .collect();

        for member in &members {
            cache.set_ex(member, &"signature", TTL).await.expect("set");
            cache.index_add(&index, member, TTL).await.expect("add");
        }

        let mut raw = raw_conn().await;
        let before: usize = raw.scard(&index.key).await.expect("scard");
        assert_eq!(before, COUNT);

        cache.index_drop(&index).await.expect("drop");

        for member in [&members[0], &members[COUNT / 2], &members[COUNT - 1]] {
            let exists: bool = raw.exists(&member.key).await.expect("exists");
            assert!(!exists, "{} survived the batched drop", member.key);
        }
        let index_exists: bool = raw.exists(&index.key).await.expect("exists");
        assert!(!index_exists);
    }

    #[tokio::test]
    async fn index_drop_on_a_missing_index_succeeds() {
        let Some(cache) = test_cache("index-drop-missing").await else {
            return;
        };
        // The empty-set path: `for i = 1, 0` must not run, and DEL of a
        // non-existent key is fine. Invalidation is best-effort and runs on keys
        // that may never have been cached, so this is the common case.
        let index = cache.key("org", "app", &["never_written"]);
        cache.index_drop(&index).await.expect("drop");
    }
}
