// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! PostgreSQL Advisory Lock utilities for distributed coordination.
//!
//! Advisory locks are application-level locks that don't block normal database operations.
//! They are useful for coordinating between multiple application instances (e.g., pods)
//! to ensure only one instance performs a particular operation at a time.

use diesel::{sql_query, sql_types::BigInt, QueryableByName, RunQueryDsl};
use xxhash_rust::xxh64::xxh64;

use crate::{run_blocking, types::ABError, utils::db::DbPool};

/// Result of attempting to acquire an advisory lock
#[derive(QueryableByName, Debug)]
struct LockResult {
    #[diesel(sql_type = diesel::sql_types::Bool)]
    acquired: bool,
}

/// Namespace for different types of advisory locks to avoid ID collisions.
/// Each namespace uses a different high-order bits pattern.
#[derive(Debug, Clone, Copy)]
pub enum LockNamespace {
    /// Locks for superposition migration operations
    SuperpositionMigration = 1,
}

impl LockNamespace {
    /// Convert namespace to a base lock ID with high-order bits set
    fn base_id(self) -> i64 {
        (self as i64) << 32
    }
}

/// Computes a stable hash for a string to use as part of the lock ID.
/// Uses xxHash (xxh64) for fast and high-quality hashing.
fn hash_string(s: &str) -> i64 {
    const SEED: u64 = 0;
    let hash = xxh64(s.as_bytes(), SEED);
    // Use lower 32 bits to combine with namespace
    (hash & 0xFFFFFFFF) as i64
}

/// Generates a unique lock ID for a given namespace and key.
pub fn generate_lock_id(namespace: LockNamespace, key: &str) -> i64 {
    namespace.base_id() | hash_string(key)
}

/// A guard that automatically releases an advisory lock when dropped.
/// This ensures locks are always released, even if an error occurs.
pub struct AdvisoryLockGuard {
    lock_id: i64,
    db_pool: DbPool,
    released: bool,
}

impl AdvisoryLockGuard {
    fn new(lock_id: i64, db_pool: DbPool) -> Self {
        Self {
            lock_id,
            db_pool,
            released: false,
        }
    }

    /// Explicitly release the lock. This is called automatically on drop,
    /// but can be called manually if needed.
    pub async fn release(mut self) -> Result<(), ABError> {
        self.release_internal().await
    }

    async fn release_internal(&mut self) -> Result<(), ABError> {
        if self.released {
            return Ok(());
        }

        let pool = self.db_pool.clone();
        let lock_id = self.lock_id;

        run_blocking!({
            let mut conn = pool.get()?;
            sql_query("SELECT pg_advisory_unlock($1)")
                .bind::<BigInt, _>(lock_id)
                .execute(&mut conn)?;
            Ok(())
        })?;

        self.released = true;
        log::debug!("Released advisory lock with ID: {}", self.lock_id);
        Ok(())
    }
}

impl Drop for AdvisoryLockGuard {
    fn drop(&mut self) {
        if !self.released {
            // We can't do async in drop, so we need to use a blocking approach
            // This is a best-effort cleanup
            if let Ok(mut conn) = self.db_pool.get() {
                let _ = sql_query("SELECT pg_advisory_unlock($1)")
                    .bind::<BigInt, _>(self.lock_id)
                    .execute(&mut conn);
                log::debug!(
                    "Released advisory lock with ID: {} (via drop)",
                    self.lock_id
                );
            } else {
                log::warn!(
                    "Failed to release advisory lock with ID: {} (could not get connection)",
                    self.lock_id
                );
            }
        }
    }
}

/// Attempts to acquire an advisory lock without blocking.
///
/// Returns `Some(AdvisoryLockGuard)` if the lock was acquired, `None` if another
/// process holds the lock. The lock is automatically released when the guard is dropped.
///
/// # Arguments
/// * `db_pool` - Database connection pool
/// * `namespace` - Lock namespace to avoid ID collisions
/// * `key` - Unique key within the namespace (e.g., workspace name)
///
/// # Example
/// ```ignore
/// if let Some(guard) = try_acquire_lock(&pool, LockNamespace::SuperpositionMigration, "workspace1").await? {
///     // Do work while holding the lock
///     // Lock is automatically released when guard goes out of scope
/// } else {
///     // Another process holds the lock
/// }
/// ```
pub async fn try_acquire_lock(
    db_pool: &DbPool,
    namespace: LockNamespace,
    key: &str,
) -> Result<Option<AdvisoryLockGuard>, ABError> {
    let lock_id = generate_lock_id(namespace, key);
    let pool = db_pool.clone();

    let result: LockResult = run_blocking!({
        let mut conn = pool.get()?;
        Ok(sql_query("SELECT pg_try_advisory_lock($1) as acquired")
            .bind::<BigInt, _>(lock_id)
            .get_result(&mut conn)?)
    })?;

    if result.acquired {
        log::debug!(
            "Acquired advisory lock for namespace {:?}, key '{}' (ID: {})",
            namespace,
            key,
            lock_id
        );
        Ok(Some(AdvisoryLockGuard::new(lock_id, db_pool.clone())))
    } else {
        log::debug!(
            "Failed to acquire advisory lock for namespace {:?}, key '{}' (ID: {}) - already held",
            namespace,
            key,
            lock_id
        );
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_lock_id_deterministic() {
        let id1 = generate_lock_id(LockNamespace::SuperpositionMigration, "workspace1");
        let id2 = generate_lock_id(LockNamespace::SuperpositionMigration, "workspace1");
        assert_eq!(id1, id2);
    }

    #[test]
    fn test_generate_lock_id_different_keys() {
        let id1 = generate_lock_id(LockNamespace::SuperpositionMigration, "workspace1");
        let id2 = generate_lock_id(LockNamespace::SuperpositionMigration, "workspace2");
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_hash_string_distribution() {
        // Verify different strings produce different hashes
        let hash1 = hash_string("test1");
        let hash2 = hash_string("test2");
        let hash3 = hash_string("completely_different");

        assert_ne!(hash1, hash2);
        assert_ne!(hash1, hash3);
        assert_ne!(hash2, hash3);
    }
}
