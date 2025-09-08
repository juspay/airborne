use actix_web::{
    delete, get, post, put,
    web::{self, Json, Path, ReqData},
    Result, Scope,
};
use serde::{Deserialize, Serialize};

use crate::{
    middleware::auth::{validate_user, AuthResponse, WRITE},
    types::{ABError, AppState},
    utils::{
        document::{document_to_json_value, value_to_document},
        workspace::get_workspace_name_for_application,
    },
};
use serde_json::Value;

#[derive(Deserialize)]
struct CreateDimensionRequest {
    dimension: String,
    schema: Value,
    description: String,
    // function_name: Option<String>,
    // mandatory: Option<bool>,
}

#[derive(Deserialize)]
struct ListDimensionsQuery {
    page: Option<i32>,
    count: Option<i32>,
}

#[derive(Deserialize)]
struct UpdateDimensionRequest {
    position: Option<i32>,
    change_reason: String,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_dimension_api)
        .service(list_dimensions_api)
        .service(update_dimension_api)
        .service(delete_dimension_api)
}

#[derive(Serialize)]
struct CreateDimensionResponse {
    dimension: String,
    position: i32,
    schema: Value,
    description: String,
    change_reason: String,
}

#[post("/create")]
async fn create_dimension_api(
    req: Json<CreateDimensionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<CreateDimensionResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let current_dimensions = state
        .superposition_client
        .list_dimensions()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to list dimensions: {}", e)))?;

    // Find the highest position using nested match statements
    let highest_position = match &current_dimensions.data {
        Some(dimensions) => dimensions.iter().map(|d| d.position).max().unwrap_or(0),
        None => 0,
    };

    let dimension = state
        .superposition_client
        .create_dimension()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(req.dimension.clone())
        .position(highest_position + 1)
        .schema(value_to_document(&req.schema))
        .description(req.description.clone())
        .change_reason("Creating new dimension".to_string())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to create dimension: {}", e)))?;

    Ok(Json(CreateDimensionResponse {
        dimension: dimension.dimension,
        position: dimension.position,
        schema: document_to_json_value(&dimension.schema),
        description: dimension.description,
        change_reason: dimension.change_reason,
    }))
}

#[derive(Serialize)]
struct ListDimensionsResponse {
    total_pages: Option<i32>,
    total_items: Option<i32>,
    data: Vec<Dimension>,
}

#[derive(Serialize)]
struct Dimension {
    dimension: String,
    position: i32,
    schema: Value,
    description: String,
    change_reason: String,
    mandatory: Option<bool>,
}

#[get("/list")]
async fn list_dimensions_api(
    auth_response: ReqData<AuthResponse>,
    query: web::Query<ListDimensionsQuery>,
    state: web::Data<AppState>,
) -> Result<Json<ListDimensionsResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let dimensionsreq = state
        .superposition_client
        .list_dimensions()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone());
    let dimensionsreq = if let Some(page) = query.page {
        dimensionsreq.page(page)
    } else {
        dimensionsreq
    };
    let dimensionsreq = if let Some(count) = query.count {
        dimensionsreq.count(count)
    } else {
        dimensionsreq // Default count if not provided
    };
    let dimensions = dimensionsreq
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to list dimensions: {}", e)))?;

    Ok(Json(ListDimensionsResponse {
        total_pages: dimensions.total_pages,
        total_items: dimensions.total_items,
        data: dimensions
            .data
            .unwrap_or_default()
            .into_iter()
            .map(|d| Dimension {
                dimension: d.dimension,
                position: d.position,
                schema: document_to_json_value(&d.schema),
                description: d.description,
                change_reason: d.change_reason,
                mandatory: d.mandatory,
            })
            .collect(),
    }))
}

#[put("/{dimension_name}")]
async fn update_dimension_api(
    path: Path<String>,
    req: Json<UpdateDimensionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Dimension>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let update_dimension = state
        .superposition_client
        .update_dimension()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(path.into_inner());
    let update_dimension = if let Some(position) = req.position {
        update_dimension.position(position)
    } else {
        update_dimension
    };
    let update_dimension = update_dimension
        .change_reason(req.change_reason.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to update dimension: {}", e)))?;

    Ok(Json(Dimension {
        dimension: update_dimension.dimension,
        position: update_dimension.position,
        schema: document_to_json_value(&update_dimension.schema),
        description: update_dimension.description,
        change_reason: update_dimension.change_reason,
        mandatory: update_dimension.mandatory,
    }))
}

#[delete("/{dimension_name}")]
async fn delete_dimension_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<()>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    // Get database connection
    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    state
        .superposition_client
        .delete_dimension()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(path.into_inner())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to delete dimension: {}", e)))?;

    Ok(Json(()))
}
