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
    #[error("task {index} panicked during execution")]
    Panic { index: usize },
}

/// Serialize workspace mutations: Superposition rejects overlapping writes with 409.
/// On failure, roll back precisely the operations that already succeeded.
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
    let mut results = Vec::new();
    for (index, op) in operations.into_iter().enumerate() {
        let error = match std::panic::AssertUnwindSafe(op()).catch_unwind().await {
            Ok(Ok(value)) => {
                results.push(value);
                continue;
            }
            Ok(Err(source)) => TxnError::Operation { index, source },
            Err(_) => TxnError::Panic { index },
        };
        rollback((0..results.len()).collect()).await;
        return Err(error);
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    #[tokio::test]
    async fn workspace_writes_do_not_overlap_and_rollback_successes() {
        let active = Arc::new(AtomicUsize::new(0));
        let rolled = Arc::new(std::sync::Mutex::new(Vec::new()));
        let mut ops = Vec::new();
        for i in 0..3 {
            let active = active.clone();
            ops.push(op(move || async move {
                assert_eq!(active.fetch_add(1, Ordering::SeqCst), 0);
                tokio::task::yield_now().await;
                active.fetch_sub(1, Ordering::SeqCst);
                if i == 2 {
                    Err(std::io::Error::other("failure"))
                } else {
                    Ok(i)
                }
            }));
        }
        let copy = rolled.clone();
        assert!(run_fail_end(ops, move |indices| async move {
            *copy.lock().unwrap() = indices;
        })
        .await
        .is_err());
        assert_eq!(*rolled.lock().unwrap(), vec![0, 1]);
    }
}
