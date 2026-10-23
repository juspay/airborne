use std::{any::Any, future::Future, sync::Arc, time::Duration};

use ::moka::future::Cache;

use crate::types::ABError;

const DEFAULT_CAPACITY: u64 = 1_024;
const DEFAULT_TTL: Duration = Duration::from_secs(60 * 60);
const DEFAULT_TTI: Duration = Duration::from_secs(15 * 60);

type CacheValue = Arc<dyn Any + Send + Sync>;

#[derive(Clone, Eq, Hash, PartialEq)]
pub struct MokaKey {
    key: String,
}

#[derive(Clone)]
pub struct MokaCache {
    values: Cache<MokaKey, CacheValue>,
    prefix: String,
}

impl MokaCache {
    pub fn new(prefix: impl Into<String>) -> Self {
        Self::with_policy(prefix, DEFAULT_CAPACITY, DEFAULT_TTL, DEFAULT_TTI)
    }

    pub fn with_policy(
        prefix: impl Into<String>,
        max_capacity: u64,
        ttl: Duration,
        tti: Duration,
    ) -> Self {
        Self {
            values: Cache::builder()
                .max_capacity(max_capacity)
                .time_to_live(ttl)
                .time_to_idle(tti)
                .build(),
            prefix: prefix.into(),
        }
    }

    pub fn key(&self, organisation: &str, application: &str, parts: &[&str]) -> MokaKey {
        let mut key = String::with_capacity(
            self.prefix.len()
                + 1
                + organisation.len()
                + 1
                + application.len()
                + parts.iter().map(|part| part.len() + 1).sum::<usize>(),
        );
        key.push_str(&self.prefix);
        key.push(':');
        key.push_str(organisation);
        key.push(':');
        key.push_str(application);
        for part in parts {
            key.push(':');
            key.push_str(part);
        }

        MokaKey { key }
    }

    #[allow(dead_code)]
    pub async fn get<T>(&self, key: &MokaKey) -> Result<Option<Arc<T>>, ABError>
    where
        T: Send + Sync + 'static,
    {
        self.values
            .get(key)
            .await
            .map(Self::downcast::<T>)
            .transpose()
    }

    #[allow(dead_code)]
    pub async fn set<T>(&self, key: &MokaKey, value: T)
    where
        T: Send + Sync + 'static,
    {
        let value: CacheValue = Arc::new(value);
        self.values.insert(key.clone(), value).await;
    }

    pub async fn del(&self, key: &MokaKey) {
        self.values.invalidate(key).await;
    }

    pub async fn get_or_try_set<T, F, Fut>(
        &self,
        key: &MokaKey,
        fetch_fn: F,
    ) -> Result<Arc<T>, ABError>
    where
        T: Send + Sync + 'static,
        F: FnOnce() -> Fut + Send,
        Fut: Future<Output = Result<T, ABError>> + Send,
    {
        let value = self
            .values
            .try_get_with(key.clone(), async move {
                let value = fetch_fn().await.map_err(|error| error.to_string())?;
                Ok::<CacheValue, String>(Arc::new(value))
            })
            .await
            .map_err(|error| ABError::InternalServerError(error.as_ref().clone()))?;

        Self::downcast(value)
    }

    fn downcast<T>(value: CacheValue) -> Result<Arc<T>, ABError>
    where
        T: Send + Sync + 'static,
    {
        value.downcast::<T>().map_err(|_| {
            ABError::InternalServerError(format!(
                "Moka cache value type mismatch for {}",
                std::any::type_name::<T>()
            ))
        })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;

    #[tokio::test]
    async fn stores_multiple_value_types_under_namespaced_keys() {
        let cache = MokaCache::new("airborne");
        let string_key = cache.key("org", "app", &["string"]);
        let number_key = cache.key("org", "app", &["number"]);

        cache.set(&string_key, "value".to_string()).await;
        cache.set(&number_key, 42_u64).await;

        assert_eq!(
            cache
                .get::<String>(&string_key)
                .await
                .expect("string lookup")
                .expect("string value")
                .as_str(),
            "value"
        );
        assert_eq!(
            *cache
                .get::<u64>(&number_key)
                .await
                .expect("number lookup")
                .expect("number value"),
            42
        );
    }

    #[tokio::test]
    async fn coalesces_concurrent_initializers() {
        let cache = MokaCache::new("airborne");
        let key = cache.key("org", "app", &["coalesced"]);
        let initializations = Arc::new(AtomicUsize::new(0));

        let first_count = initializations.clone();
        let first = cache.get_or_try_set::<String, _, _>(&key, || async move {
            first_count.fetch_add(1, Ordering::SeqCst);
            tokio::time::sleep(Duration::from_millis(10)).await;
            Ok("first".to_string())
        });

        let second_count = initializations.clone();
        let second = cache.get_or_try_set::<String, _, _>(&key, || async move {
            second_count.fetch_add(1, Ordering::SeqCst);
            Ok("second".to_string())
        });

        let (first, second) = tokio::join!(first, second);
        assert_eq!(first.expect("first value").as_str(), "first");
        assert_eq!(second.expect("second value").as_str(), "first");
        assert_eq!(initializations.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn delete_removes_an_entry() {
        let cache = MokaCache::new("airborne");
        let key = cache.key("org", "app", &["deletable"]);

        cache.set(&key, "first".to_string()).await;
        cache.del(&key).await;

        let value = cache
            .get_or_try_set::<String, _, _>(&key, || async { Ok("second".to_string()) })
            .await
            .expect("reloaded value");
        assert_eq!(value.as_str(), "second");
    }
}
