use dashmap::DashMap;
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::OnceCell;

use open_feature::{provider::FeatureProvider, EvaluationContext};
use superposition_provider::{SuperpositionAPIProvider, SuperpositionOptions};

type WorkspaceId = String;

pub struct WorkspaceHandle {
    pub provider: Arc<SuperpositionAPIProvider>,
    last_access: Mutex<Instant>,
}

impl WorkspaceHandle {
    fn touch(&self) {
        if let Ok(mut t) = self.last_access.lock() {
            *t = Instant::now();
        } else {
            log::warn!("last_access mutex poisoned; skipping touch");
        }
    }
}

pub struct ProviderRegistry {
    organisation_id: String,
    api_token: String,
    endpoint: String,
    inner: DashMap<WorkspaceId, Arc<OnceCell<Arc<WorkspaceHandle>>>>,
}

impl ProviderRegistry {
    pub fn new(organisation_id: String, api_token: String, endpoint: String) -> Self {
        Self {
            organisation_id,
            api_token,
            endpoint,
            inner: DashMap::new(),
        }
    }

    pub async fn get_or_init(&self, ws: &str) -> Arc<WorkspaceHandle> {
        let cell = self
            .inner
            .entry(ws.to_string())
            .or_insert_with(|| Arc::new(OnceCell::new()))
            .clone();

        let ws_owned = ws.to_string();
        let handle = cell
            .get_or_init(|| async move {
                let options = SuperpositionOptions::new(
                    self.endpoint.clone(),
                    self.api_token.clone(),
                    self.organisation_id.clone(),
                    ws_owned,
                );

                // The remote provider resolves config against the Superposition API on
                // every call, so it holds only a lightweight SDK client and performs no
                // network I/O here. `initialize` simply marks the provider Ready; the
                // per-request evaluation context is supplied at resolve time.
                let mut provider = SuperpositionAPIProvider::new(options);
                provider.initialize(&EvaluationContext::default()).await;

                Arc::new(WorkspaceHandle {
                    provider: Arc::new(provider),
                    last_access: Mutex::new(Instant::now()),
                })
            })
            .await
            .clone();

        handle.touch();
        handle
    }

    pub async fn run_ttl_eviction(self: Arc<Self>, ttl: Duration, tick: Duration) {
        let mut interval = tokio::time::interval(tick);
        loop {
            interval.tick().await;
            let now = Instant::now();
            let mut to_remove = Vec::new();

            for r in self.inner.iter() {
                if let Some(h) = r.value().get() {
                    match h.last_access.lock() {
                        Ok(last) => {
                            if now.duration_since(*last) > ttl {
                                to_remove.push(r.key().clone());
                            }
                        }
                        Err(_) => {
                            // Mutex poisoned, evict this workspace
                            log::warn!("last_access mutex poisoned for workspace, evicting");
                            to_remove.push(r.key().clone());
                        }
                    }
                }
            }

            for k in to_remove {
                self.inner.remove(&k);
            }
        }
    }
}
