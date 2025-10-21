use dashmap::DashMap;
use futures::TryFutureExt;
use std::{
    fmt,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::OnceCell;

use open_feature::{
    provider::FeatureProvider, EvaluationContext, EvaluationResult, OpenFeature, StructValue,
};
use superposition_provider::{
    PollingStrategy, ProviderMetadata, RefreshStrategy, ResolutionDetails, SuperpositionProvider,
    SuperpositionProviderOptions,
};

type WorkspaceId = String;

#[derive(Debug)]
pub enum RegistryError {
    ProviderInitFailed(String),
}

impl fmt::Display for RegistryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RegistryError::ProviderInitFailed(e) => write!(f, "Provider init failed: {}", e),
        }
    }
}

type Result<T> = std::result::Result<T, RegistryError>;

pub struct WorkspaceHandle {
    pub provider: Arc<SuperpositionProvider>,
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

    pub async fn get_or_init(&self, ws: &str) -> Result<Arc<WorkspaceHandle>> {
        let cell = self
            .inner
            .entry(ws.to_string())
            .or_insert_with(|| Arc::new(OnceCell::new()))
            .clone();

        let ws_owned = ws.to_string();
        let handle = cell
            .get_or_try_init(|| async move {
                let mut of = OpenFeature::singleton_mut().await;

                let options = SuperpositionProviderOptions {
                    endpoint: self.endpoint.clone(),
                    token: self.api_token.clone(),
                    org_id: self.organisation_id.clone(),
                    workspace_id: ws_owned.clone(),
                    fallback_config: None,
                    evaluation_cache: None,
                    refresh_strategy: RefreshStrategy::Polling(PollingStrategy {
                        interval: 60,
                        timeout: Some(30),
                    }),
                    experimentation_options: None,
                };

                let provider = SuperpositionProvider::new(options);
                provider
                    .init()
                    .await
                    .map_err(|e| format!("Provider init error: {:?}", e))?;

                let provider_arc = Arc::new(provider);
                let provider_wrapper = ProviderWrapper(provider_arc.clone());
                of.set_named_provider(&ws_owned.clone(), provider_wrapper)
                    .await;

                Ok(Arc::new(WorkspaceHandle {
                    provider: provider_arc.clone(),
                    last_access: Mutex::new(Instant::now()),
                }))
            })
            .map_err(RegistryError::ProviderInitFailed)
            .await?
            .clone();

        handle.touch();
        Ok(handle)
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
                let mut api = OpenFeature::singleton_mut().await;
                api.set_named_provider(&k, open_feature::provider::NoOpProvider::default())
                    .await;
                self.inner.remove(&k);
            }
        }
    }
}

// Need this to share a single provider using Arc across airborne and open feature
struct ProviderWrapper(Arc<SuperpositionProvider>);

impl FeatureProvider for ProviderWrapper {
    fn metadata(&self) -> &ProviderMetadata {
        self.0.metadata()
    }

    #[allow(
        mismatched_lifetime_syntaxes,
        clippy::type_complexity,
        clippy::type_repetition_in_bounds
    )]
    fn resolve_bool_value<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        flag_key: &'life1 str,
        evaluation_context: &'life2 EvaluationContext,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = EvaluationResult<ResolutionDetails<bool>>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        self.0.resolve_bool_value(flag_key, evaluation_context)
    }

    #[allow(
        mismatched_lifetime_syntaxes,
        clippy::type_complexity,
        clippy::type_repetition_in_bounds
    )]
    fn resolve_int_value<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        flag_key: &'life1 str,
        evaluation_context: &'life2 EvaluationContext,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = EvaluationResult<ResolutionDetails<i64>>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        self.0.resolve_int_value(flag_key, evaluation_context)
    }

    #[allow(
        mismatched_lifetime_syntaxes,
        clippy::type_complexity,
        clippy::type_repetition_in_bounds
    )]
    fn resolve_float_value<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        flag_key: &'life1 str,
        evaluation_context: &'life2 EvaluationContext,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = EvaluationResult<ResolutionDetails<f64>>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        self.0.resolve_float_value(flag_key, evaluation_context)
    }

    #[allow(
        mismatched_lifetime_syntaxes,
        clippy::type_complexity,
        clippy::type_repetition_in_bounds
    )]
    fn resolve_string_value<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        flag_key: &'life1 str,
        evaluation_context: &'life2 EvaluationContext,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = EvaluationResult<ResolutionDetails<String>>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        self.0.resolve_string_value(flag_key, evaluation_context)
    }

    #[allow(
        mismatched_lifetime_syntaxes,
        clippy::type_complexity,
        clippy::type_repetition_in_bounds
    )]
    fn resolve_struct_value<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        flag_key: &'life1 str,
        evaluation_context: &'life2 EvaluationContext,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = EvaluationResult<ResolutionDetails<StructValue>>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        self.0.resolve_struct_value(flag_key, evaluation_context)
    }
}
