use actix_web::{
    get, post, put,
    web::{Data, Json, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use log::{error, info};
use rustyscript::{module_loader::ImportProvider, Runtime, RuntimeOptions};

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    run_blocking, types as airborne_types,
    types::{ABError, AppState},
    utils::db::{
        models::{NewValidationFunction, ValidationFunction},
        schema::hyperotaserver::validation_functions,
    },
};

mod types;
pub use types::*;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(get_validation_function)
        .service(update_validation_function)
        .service(test_validation_function)
}

pub const DEFAULT_VALIDATION_FUNCTION: &str = "async function main(args) {\n  return true;\n}";

#[authz(
    resource = "validation_functions",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn get_validation_function(
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> airborne_types::Result<Json<ValidationFunctionResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth_response.organisation, auth_response.application)?;

    let function_code = run_blocking!({
        let mut conn = state.db_pool.get()?;

        let result: Option<ValidationFunction> = validation_functions::table
            .filter(validation_functions::org_id.eq(&organisation))
            .filter(validation_functions::app_id.eq(&application))
            .first(&mut conn)
            .optional()?;

        let function_code = match result {
            Some(vf) => vf.function_code,
            None => DEFAULT_VALIDATION_FUNCTION.to_string(),
        };

        Ok(function_code)
    })?;

    Ok(Json(ValidationFunctionResponse { function_code }))
}

#[authz(
    resource = "validation_functions",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[put("")]
async fn update_validation_function(
    req: Json<UpdateValidationFunctionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> airborne_types::Result<Json<ValidationFunctionResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) =
        require_org_and_app(auth_response.organisation, auth_response.application)?;

    let function_code = req.function_code.trim().to_string();

    let function_code = run_blocking!({
        let mut conn = state.db_pool.get()?;

        let existing: Option<ValidationFunction> = validation_functions::table
            .filter(validation_functions::org_id.eq(&organisation))
            .filter(validation_functions::app_id.eq(&application))
            .first(&mut conn)
            .optional()?;

        if existing.is_some() {
            diesel::update(
                validation_functions::table
                    .filter(validation_functions::org_id.eq(&organisation))
                    .filter(validation_functions::app_id.eq(&application)),
            )
            .set(validation_functions::function_code.eq(&function_code))
            .execute(&mut conn)?;
        } else {
            let new_vf = NewValidationFunction {
                org_id: &organisation,
                app_id: &application,
                function_code: &function_code,
            };
            diesel::insert_into(validation_functions::table)
                .values(&new_vf)
                .execute(&mut conn)?;
        }

        info!(
            "Updated validation function for app: {} in org: {}",
            application, organisation
        );

        Ok(function_code)
    })?;

    Ok(Json(ValidationFunctionResponse { function_code }))
}

#[authz(
    resource = "validation_functions",
    action = "test",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[post("/test")]
