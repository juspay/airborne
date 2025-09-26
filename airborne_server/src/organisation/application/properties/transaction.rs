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

use futures::Future;
use std::{fmt::Debug, pin::Pin};
use thiserror::Error;
use tokio::task::{JoinError, JoinSet};

/// Boxed async operation returning Result<R, E>.
pub type Operation<R, E> =
    Box<dyn FnOnce() -> Pin<Box<dyn Future<Output = Result<R, E>> + Send>> + Send>;

/// Helper to box an operation ergonomically.
/// usage: op(|| async { /* ... */ -> Result<R, E> })
pub fn op<Fut, F, R, E>(f: F) -> Operation<R, E>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<R, E>> + Send + 'static,
{
    Box::new(|| Box::pin(f()))
}

#[derive(Debug, Error)]
pub enum TxnError<E: std::error::Error + Send + Sync + 'static> {
    #[error("operation {index} failed: {source}")]
    Operation {
        index: usize,
        #[source]
        source: E,
    },
    #[error("task {index} join error: {source}")]
    Join {
        index: usize,
        #[source]
        source: JoinError,
    },
}

/// Run all operations concurrently and wait for all to complete.
/// If any operation fails:
/// 1) wait for all operations to finish
/// 2) call `rollback` with all indices that completed successfully
/// 3) return the first failure encountered
///
/// If all succeed, returns results in the original order.
pub async fn run_fail_end<R, E, Rollback, RFut>(
    operations: Vec<Operation<R, E>>,
    rollback: Rollback,
) -> Result<Vec<R>, TxnError<E>>
where
    R: Send + 'static,
    E: std::error::Error + Send + Sync + 'static,
    Rollback: FnOnce(Vec<usize>) -> RFut + Send + 'static,
    RFut: Future<Output = ()> + Send + 'static,
{
    let n = operations.len();
    let mut set = JoinSet::new();

    // Track success indices and store results by original index.
    let mut successes: Vec<usize> = Vec::with_capacity(n);
    let mut results: Vec<Option<R>> = Vec::with_capacity(n);
    let mut first_error: Option<TxnError<E>> = None;

    for _ in 0..n {
        results.push(None);
    }

    // Spawn each operation as its own task, tagged with its index.
    for (i, op) in operations.into_iter().enumerate() {
        set.spawn(async move { (i, op().await) });
    }

    // Process completions as they finish; collect all results before deciding.
    while let Some(joined) = set.join_next().await {
        match joined {
            Ok((i, Ok(val))) => {
                results[i] = Some(val);
                successes.push(i);
            }
            Ok((i, Err(e))) => {
                // Store the first error but continue waiting for other operations
                if first_error.is_none() {
                    first_error = Some(TxnError::Operation {
                        index: i,
                        source: e,
                    });
                }
            }
            Err(join_err) => {
                // Store the first join error but continue waiting for other operations
                if first_error.is_none() {
                    first_error = Some(TxnError::Join {
                        index: usize::MAX, // unknown which one if task panicked before tagging
                        source: join_err,
                    });
                }
            }
        }
    }

    // If any operation failed, rollback all successful operations
    if let Some(err) = first_error {
        rollback(successes).await;
        return Err(err);
    }

    // All succeeded; unwrap in original order.
    Ok(results
        .into_iter()
        .map(|o| o.expect("logic error: missing result"))
        .collect())
}
