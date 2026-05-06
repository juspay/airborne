use actix_web::{
    delete, get, post, put,
    web::{self, Json, Path, Query, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use serde::Serialize;

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    organisation::application::dimension::cohort::types::CohortDimensionSchema,
    run_blocking, types as airborne_types,
    types::{ABError, AppState},
    utils::{
        db::{models::ReleaseViewEntry, schema::hyperotaserver::release_views},
        document::{hashmap_to_json_value, schema_doc_to_hashmap, value_to_document},
    },
};
use diesel::prelude::*;
use release_views::dsl::{app_id, created_at, dimensions as dimensions_col, id, name, org_id};
use serde_json::Value;
use types::*;
use uuid::Uuid;

mod cohort;
mod types;

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
        .service(Scope::new("/{dimension}/cohort").service(cohort::add_routes()))
}

#[derive(Serialize)]
struct CreateDimensionResponse {
    dimension: String,
    position: i32,
    schema: Value,
    description: String,
    change_reason: String,
}

#[authz(
    resource = "dimension",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/create")]
async fn create_dimension_api(
    req: Json<CreateDimensionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateDimensionResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
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
    let highest_position = match req.dimension_type {
        DimensionType::Cohort => {
            let dimensions = &current_dimensions.data;
            dimensions
                .iter()
                .find(|d| d.dimension == req.depends_on.clone().unwrap_or_default())
                .map(|d| d.position)
                .ok_or_else(|| ABError::NotFound("Dependency dimension not found".to_string()))?
        }
        DimensionType::Standard => {
            let dimensions = &current_dimensions.data;
            dimensions.iter().map(|d| d.position).max().unwrap_or(0) + 1
        }
    };

    let dim_schema = req.schema.to_json();

    match req.dimension_type {
        DimensionType::Cohort => {
            let depends_on = req.depends_on.clone().ok_or_else(|| {
                ABError::BadRequest("depends_on is required for cohort dimensions".to_string())
            })?;
            let schema = CohortDimensionSchema::default(depends_on.clone()).to_kv_str_doc();
            let dimension = state
                .superposition_client
                .create_dimension()
                .org_id(state.env.superposition_org_id.clone())
                .workspace_id(workspace_name.clone())
                .dimension(req.dimension.clone())
                .position(highest_position)
                .set_schema(Some(schema))
                .dimension_type(superposition_sdk::types::DimensionType::LocalCohort(
                    depends_on,
                ))
                .description(req.description.clone())
                .change_reason("Creating new dimension".to_string())
                .send()
                .await
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to create dimension: {}", e))
                })?;

            let _ = state
                .superposition_client
                .weight_recompute()
                .org_id(state.env.superposition_org_id.clone())
                .workspace_id(workspace_name.clone())
                .send()
                .await
                .map_err(|e| {
                    ABError::InternalServerError(format!(
                        "Failed to trigger weight recompute: {}",
                        e
                    ))
                })?;
            crate::webhook::fire(
                state.get_ref(),
                organisation.clone(),
                application.clone(),
                true,
                "dimension.create",
                "dimension",
                Some(dimension.dimension.clone()),
                Some(serde_json::json!({
                    "position": dimension.position,
                    "description": dimension.description.clone(),
                })),
            );
            Ok(Json(CreateDimensionResponse {
                dimension: dimension.dimension,
                position: dimension.position,
                schema: hashmap_to_json_value(&dimension.schema),
                description: dimension.description,
                change_reason: dimension.change_reason,
            }))
        }
        DimensionType::Standard => {
            let dimension = state
                .superposition_client
                .create_dimension()
                .org_id(state.env.superposition_org_id.clone())
                .workspace_id(workspace_name.clone())
                .dimension(req.dimension.clone())
                .position(highest_position)
                .set_schema(Some(schema_doc_to_hashmap(&value_to_document(&dim_schema))))
                .description(req.description.clone())
                .change_reason("Creating new dimension".to_string())
                .send()
                .await
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to create dimension: {}", e))
                })?;
            crate::webhook::fire(
                state.get_ref(),
                organisation.clone(),
                application.clone(),
                true,
                "dimension.create",
                "dimension",
                Some(dimension.dimension.clone()),
                Some(serde_json::json!({
                    "position": dimension.position,
                    "description": dimension.description.clone(),
                })),
            );
            Ok(Json(CreateDimensionResponse {
                dimension: dimension.dimension,
                position: dimension.position,
                schema: hashmap_to_json_value(&dimension.schema),
                description: dimension.description,
                change_reason: dimension.change_reason,
            }))
        }
    }
}