async fn test_validation_function(
    req: Json<TestValidationFunctionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> airborne_types::Result<Json<TestValidationFunctionResponse>> {
    let function_code = req.function_code.trim().to_string();
    let test_args = req.test_args.clone();

    let result = execute_validation_function(&state, function_code, test_args).await;

    match result {
        Ok(r) => Ok(Json(TestValidationFunctionResponse {
            valid: true,
            result: Some(r),
            error: None,
        })),
        Err(e) => Ok(Json(TestValidationFunctionResponse {
            valid: false,
            result: None,
            error: Some(e.to_string()),
        })),
    }
}

pub async fn execute_validation_function(
    state: &AppState,
    function_code: String,
    args: serde_json::Value,
) -> airborne_types::Result<bool> {
    let execution_timeout = state.env.validation_execution_timeout;
    let max_heap_size = state.env.validation_max_heap_size;
    let permit = tokio::time::timeout(
        state.env.validation_queue_timeout,
        state.validation_semaphore.clone().acquire_owned(),
    )
    .await
    .map_err(|_| ABError::ServiceUnavailable("validation queue timeout".to_string()))?
    .map_err(|_| ABError::InternalServerError("validation queue closed".to_string()))?;

    run_blocking!({
        let _permit = permit;
        execute(&function_code, &args, execution_timeout, max_heap_size)
    })
}

struct DenyFileImportProvider;

impl ImportProvider for DenyFileImportProvider {
    fn resolve(
        &mut self,
        specifier: &rustyscript::deno_core::ModuleSpecifier,
        _referrer: &str,
        _kind: rustyscript::deno_core::ResolutionKind,
    ) -> Option<
        Result<
            rustyscript::deno_core::ModuleSpecifier,
            rustyscript::deno_core::error::ModuleLoaderError,
        >,
    > {
        if specifier.scheme() == "file" {
            return Some(Err(
                rustyscript::deno_core::error::ModuleLoaderError::generic(
                    "file imports are not allowed in the sandbox".to_string(),
                ),
            ));
        }
        None
    }
}

struct ExecutionTimeoutGuard {
    cancel_tx: Option<mpsc::Sender<()>>,
    handle: Option<JoinHandle<()>>,
    timed_out: Arc<AtomicBool>,
}

impl ExecutionTimeoutGuard {
    fn start(runtime: &mut Runtime, timeout: Duration) -> Self {
        let isolate_handle = runtime.deno_runtime().v8_isolate().thread_safe_handle();
        let (cancel_tx, cancel_rx) = mpsc::channel();
        let timed_out = Arc::new(AtomicBool::new(false));
        let timed_out_for_thread = Arc::clone(&timed_out);

        let handle = thread::spawn(move || match cancel_rx.recv_timeout(timeout) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => {}
            Err(mpsc::RecvTimeoutError::Timeout) => {
                timed_out_for_thread.store(true, Ordering::SeqCst);
                isolate_handle.terminate_execution();
            }
        });

        Self {
            cancel_tx: Some(cancel_tx),
            handle: Some(handle),
            timed_out,
        }
    }

    fn timed_out(&self) -> bool {
        self.timed_out.load(Ordering::SeqCst)
    }
}

impl Drop for ExecutionTimeoutGuard {
    fn drop(&mut self) {
        if let Some(cancel_tx) = self.cancel_tx.take() {
            let _ = cancel_tx.send(());
        }

        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn execute(
    function_code: &str,
    args: &serde_json::Value,
    execution_timeout: Duration,
    max_heap_size: usize,
) -> airborne_types::Result<bool> {
    let mut runtime = Runtime::new(RuntimeOptions {
        timeout: execution_timeout,
        max_heap_size: Some(max_heap_size),
        import_provider: Some(Box::new(DenyFileImportProvider)),
        ..Default::default()
    })
    .map_err(|e| {
        error!("Failed to create JS runtime: {}", e);
        ABError::InternalServerError(format!("Failed to create JS runtime: {}", e))
    })?;

    let _ = runtime.eval::<()>("globalThis.eval = undefined; globalThis.Function = undefined;");

    let timeout_guard = ExecutionTimeoutGuard::start(&mut runtime, execution_timeout);

    runtime.eval::<()>(function_code).map_err(|e| {
        if timeout_guard.timed_out() {
            error!(
                "Validation function timed out after {:?}",
                execution_timeout
            );
            return ABError::BadRequest(format!(
                "Execution timed out after {:?}",
                execution_timeout
            ));
        }

        error!("Validation function syntax error: {}", e);
        ABError::BadRequest(format!(
            "Syntax error: {}",
            truncate_error(&e.to_string(), 500)
        ))
    })?;

    let result: serde_json::Value = runtime.call_function(None, "main", args).map_err(|e| {
        if timeout_guard.timed_out() {
            error!(
                "Validation function timed out after {:?}",
                execution_timeout
            );
            return ABError::BadRequest(format!(
                "Execution timed out after {:?}",
                execution_timeout
            ));
        }

        error!("Validation function execution error: {}", e);
        ABError::BadRequest(format!(
            "Execution error: {}",
            truncate_error(&e.to_string(), 500)
        ))
    })?;

    match result {
        serde_json::Value::Bool(true) => Ok(true),
        serde_json::Value::Bool(false) => Ok(false),
        _ => {
            error!(
                "Validation function main returned non-boolean: {:?}",
                result
            );
            Err(ABError::BadRequest(
                "main must return a boolean".to_string(),
            ))
        }
    }
}

fn truncate_error(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max_len).collect();
    format!("{}...(truncated)", truncated)
}
