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

use futures::{Future, FutureExt};
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
    #[error("task {index} panicked during execution")]
    Panic { index: usize },
    #[error("internal error: missing result for operation {index}")]
    MissingResult { index: usize },
}

/// Run N-1 operations concurrently, then run the last operation after they complete.
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

    if n == 0 {
        return Ok(Vec::new());
    }
    if n == 1 {
        if let Some(op) = operations.into_iter().next() {
            match op().await {
                Ok(result) => return Ok(vec![result]),
                Err(e) => {
                    rollback(vec![]).await;
                    return Err(TxnError::Operation {
                        index: 0,
                        source: e,
                    });
                }
            }
        } else {
            return Ok(Vec::new());
        }
    }

    // Split operations: first N-1 and the last one
    let mut operations = operations;
    let last_operation = match operations.pop() {
        Some(op) => op,
        None => {
            return Ok(Vec::new());
        }
    };
    let last_index = n - 1;

    let mut set = JoinSet::new();
    let mut successes: Vec<usize> = Vec::with_capacity(n);
    let mut results: Vec<Option<R>> = Vec::with_capacity(n);
    let mut first_error: Option<TxnError<E>> = None;

    for _ in 0..n {
        results.push(None);
    }

    // Phase 1: Run first N-1 operations in parallel
    for (i, op) in operations.into_iter().enumerate() {
        set.spawn(async move {
            let result = std::panic::AssertUnwindSafe(op()).catch_unwind().await;

            match result {
                Ok(operation_result) => (i, Ok(operation_result)),
                Err(_panic_payload) => (i, Err(())),
            }
        });
    }

    // Wait for all N-1 operations to complete
    while let Some(joined) = set.join_next().await {
        match joined {
            Ok((i, Ok(Ok(val)))) => {
                results[i] = Some(val);
                successes.push(i);
            }
            Ok((i, Ok(Err(e)))) => {
                if first_error.is_none() {
                    first_error = Some(TxnError::Operation {
                        index: i,
                        source: e,
                    });
                }
            }
            Ok((i, Err(()))) => {
                if first_error.is_none() {
                    first_error = Some(TxnError::Panic { index: i });
                }
            }
            Err(join_err) => {
                if first_error.is_none() {
                    first_error = Some(TxnError::Join {
                        index: usize::MAX,
                        source: join_err,
                    });
                }
            }
        }
    }

    if let Some(err) = first_error {
        rollback(successes).await;
        return Err(err);
    }

    // Phase 2: All N-1 operations succeeded, now run the last operation
    match last_operation().await {
        Ok(last_result) => {
            results[last_index] = Some(last_result);
            successes.push(last_index);

            // All succeeded
            let mut final_results = Vec::with_capacity(n);
            for (i, result_opt) in results.into_iter().enumerate() {
                match result_opt {
                    Some(result) => final_results.push(result),
                    None => {
                        rollback(successes).await;
                        return Err(TxnError::MissingResult { index: i });
                    }
                }
            }
            Ok(final_results)
        }
        Err(e) => {
            // Last operation failed, rollback all successful operations
            rollback(successes).await;
            Err(TxnError::Operation {
                index: last_index,
                source: e,
            })
        }
    }
}
