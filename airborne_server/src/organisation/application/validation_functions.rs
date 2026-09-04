use actix_web::{
    get, post, put,
    web::{Data, Json, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use diesel::prelude::*;
use log::info;

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

/// `main` is synchronous by design: validation is a pure decision over the
/// provided context, with no I/O.
pub const DEFAULT_VALIDATION_FUNCTION: &str = "function main(args) {\n  return true;\n}";

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

        Ok(result
            .map(|vf| vf.function_code)
            .unwrap_or_else(|| DEFAULT_VALIDATION_FUNCTION.to_string()))
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
        // Reject code that does not even define a synchronous main before saving.
        ensure_valid_validation_function(&function_code)?;

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
            .set((
                validation_functions::function_code.eq(&function_code),
                validation_functions::updated_at.eq(diesel::dsl::now),
            ))
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
    let auth_response = auth_response.into_inner();
    let (_organisation, _application) =
        require_org_and_app(auth_response.organisation, auth_response.application)?;
    let _ = &state;

    let function_code = req.function_code.trim().to_string();
    let test_args = req.test_args.clone();

    let result = run_blocking!({ execute_validation_function(&function_code, &test_args) });

    match result {
        Ok(r) => Ok(Json(TestValidationFunctionResponse {
            valid: true,
            result: Some(r),
            error: None,
        })),
        Err(e) => Ok(Json(TestValidationFunctionResponse {
            valid: false,
            result: None,
            error: Some(match e {
                ABError::BadRequest(msg) => msg,
                other => other.to_string(),
            }),
        })),
    }
}

/// Build a fresh sandboxed JS runtime with dynamic code execution disabled.
fn new_runtime() -> airborne_types::Result<rustyscript::Runtime> {
    use rustyscript::{Runtime, RuntimeOptions};

    let mut runtime = Runtime::new(RuntimeOptions::default())
        .map_err(|e| ABError::InternalServerError(format!("Failed to create JS runtime: {}", e)))?;

    let _ = runtime.eval::<()>("globalThis.eval = undefined; globalThis.Function = undefined;");

    Ok(runtime)
}

fn load_code(
    runtime: &mut rustyscript::Runtime,
    function_code: &str,
) -> airborne_types::Result<()> {
    runtime
        .eval::<()>(function_code)
        .map_err(|e| ABError::BadRequest(format!("Syntax error: {}", e)))?;
    Ok(())
}

/// Check that the loaded code defines a synchronous `main` function.
fn ensure_sync_main(runtime: &mut rustyscript::Runtime) -> airborne_types::Result<()> {
    let is_sync_fn: bool = runtime
        .eval("typeof main === 'function' && main.constructor.name === 'Function'")
        .map_err(|e| ABError::BadRequest(format!("Failed to inspect main: {}", e)))?;

    if !is_sync_fn {
        return Err(ABError::BadRequest(
            "Validation code must define a synchronous `function main(args)` (async functions are not allowed)"
                .to_string(),
        ));
    }

    Ok(())
}

/// Load `function_code` into a sandbox and check that it defines a
/// synchronous `main` function.
fn ensure_valid_validation_function(function_code: &str) -> airborne_types::Result<()> {
    let mut runtime = new_runtime()?;
    load_code(&mut runtime, function_code)?;
    ensure_sync_main(&mut runtime)
}

/// Run `main(args)` from `function_code` in a sandboxed runtime.
/// `main` must be synchronous and return a boolean.
pub fn execute_validation_function(
    function_code: &str,
    args: &serde_json::Value,
) -> airborne_types::Result<bool> {
    let mut runtime = new_runtime()?;
    load_code(&mut runtime, function_code)?;
    ensure_sync_main(&mut runtime)?;

    let result: serde_json::Value = runtime
        .call_function(None, "main", args)
        .map_err(|e| ABError::BadRequest(format!("Execution error: {}", e)))?;

    match result {
        serde_json::Value::Bool(b) => Ok(b),
        _ => Err(ABError::BadRequest(
            "main must return a boolean".to_string(),
        )),
    }
}

/// Build the context passed to the validation function before a release:
/// the package, its remembered file groups (with each group version's
/// metadata), and the release's file splits.
pub async fn build_release_validation_context(
    state: &Data<AppState>,
    package_data: &crate::utils::db::models::PackageV2Entry,
    important: &[String],
    lazy: &[String],
    resources: &[String],
) -> airborne_types::Result<serde_json::Value> {
    use crate::package::types::PackageFileGroup;
    use crate::utils::db::models::FileGroupEntry;
    use crate::utils::db::schema::hyperotaserver::file_groups;

    let snapshots: Vec<PackageFileGroup> =
        serde_json::from_value(package_data.file_groups.clone()).unwrap_or_default();

    let pool = state.db_pool.clone();
    let refs: Vec<(String, i32)> = snapshots
        .iter()
        .map(|g| (g.name.clone(), g.version))
        .collect();
    let org = package_data.org_id.clone();
    let app = package_data.app_id.clone();

    let metadata_by_ref = run_blocking!({
        let mut conn = pool.get()?;
        let mut out: std::collections::HashMap<(String, i32), serde_json::Value> =
            std::collections::HashMap::new();
        for (name, version) in &refs {
            let row: Option<FileGroupEntry> = file_groups::table
                .filter(file_groups::org_id.eq(&org))
                .filter(file_groups::app_id.eq(&app))
                .filter(file_groups::name.eq(name))
                .filter(file_groups::version.eq(version))
                .select(FileGroupEntry::as_select())
                .first(&mut conn)
                .optional()?;
            if let Some(v) = row {
                out.insert((name.clone(), *version), v.metadata);
            }
        }
        Ok(out)
    })?;

    let mut groups_map = serde_json::Map::new();
    for g in &snapshots {
        groups_map.insert(
            g.name.clone(),
            serde_json::json!({
                "version": g.version,
                "metadata": metadata_by_ref
                    .get(&(g.name.clone(), g.version))
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({})),
                "files": g.files,
            }),
        );
    }

    Ok(serde_json::json!({
        "package": {
            "version": package_data.version,
            "tag": package_data.tag,
            "index": package_data.index,
        },
        "file_groups": serde_json::Value::Object(groups_map),
        "important": important,
        "lazy": lazy,
        "resources": resources,
    }))
}

/// Run the app's validation function against `context`; reject on `false`.
/// Apps without a stored function pass (the default returns true).
pub async fn enforce_release_validation(
    state: &Data<AppState>,
    organisation: &str,
    application: &str,
    context: serde_json::Value,
) -> airborne_types::Result<()> {
    let pool = state.db_pool.clone();
    let org = organisation.to_string();
    let app = application.to_string();

    let passed = run_blocking!({
        let mut conn = pool.get()?;
        let row: Option<ValidationFunction> = validation_functions::table
            .filter(validation_functions::org_id.eq(&org))
            .filter(validation_functions::app_id.eq(&app))
            .first(&mut conn)
            .optional()?;

        match row {
            None => Ok(true),
            Some(vf) => execute_validation_function(&vf.function_code, &context),
        }
    })?;

    if !passed {
        return Err(ABError::BadRequest(
            "Release validation failed: validation function returned false".to_string(),
        ));
    }

    Ok(())
}
