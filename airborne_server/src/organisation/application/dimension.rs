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
        release_view::{self, ReleaseViewType},
    },
};
use diesel::prelude::*;
use release_views::dsl::{
    app_id, created_at, dimensions as dimensions_col, id, name, org_id, view_type as view_type_col,
};
use serde_json::Value;
use types::*;
use uuid::Uuid;

mod cohort;
mod types;

/// Dimensions Superposition owns rather than the app: the experimentation module resolves every
/// variant through `variantIds`, so deleting it would break variant targeting workspace-wide.
const RESERVED_DIMENSIONS: [&str; 1] = ["variantIds"];

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_dimension_api)
        .service(list_dimensions_api)
        .service(update_dimension_api)
        .service(list_dimension_active_releases_api)
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
        &state.redis_cache,
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
    app_roles = ["admin", "write", "read"]
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
        &state.redis_cache,
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
        &state.redis_cache,
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

/// The live release of every dimension slice that targets `dimension`.
///
/// A release view is one slice that has been released to, and the newest release in it is the one
/// serving that slice today — so those are exactly the releases that have to go before the
/// dimension can be deleted. Discarded releases never served anything and are skipped.
async fn active_releases_using_dimension(
    dimension: &str,
    organisation: &str,
    application: &str,
    workspace_name: &str,
    state: &web::Data<AppState>,
) -> airborne_types::Result<Vec<DimensionActiveRelease>> {
    let affected_views = {
        let pool = state.db_pool.clone();
        let org = organisation.to_string();
        let app = application.to_string();
        let dimension = dimension.to_string();

        run_blocking!({
            let mut conn = pool.get()?;
            let views = release_views::table
                .filter(app_id.eq(&app))
                .filter(org_id.eq(&org))
                .load::<ReleaseViewEntry>(&mut conn)
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to list release views: {}", e))
                })?;

            Ok(views
                .into_iter()
                .filter_map(|view| {
                    let context = release_view::view_dimensions_to_context(&view.dimensions);
                    context.contains_key(&dimension).then_some((view, context))
                })
                .collect::<Vec<_>>())
        })?
    };

    if affected_views.is_empty() {
        return Ok(vec![]);
    }

    // One listing of this app's releases, matched against each view's context here rather than
    // asking Superposition to filter per view — that keeps this correct regardless of how context
    // filtering behaves, and costs one call instead of one per view.
    let experiments = crate::release::utils::list_experiments_by_context(
        crate::release::types::ListExperimentsQuery {
            superposition_org_id: state.env.superposition_org_id.clone(),
            workspace_name: workspace_name.to_string(),
            context: std::collections::HashMap::new(),
            strict_mode: false,
            page: None,
            count: None,
            all: true,
            status: None,
            experiment_name: Some(format!("{}-{}-release-exp", application, organisation)),
        },
        state.clone(),
    )
    .await?;

    // Already sorted newest-first by the listing, so the first match per view is its active release.
    let releases: Vec<_> = experiments
        .data()
        .iter()
        .filter(|exp| exp.status != superposition_sdk::types::ExperimentStatusType::Discarded)
        .map(|exp| {
            let context: std::collections::HashMap<String, String> = exp
                .context
                .iter()
                .map(|(key, value)| {
                    let value = crate::utils::document::document_to_json_value(value);
                    (
                        key.clone(),
                        value.as_str().map(str::to_string).unwrap_or_default(),
                    )
                })
                .collect();
            (exp, context)
        })
        .collect();

    // Several views can describe the same slice — a hand-made one alongside the auto-generated one
    // — but they share a single live release, and it should be listed once.
    let mut seen = std::collections::HashSet::new();

    Ok(affected_views
        .into_iter()
        .filter_map(|(view, view_context)| {
            let view_context: std::collections::HashMap<String, String> = view_context
                .into_iter()
                .map(|(key, value)| (key, value.as_str().unwrap_or_default().to_string()))
                .collect();

            releases
                .iter()
                .find(|(_, context)| *context == view_context)
                .filter(|(exp, _)| seen.insert(exp.id.to_string()))
                .map(|(exp, _)| {
                    let experimental_variant = exp.variants.iter().find(|variant| {
                        variant.variant_type == superposition_sdk::types::VariantType::Experimental
                    });

                    DimensionActiveRelease {
                        release_id: exp.id.to_string(),
                        view_id: view.id,
                        view_name: view.name.clone(),
                        dimensions: view.dimensions.clone(),
                        status: exp.status.to_string(),
                        package_version: crate::release::utils::extract_integer_from_experiment::<
                            i64,
                        >(
                            &experimental_variant, "package.version"
                        ) as i32,
                    }
                })
        })
        .collect())
}

#[authz(
    resource = "dimension",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{dimension_name}/active-releases")]
