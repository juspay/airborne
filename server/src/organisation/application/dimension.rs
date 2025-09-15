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
        db::{models::ReleaseViewEntry, schema::hyperotaserver::release_views},
        document::{document_to_json_value, value_to_document},
        workspace::get_workspace_name_for_application,
    },
};
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use release_views::dsl::{app_id, created_at, dimensions as dimensions_col, id, name, org_id};
use serde_json::Value;
use uuid::Uuid;

#[derive(Deserialize)]
enum DimensionSchema {
    #[serde(rename = "string")]
    String,
}

#[derive(Deserialize)]
struct CreateDimensionRequest {
    dimension: String,
    #[serde(default = "default_dimension_schema")]
    schema: DimensionSchema,
    description: String,
    // function_name: Option<String>,
    // mandatory: Option<bool>,
}

fn default_dimension_schema() -> DimensionSchema {
    DimensionSchema::String
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

#[derive(Deserialize)]
struct CreateReleaseViewRequest {
    name: String,
    dimensions: Value,
}

#[derive(Deserialize)]
struct ListReleaseViewsQuery {
    page: Option<i32>,
    count: Option<i32>,
}

#[derive(Serialize)]
struct ReleaseView {
    id: Uuid,
    name: String,
    dimensions: Value,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
struct ListReleaseViewsResponse {
    data: Vec<ReleaseView>,
    total_items: Option<i64>,
    total_pages: Option<i64>,
}

#[derive(Deserialize)]
struct UpdateReleaseViewRequest {
    dimensions: Value,
    name: String,
}

#[derive(Serialize)]
struct DeleteReleaseViewResponse {
    success: bool,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_dimension_api)
        .service(list_dimensions_api)
        .service(update_dimension_api)
        .service(delete_dimension_api)
        .service(create_release_view_api)
        .service(list_release_views_api)
        .service(get_release_view_api)
        .service(update_release_view_api)
        .service(delete_release_view_api)
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

    let dim_schema = match req.schema {
        DimensionSchema::String => serde_json::json!({ "type": "string" }),
    };

    let dimension = state
        .superposition_client
        .create_dimension()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(req.dimension.clone())
        .position(highest_position + 1)
        .schema(value_to_document(&dim_schema))
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

#[post("/release-view")]
async fn create_release_view_api(
    req: Json<CreateReleaseViewRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseView>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let existing_dimensions = state
        .superposition_client
        .list_dimensions()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to list dimensions: {}", e)))?;

    let valid_dimension_names: std::collections::HashSet<String> = existing_dimensions
        .data
        .unwrap_or_default()
        .into_iter()
        .map(|d| d.dimension)
        .collect();

    let dimension_keys_to_validate = if let Some(dimensions_array) = req.dimensions.as_array() {
        // Array format: [{"key": "env", "value": "prod"}, ...]
        dimensions_array
            .iter()
            .filter_map(|item| {
                if let Some(obj) = item.as_object() {
                    obj.get("key")
                        .and_then(|k| k.as_str())
                        .map(|key| key.to_string())
                } else {
                    None
                }
            })
            .collect::<Vec<String>>()
    } else {
        return Err(ABError::BadRequest(
            "Dimensions must be an array of {\"key\": \"...\", \"value\": \"...\"} objects"
                .to_string(),
        ));
    };

    // Check if all dimension keys exist
    for dimension_key in &dimension_keys_to_validate {
        if !valid_dimension_names.contains(dimension_key) {
            return Err(ABError::BadRequest(format!(
                "Dimension '{}' does not exist for this organization and application",
                dimension_key
            )));
        }
    }

    let view_id = Uuid::new_v4();

    let created_view = diesel::insert_into(release_views::table)
        .values((
            id.eq(view_id),
            app_id.eq(application),
            org_id.eq(organisation),
            name.eq(req.name.clone()),
            dimensions_col.eq(req.dimensions.clone()),
        ))
        .get_result::<ReleaseViewEntry>(&mut conn)
        .map_err(|e| ABError::InternalServerError(format!("DB insert failed: {}", e)))?;

    Ok(Json(ReleaseView {
        id: created_view.id,
        name: created_view.name,
        dimensions: created_view.dimensions,
        created_at: created_view.created_at,
    }))
}

#[get("/release-view/list")]
async fn list_release_views_api(
    auth_response: ReqData<AuthResponse>,
    query: web::Query<ListReleaseViewsQuery>,
    state: web::Data<AppState>,
) -> Result<Json<ListReleaseViewsResponse>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to app".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let page = query.page.unwrap_or(1).max(1);
    let count = query.count.unwrap_or(20);
    let offset = (page - 1) * count;

    let total_items: i64 = release_views::table
        .filter(app_id.eq(&application))
        .filter(org_id.eq(&organisation))
        .count()
        .get_result(&mut conn)
        .map_err(|e| ABError::InternalServerError(format!("Failed to count views: {}", e)))?;

    let rows = release_views::table
        .filter(app_id.eq(&application))
        .filter(org_id.eq(&organisation))
        .order(created_at.desc())
        .offset(offset.into())
        .limit(count.into())
        .load::<ReleaseViewEntry>(&mut conn)
        .map_err(|e| ABError::InternalServerError(format!("Failed to load views: {}", e)))?;

    let total_pages = ((total_items as f64) / (count as f64)).ceil() as i64;

    Ok(Json(ListReleaseViewsResponse {
        data: rows
            .into_iter()
            .map(|row| ReleaseView {
                id: row.id,
                name: row.name,
                dimensions: row.dimensions,
                created_at: row.created_at,
            })
            .collect(),
        total_items: Some(total_items),
        total_pages: Some(total_pages),
    }))
}

#[get("/release-view/{view_id}")]
async fn get_release_view_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseView>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to app".to_string()))?;
    let view_id_str = path.into_inner();

    let view_id = Uuid::parse_str(&view_id_str)
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let view = release_views::table
        .filter(app_id.eq(&application))
        .filter(org_id.eq(&organisation))
        .filter(id.eq(&view_id))
        .first::<ReleaseViewEntry>(&mut conn)
        .map_err(|err| match err {
            DieselError::NotFound => ABError::NotFound("View not found".to_string()),
            _ => ABError::InternalServerError(format!("Failed to fetch view: {}", err)),
        })?;

    Ok(Json(ReleaseView {
        id: view.id,
        name: view.name,
        dimensions: view.dimensions,
        created_at: view.created_at,
    }))
}