#[authz(
    resource = "dimension",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    webhook_allowed = false
)]
#[get("/list")]
async fn list_dimensions_api(
    auth_response: ReqData<AuthResponse>,
    query: Query<ListDimensionsQuery>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListDimensionsResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
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
        total_pages: Some(dimensions.total_pages),
        total_items: Some(dimensions.total_items),
        data: dimensions
            .data
            .into_iter()
            .map(|d| Dimension {
                dimension: d.dimension,
                position: d.position,
                schema: hashmap_to_json_value(&d.schema),
                description: d.description,
                change_reason: d.change_reason,
                mandatory: Some(d.mandatory),
                dimension_type: match d.dimension_type {
                    superposition_sdk::types::DimensionType::LocalCohort(_) => {
                        DimensionType::Cohort
                    }
                    _ => DimensionType::Standard,
                },
                depends_on: match d.dimension_type {
                    superposition_sdk::types::DimensionType::LocalCohort(depends_on) => {
                        Some(depends_on)
                    }
                    _ => None,
                },
            })
            .collect(),
    }))
}

#[authz(
    resource = "dimension",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[put("/{dimension_name}")]
async fn update_dimension_api(
    path: Path<String>,
    req: Json<UpdateDimensionRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Dimension>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
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

    let _ = state
        .superposition_client
        .weight_recompute()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to trigger weight recompute: {}", e))
        })?;

    crate::webhook::fire(
        state.get_ref(),
        organisation.clone(),
        application.clone(),
        true,
        "dimension.update",
        "dimension",
        Some(update_dimension.dimension.clone()),
        Some(serde_json::json!({
            "position": update_dimension.position,
            "change_reason": update_dimension.change_reason.clone(),
        })),
    );

    Ok(Json(Dimension {
        dimension: update_dimension.dimension,
        position: update_dimension.position,
        schema: hashmap_to_json_value(&update_dimension.schema),
        description: update_dimension.description,
        change_reason: update_dimension.change_reason,
        mandatory: Some(update_dimension.mandatory),
        dimension_type: match update_dimension.dimension_type {
            superposition_sdk::types::DimensionType::LocalCohort(_) => DimensionType::Cohort,
            _ => DimensionType::Standard,
        },
        depends_on: match update_dimension.dimension_type {
            superposition_sdk::types::DimensionType::LocalCohort(depends_on) => Some(depends_on),
            _ => None,
        },
    }))
}

#[authz(
    resource = "dimension",
    action = "delete",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[delete("/{dimension_name}")]
async fn delete_dimension_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<()>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let dimension_name = path.into_inner();

    state
        .superposition_client
        .delete_dimension()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(dimension_name.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to delete dimension: {}", e)))?;

    crate::webhook::fire(
        state.get_ref(),
        organisation.clone(),
        application.clone(),
        true,
        "dimension.delete",
        "dimension",
        Some(dimension_name.clone()),
        None,
    );

    Ok(Json(()))
}

#[authz(
    resource = "release_view",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/release-view")]
async fn create_release_view_api(
    req: Json<CreateReleaseViewRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ReleaseView>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
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
    let pool = state.db_pool.clone();
    let req_name = req.name.clone();
    let req_dimensions = req.dimensions.clone();
    let db_app = application.clone();
    let db_org = organisation.clone();

    let created_view = run_blocking!({
        let mut conn = pool.get()?;
        let result = diesel::insert_into(release_views::table)
            .values((
                id.eq(view_id),
                app_id.eq(db_app),
                org_id.eq(db_org),
                name.eq(req_name),
                dimensions_col.eq(req_dimensions),
            ))
            .get_result::<ReleaseViewEntry>(&mut conn)
            .map_err(|e| ABError::InternalServerError(format!("DB insert failed: {}", e)))?;
        Ok(result)
    })?;

    crate::webhook::fire(
        state.get_ref(),
        organisation.clone(),
        application.clone(),
        true,
        "release_view.create",
        "release_view",
        Some(created_view.id.to_string()),
        Some(serde_json::json!({
            "name": created_view.name.clone(),
        })),
    );

    Ok(Json(ReleaseView {
        id: created_view.id,
        name: created_view.name,
        dimensions: created_view.dimensions,
        created_at: created_view.created_at,
    }))
}

