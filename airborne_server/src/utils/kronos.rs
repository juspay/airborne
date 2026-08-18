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

use std::future::Future;
use std::sync::Arc;

use kronos_common::sqlx;
use kronos_common::tenant::SchemaProvider;
use kronos_worker::{KronosHttpClient, KronosLibraryClient, WorkerConfig};
use serde_json::json;

use crate::config::AppConfig;
use crate::types::{ABError, Result};

pub use kronos_worker::{JobTrigger, KronosClient, WorkerHandle};

#[derive(Clone)]
pub struct SingleSchemaProvider {
    schema: String,
}

impl SingleSchemaProvider {
    pub fn new(schema: String) -> Self {
        Self { schema }
    }
}

impl SchemaProvider for SingleSchemaProvider {
    fn get_active_schemas(
        &self,
    ) -> impl Future<Output = std::result::Result<Vec<String>, sqlx::Error>> + Send {
        let schema = self.schema.clone();
        async move { Ok(vec![schema]) }
    }
}

/// Build the Kronos client for the configured mode. In embedded mode this also starts
/// the background worker and returns its handle (hold it for graceful shutdown).
pub async fn build_client(
    cfg: &AppConfig,
    kronos_db_url: &str,
) -> Result<(Arc<dyn KronosClient>, Option<WorkerHandle>)> {
    if let Some(url) = &cfg.kronos_url {
        let api_key = cfg
            .kronos_api_key
            .clone()
            .unwrap_or_else(|| "dev-api-key".to_string());
        log::info!("Kronos service mode: using remote Kronos at {url}");
        let client: Arc<dyn KronosClient> = Arc::new(KronosHttpClient::new(
            url.clone(),
            api_key,
            cfg.kronos_org_id.clone(),
        ));
        Ok((client, None))
    } else {
        let lib = KronosLibraryClient::from_database_url(
            kronos_db_url,
            cfg.kronos_db_pool_size,
            &cfg.kronos_table_prefix,
            &cfg.kronos_encryption_key,
            None,
        )
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to init embedded Kronos: {e}"))
        })?;
        // Provision the workspace schema + kronos_* tables BEFORE starting the worker.
        // `start_worker` spawns a poller that immediately queries
        // `<kronos_workspace>.kronos_executions`; if the schema isn't provisioned yet it logs
        // `relation "kronos_executions" does not exist` until setup runs. The DDL is
        // `CREATE ... IF NOT EXISTS`, so the later provision in `setup_dispatcher` is a no-op.
        lib.provision_workspace(&cfg.kronos_workspace)
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!("Kronos provision_workspace: {e}"))
            })?;
        let provider = SingleSchemaProvider::new(cfg.kronos_workspace.clone());
        let handle = lib.start_worker(provider, WorkerConfig::default());
        log::info!("Kronos library mode: embedded worker started");
        let client: Arc<dyn KronosClient> = Arc::new(lib);
        Ok((client, Some(handle)))
    }
}

/// Ensure the workspace/schema exists (no-op in embedded mode once provisioned).
pub async fn provision_workspace(client: &dyn KronosClient, schema: &str) -> Result<()> {
    client
        .provision_workspace(schema)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Kronos provision_workspace: {e}")))
}

/// Upsert a workspace secret (encrypted at rest by Kronos), referenceable in endpoint
/// specs as `{{secret.<name>}}`.
pub async fn upsert_secret(
    client: &dyn KronosClient,
    schema: &str,
    name: &str,
    value: &str,
) -> Result<()> {
    client
        .upsert_secret(schema, name, value)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Kronos upsert_secret '{name}': {e}")))
}

/// Register (upsert) an HTTP callback endpoint that Kronos POSTs to at job time. The
/// endpoint sends `Authorization: Bearer {{secret.<auth_secret_name>}}`, succeeds on 200,
/// and retries with exponential backoff (per-job `max_attempts` governs the count).
pub async fn register_http_endpoint(
    client: &dyn KronosClient,
    schema: &str,
    name: &str,
    url: &str,
    auth_secret_name: &str,
    timeout_secs: u64,
) -> Result<()> {
    let spec = json!({
        "url": url,
        "method": "POST",
        "headers": {
            "Authorization": format!("Bearer {{{{secret.{auth_secret_name}}}}}"),
            "Content-Type": "application/json"
        },
        "timeout_ms": timeout_secs * 1000 + 5000,
        "expected_status_codes": [200]
    });
    let retry =
        json!({ "backoff": "exponential", "initial_delay_ms": 1000, "max_delay_ms": 30000 });
    client
        .register_endpoint(schema, name, "HTTP", spec, Some(retry))
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Kronos register_endpoint '{name}': {e}"))
        })
}

/// Create a job. Returns the execution id.
pub async fn create_job(
    client: &dyn KronosClient,
    schema: &str,
    endpoint: &str,
    input: serde_json::Value,
    max_attempts: i64,
    trigger: JobTrigger,
    idempotency_key: Option<&str>,
) -> Result<String> {
    client
        .create_job(
            schema,
            endpoint,
            input,
            max_attempts,
            trigger,
            idempotency_key,
        )
        .await
        .map_err(|e| ABError::InternalServerError(format!("Kronos create_job: {e}")))
}

/// Create a job idempotently. Kronos's `UNIQUE (endpoint, idempotency_key)` index means a
/// duplicate returns `Ok(None)` (someone — e.g. another pod — already scheduled it) rather
/// than an error. Use this for cross-pod-safe scheduling (e.g. a recurring maintenance job).
pub async fn create_job_idempotent(
    client: &dyn KronosClient,
    schema: &str,
    endpoint: &str,
    input: serde_json::Value,
    max_attempts: i64,
    trigger: JobTrigger,
    idempotency_key: &str,
) -> Result<Option<String>> {
    match client
        .create_job(
            schema,
            endpoint,
            input,
            max_attempts,
            trigger,
            Some(idempotency_key),
        )
        .await
    {
        Ok(id) => Ok(Some(id)),
        Err(e) => {
            let msg = e.to_string().to_lowercase();
            if msg.contains("duplicate key")
                || msg.contains("unique constraint")
                || msg.contains("idempotency")
            {
                Ok(None)
            } else {
                Err(ABError::InternalServerError(format!(
                    "Kronos create_job: {e}"
                )))
            }
        }
    }
}

/// Cancel a pending job (cancels its PENDING/QUEUED executions; unschedules CRON).
#[allow(dead_code)]
pub async fn cancel_job(client: &dyn KronosClient, schema: &str, job_id: &str) -> Result<()> {
    client
        .cancel_job(schema, job_id)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Kronos cancel_job: {e}")))
}

/// Fire now.
pub fn immediate() -> JobTrigger {
    JobTrigger::Immediate
}

/// Fire after `secs` seconds.
pub fn delayed(secs: i64) -> JobTrigger {
    JobTrigger::Delayed {
        run_at: chrono::Utc::now() + chrono::Duration::seconds(secs),
    }
}