#[put("/release-view/{view_id}")]
async fn update_release_view_api(
    path: Path<String>,
    req: Json<UpdateReleaseViewRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ReleaseView>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to app".to_string()))?;
    let view_id_str = path.into_inner();

    let view_id = Uuid::parse_str(&view_id_str)
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let existing_dimensions = state
        .superposition_client
        .list_dimensions()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to list dimensions: {}", e)))?;

    let valid_dimension_names: std::collections::HashSet<String> = existing_dimensions
        .data
        .unwrap_or_default()
        .into_iter()
        .map(|d| d.dimension)
        .collect();

    let dimension_keys_to_validate = if let Some(dimensions_array) = req.dimensions.as_array() {
        dimensions_array
            .iter()
            .filter_map(|item| {
                if let Some(obj) = item.as_object() {
                    obj.get("key")
                        .and_then(|k| k.as_str())
                        .map(|key| key.to_string())
                } else {
                    None
                }
            })
            .collect::<Vec<String>>()
    } else {
        return Err(ABError::BadRequest(
            "Dimensions must be an array of {\"key\": \"...\", \"value\": \"...\"} objects"
                .to_string(),
        ));
    };

    for dimension_key in &dimension_keys_to_validate {
        if !valid_dimension_names.contains(dimension_key) {
            return Err(ABError::BadRequest(format!(
                "Dimension '{}' does not exist for this organization and application",
                dimension_key
            )));
        }
    }

    let updated_view = diesel::update(
        release_views::table.filter(
            app_id
                .eq(&application)
                .and(org_id.eq(&organisation))
                .and(id.eq(&view_id)),
        ),
    )
    .set((dimensions_col.eq(&req.dimensions), name.eq(&req.name)))
    .get_result::<ReleaseViewEntry>(&mut conn)
    .map_err(|err| match err {
        DieselError::NotFound => ABError::NotFound("View not found".to_string()),
        _ => ABError::InternalServerError(format!("Failed to fetch view: {}", err)),
    })?;

    Ok(Json(ReleaseView {
        id: updated_view.id,
        name: updated_view.name,
        dimensions: updated_view.dimensions,
        created_at: updated_view.created_at,
    }))
}

#[delete("/release-view/{view_id}")]
async fn delete_release_view_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<DeleteReleaseViewResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;
    let view_id_str = path.into_inner();

    let view_id = Uuid::parse_str(&view_id_str)
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let deleted_rows = diesel::delete(
        release_views::table.filter(
            app_id
                .eq(&application)
                .and(org_id.eq(&organisation))
                .and(id.eq(&view_id)),
        ),
    )
    .execute(&mut conn)
    .map_err(|e| ABError::InternalServerError(format!("Failed to delete view: {}", e)))?;

    if deleted_rows == 0 {
        return Err(ABError::NotFound("View not found".to_string()));
    }

    Ok(Json(DeleteReleaseViewResponse { success: true }))
}
