use actix_web::{get, post, web::{self, Json, Query}, HttpResponse, Scope, error};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use diesel::prelude::*;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use superposition_rust_sdk::types::builders::VariantBuilder;
use aws_smithy_types::Document;

use crate::{
    middleware::auth::{AuthResponse, validate_user, WRITE},
    types::AppState,
    utils::{
        db::{
            models::PackageV2Entry,
            schema::hyperotaserver::{
                packages_v2::{dsl as packages_dsl},
            },
        },
        document::value_to_document,
        workspace::get_workspace_name_for_application,
    },
};

#[derive(Deserialize)]
pub struct GetReleaseQuery {
    release_key: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateReleaseRequest {
    package_id: String,
    important: Vec<String>,
    lazy: Vec<String>,
    dimensions: Option<HashMap<String, serde_json::Value>>,
    metadata: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct CreateReleaseResponse {
    id: String,
    created_at: DateTime<Utc>,
    package_version: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileResource {
    pub url: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_release)
        .service(get_release)
        .service(list_releases)
}

#[get("")]
async fn get_release(
    query: Query<GetReleaseQuery>,
    _auth_response: web::ReqData<AuthResponse>,
    _state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse> {
    let release_id = query.into_inner().release_key;
    if release_id.is_empty() {
        return Err(actix_web::error::ErrorBadRequest("Release Key cannot be empty"));
    }
    // TODO: Implement actual release retrieval logic
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Release retrieval not yet implemented",
        "release_id": release_id
    })))
}

#[post("")]
async fn create_release(
    req: Json<CreateReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<CreateReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Parse package_id to extract version
    let pkg_version = req.package_id.parse::<i32>().map_err(|_| {
        error::ErrorBadRequest(format!("Invalid package_id format: {}", req.package_id))
    })?;

    // Check if intersection of important and lazy files is empty
    let important_set: HashSet<&String> = req.important.iter().collect();
    let lazy_set: HashSet<&String> = req.lazy.iter().collect();
    let overlap: Vec<&String> = important_set.intersection(&lazy_set).cloned().collect();
    if !overlap.is_empty() {
        return Err(error::ErrorBadRequest(format!(
            "Files cannot be in both important and lazy splits: {:?}",
            overlap
        )));
    }

    // Verify package exists and get its data
    let package_data = packages_dsl::packages_v2
        .filter(
            packages_dsl::org_id.eq(&organisation)
                .and(packages_dsl::app_id.eq(&application))
                .and(packages_dsl::version.eq(pkg_version)),
        )
        .select(PackageV2Entry::as_select())
        .first::<PackageV2Entry>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("Package version {} not found", pkg_version)))?;

    // Validate that all provided important files exist in the package
    for file_path in &req.important {
        if !package_data.files.contains(&Some(file_path.clone())) {
            return Err(error::ErrorBadRequest(format!(
                "Important file '{}' not found in package {}",
                file_path, pkg_version
            )));
        }
    }

    // Validate that all provided lazy files exist in the package
    for file_path in &req.lazy {
        if !package_data.files.contains(&Some(file_path.clone())) {
            return Err(error::ErrorBadRequest(format!(
                "Lazy file '{}' not found in package {}",
                file_path, pkg_version
            )));
        }
    }

    let release_id = Uuid::new_v4();
    let now = Utc::now();
    let user_id = auth_response.sub.clone();

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!(
        "Using Superposition Org ID from environment for create release: {}",
        superposition_org_id_from_env
    );

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;
    println!(
        "Using workspace name for create release: {}",
        workspace_name
    );

    // Create control variant with release configuration
    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), Document::from(pkg_version));
    // Add custom important and lazy splits to the variant
    let important_docs: Vec<Document> = req.important.iter().map(|s| Document::from(s.as_str())).collect();
    let lazy_docs: Vec<Document> = req.lazy.iter().map(|s| Document::from(s.as_str())).collect();
    control_overrides.insert("package.important".to_string(), Document::from(important_docs));
    control_overrides.insert("package.lazy".to_string(), Document::from(lazy_docs));

    // Create experimental variant with same overrides
    let experimental_overrides = control_overrides.clone();

    let control_variant = VariantBuilder::default()
        .id("control".to_string())
        .variant_type(superposition_rust_sdk::types::VariantType::Control)
        .overrides(Document::from(control_overrides))
        .build()
        .map_err(error::ErrorInternalServerError)?;

    let experimental_variant_id = format!("experimental_{}", pkg_version);
    
    let experimental_variant = VariantBuilder::default()
        .id(experimental_variant_id.clone())
        .variant_type(superposition_rust_sdk::types::VariantType::Experimental)
        .overrides(Document::from(experimental_overrides))
        .build()
        .map_err(error::ErrorInternalServerError)?;

    // Convert dimensions to context for superposition
    let context = if let Some(dims) = &req.dimensions {
        dims.iter().map(|(key, value)| {
            let condition = serde_json::json!({
                "==": [
                    {"var": key},
                    value
                ]
            });
            value_to_document(&condition)
        }).collect()
    } else {
        vec![] // Default to empty array if no dimensions provided
    };

    let created_experiment_response = state
        .superposition_client
        .create_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .name(format!("{}-{}-release-exp", application, organisation))
        .experiment_type(superposition_rust_sdk::types::ExperimentType::Default)
        .description(format!(
            "Release experiment for application {} in organisation {} with package version {}",
            application, organisation, pkg_version
        ))
        .change_reason(format!(
            "Release creation for application {} with custom splits",
            application
        ))
        .variants(control_variant)
        .variants(experimental_variant);
    
    let created_experiment_response = if !context.is_empty() {
        created_experiment_response.context("and", Document::Array(context))
    } else {
        created_experiment_response.set_context(Some(HashMap::new()))
    };
    
    let created_experiment_response = created_experiment_response.send().await.map_err(|e| {
        eprintln!("Failed to create experiment: {:?}", e);
        error::ErrorInternalServerError("Failed to create experiment in Superposition".to_string())
    })?;

    let experiment_id_for_ramping = created_experiment_response.id.to_string();

    println!(
        "Experiment {} created for release {} with package version {}.",
        experiment_id_for_ramping, release_id, pkg_version
    );

    Ok(Json(CreateReleaseResponse {
        id: experiment_id_for_ramping,
        created_at: now,
        package_version: pkg_version
    }))
}

#[get("/list")]
async fn list_releases(
    _auth_response: web::ReqData<AuthResponse>,
    _state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse> {
    // TODO: Implement actual release listing logic
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Release listing not yet implemented",
        "releases": []
    })))
}