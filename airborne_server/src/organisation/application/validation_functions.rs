use actix_web::{
    get, post, put,
    web::{Data, Json, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
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
            error: Some(e.to_string()),
        })),
    }
}

pub fn execute_validation_function(
    function_code: &str,
    args: &serde_json::Value,
) -> airborne_types::Result<bool> {
    use rustyscript::{Runtime, RuntimeOptions};

    let mut runtime = Runtime::new(RuntimeOptions::default())
        .map_err(|e| ABError::InternalServerError(format!("Failed to create JS runtime: {}", e)))?;

    let _ = runtime.eval::<()>("globalThis.eval = undefined; globalThis.Function = undefined;");

    runtime
        .eval::<()>(function_code)
        .map_err(|e| ABError::BadRequest(format!("Syntax error: {}", e)))?;

    let result: serde_json::Value = runtime
        .call_function(None, "main", args)
        .map_err(|e| ABError::BadRequest(format!("Execution error: {}", e)))?;

    match result {
        serde_json::Value::Bool(true) => Ok(true),
        serde_json::Value::Bool(false) => Ok(false),
        _ => Err(ABError::BadRequest(
            "main must return a boolean".to_string(),
        )),
    }
}