#[authz(
    resource = "release_view",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    webhook_allowed = false
)]
#[get("/release-view/list")]
async fn list_release_views_api(
    auth_response: ReqData<AuthResponse>,
    query: Query<ListReleaseViewsQuery>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListReleaseViewsResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let page = query.page.unwrap_or(1).max(1);
    let count = query.count.unwrap_or(20);
    let offset = (page - 1) * count;
    let pool = state.db_pool.clone();

    let (total_items, rows) = run_blocking!({
        let mut conn = pool.get()?;

        let total_items: i64 = release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .count()
            .get_result(&mut conn)?;

        let rows = release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .order(created_at.desc())
            .offset(offset.into())
            .limit(count.into())
            .load::<ReleaseViewEntry>(&mut conn)?;

        Ok((total_items, rows))
    })?;

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

#[authz(
    resource = "release_view",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"],
    webhook_allowed = false
)]
#[get("/release-view/{view_id}")]
async fn get_release_view_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ReleaseView>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let view_id_str = path.into_inner();

    let view_id = Uuid::parse_str(&view_id_str)
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let pool = state.db_pool.clone();

    let view = run_blocking!({
        let mut conn = pool.get()?;
        release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .filter(id.eq(&view_id))
            .first::<ReleaseViewEntry>(&mut conn)
            .map_err(|e| {
                if e.to_string().contains("NotFound") {
                    ABError::NotFound("View not found".to_string())
                } else {
                    ABError::InternalServerError(format!("Failed to fetch view: {}", e))
                }
            })
    })?;

    Ok(Json(ReleaseView {
        id: view.id,
        name: view.name,
        dimensions: view.dimensions,
        created_at: view.created_at,
    }))
}

#[authz(
    resource = "release_view",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[put("/release-view/{view_id}")]
async fn update_release_view_api(
    path: Path<String>,
    req: Json<UpdateReleaseViewRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ReleaseView>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let view_id_str = path.into_inner();

    let view_id = Uuid::parse_str(&view_id_str)
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
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

    let pool = state.db_pool.clone();
    let req_dimensions = req.dimensions.clone();
    let req_name = req.name.clone();
    let db_app = application.clone();
    let db_org = organisation.clone();

    let updated_view = run_blocking!({
        let mut conn = pool.get()?;
        let result = diesel::update(
            release_views::table.filter(
                app_id
                    .eq(&db_app)
                    .and(org_id.eq(&db_org))
                    .and(id.eq(&view_id)),
            ),
        )
        .set((dimensions_col.eq(&req_dimensions), name.eq(&req_name)))
        .get_result::<ReleaseViewEntry>(&mut conn)
        .map_err(|e| {
            if e.to_string().contains("NotFound") {
                ABError::NotFound("View not found".to_string())
            } else {
                ABError::InternalServerError(format!("Failed to update view: {}", e))
            }
        })?;
        Ok(result)
    })?;

    crate::webhook::fire(
        state.get_ref(),
        organisation.clone(),
        application.clone(),
        true,
        "release_view.update",
        "release_view",
        Some(updated_view.id.to_string()),
        Some(serde_json::json!({
            "name": updated_view.name.clone(),
        })),
    );

    Ok(Json(ReleaseView {
        id: updated_view.id,
        name: updated_view.name,
        dimensions: updated_view.dimensions,
        created_at: updated_view.created_at,
    }))
}

#[authz(
    resource = "release_view",
    action = "delete",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[delete("/release-view/{view_id}")]
async fn delete_release_view_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DeleteReleaseViewResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let view_id_str = path.into_inner();

    let view_id = Uuid::parse_str(&view_id_str)
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let pool = state.db_pool.clone();
    let db_app = application.clone();
    let db_org = organisation.clone();

    let deleted_rows = run_blocking!({
        let mut conn = pool.get()?;
        let rows = diesel::delete(
            release_views::table
                .filter(app_id.eq(&db_app))
                .filter(org_id.eq(&db_org))
                .filter(id.eq(&view_id)),
        )
        .execute(&mut conn)
        .map_err(|e| ABError::InternalServerError(format!("Failed to delete view: {}", e)))?;
        Ok(rows)
    })?;

    if deleted_rows == 0 {
        return Err(ABError::NotFound("View not found".to_string()));
    }

    crate::webhook::fire(
        state.get_ref(),
        organisation.clone(),
        application.clone(),
        true,
        "release_view.delete",
        "release_view",
        Some(view_id.to_string()),
        None,
    );

    Ok(Json(DeleteReleaseViewResponse { success: true }))
}