async fn list_dimension_active_releases_api(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DimensionActiveReleasesResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let dimension = path.into_inner();

    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let data = active_releases_using_dimension(
        &dimension,
        &organisation,
        &application,
        &workspace_name,
        &state,
    )
    .await?;

    Ok(Json(DimensionActiveReleasesResponse { dimension, data }))
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
    let dimension = path.into_inner();

    if RESERVED_DIMENSIONS.contains(&dimension.as_str()) {
        return Err(ABError::BadRequest(format!(
            "'{}' is an internal dimension and cannot be deleted",
            dimension
        )));
    }

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    // Same check the delete dialog runs, enforced here too so a release created in between (or a
    // caller that skipped the dialog) cannot strand a slice on a dimension that no longer exists.
    let blocking = active_releases_using_dimension(
        &dimension,
        &organisation,
        &application,
        &workspace_name,
        &state,
    )
    .await?;

    if !blocking.is_empty() {
        return Err(ABError::BadRequest(format!(
            "{} release(s) still target this dimension ({}). Delete them from their release views first.",
            blocking.len(),
            blocking
                .iter()
                .map(|release| release.view_name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        )));
    }

    state
        .superposition_client
        .delete_dimension()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(dimension)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to delete dimension: {}", e)))?;

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
        &state.redis_cache,
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

    let created_view = run_blocking!({
        let mut conn = pool.get()?;
        let result = diesel::insert_into(release_views::table)
            .values((
                id.eq(view_id),
                app_id.eq(application),
                org_id.eq(organisation),
                name.eq(req_name),
                dimensions_col.eq(req_dimensions),
                view_type_col.eq(ReleaseViewType::Custom.as_str()),
            ))
            .get_result::<ReleaseViewEntry>(&mut conn)
            .map_err(|e| match e {
                diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::UniqueViolation,
                    _,
                ) => ABError::BadRequest("A view with this name already exists".to_string()),
                other => ABError::InternalServerError(format!("DB insert failed: {}", other)),
            })?;
        Ok(result)
    })?;

    Ok(Json(created_view.into()))
}

#[authz(
    resource = "release_view",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
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
    let type_filter = query.view_type;
    let pool = state.db_pool.clone();

    let (total_items, rows) = run_blocking!({
        let mut conn = pool.get()?;

        let mut count_query = release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .into_boxed();
        let mut rows_query = release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .into_boxed();

        if let Some(view_type) = type_filter {
            count_query = count_query.filter(view_type_col.eq(view_type.as_str()));
            rows_query = rows_query.filter(view_type_col.eq(view_type.as_str()));
        }

        let total_items: i64 = count_query.count().get_result(&mut conn)?;

        let rows = rows_query
            .order(created_at.desc())
            .offset(offset.into())
            .limit(count.into())
            .load::<ReleaseViewEntry>(&mut conn)?;

        Ok((total_items, rows))
    })?;

    let total_pages = ((total_items as f64) / (count as f64)).ceil() as i64;

    Ok(Json(ListReleaseViewsResponse {
        data: rows.into_iter().map(ReleaseView::from).collect(),
        total_items: Some(total_items),
        total_pages: Some(total_pages),
    }))
}

#[authz(
    resource = "release_view",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
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
            .optional()
            .map_err(|e| ABError::InternalServerError(format!("Failed to fetch view: {}", e)))?
            .ok_or_else(|| ABError::NotFound("View not found".to_string()))
    })?;

    Ok(Json(view.into()))
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
        &state.redis_cache,
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

    let updated_view = run_blocking!({
        let mut conn = pool.get()?;

        let existing = release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .filter(id.eq(&view_id))
            .first::<ReleaseViewEntry>(&mut conn)
            .optional()
            .map_err(|e| ABError::InternalServerError(format!("Failed to fetch view: {}", e)))?
            .ok_or_else(|| ABError::NotFound("View not found".to_string()))?;

        // Auto-generated views mirror a release's dimensions, so editing them would make the name
        // and filter lie about where they came from. Users delete them or create a custom view.
        if ReleaseViewType::from(existing.view_type.as_str()) == ReleaseViewType::AutoGenerated {
            return Err(ABError::BadRequest(
                "Auto-generated views cannot be edited. Create a custom view instead.".to_string(),
            ));
        }

        let result = diesel::update(
            release_views::table.filter(
                app_id
                    .eq(&application)
                    .and(org_id.eq(&organisation))
                    .and(id.eq(&view_id)),
            ),
        )
        .set((dimensions_col.eq(&req_dimensions), name.eq(&req_name)))
        .get_result::<ReleaseViewEntry>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => ABError::NotFound("View not found".to_string()),
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => ABError::BadRequest("A view with this name already exists".to_string()),
            other => ABError::InternalServerError(format!("Failed to update view: {}", other)),
        })?;
        Ok(result)
    })?;

    Ok(Json(updated_view.into()))
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

    let deleted_rows = run_blocking!({
        let mut conn = pool.get()?;

        let existing = release_views::table
            .filter(app_id.eq(&application))
            .filter(org_id.eq(&organisation))
            .filter(id.eq(&view_id))
            .first::<ReleaseViewEntry>(&mut conn)
            .optional()
            .map_err(|e| ABError::InternalServerError(format!("Failed to fetch view: {}", e)))?
            .ok_or_else(|| ABError::NotFound("View not found".to_string()))?;

        // An auto-generated view stands for a live dimension slice, so it goes away only when that
        // slice's release is deleted (POST /releases/views/{view_id}/delete), not on its own.
        if ReleaseViewType::from(existing.view_type.as_str()) == ReleaseViewType::AutoGenerated {
            return Err(ABError::BadRequest(
                "Auto-generated views are removed when their release is deleted".to_string(),
            ));
        }

        let rows = diesel::delete(
            release_views::table
                .filter(app_id.eq(&application))
                .filter(org_id.eq(&organisation))
                .filter(id.eq(&view_id)),
        )
        .execute(&mut conn)
        .map_err(|e| ABError::InternalServerError(format!("Failed to delete view: {}", e)))?;
        Ok(rows)
    })?;

    if deleted_rows == 0 {
        return Err(ABError::NotFound("View not found".to_string()));
    }

    Ok(Json(DeleteReleaseViewResponse { success: true }))
}
