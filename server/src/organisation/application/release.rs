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

use std::collections::HashMap;

use actix_web::{
    error, get, patch, post,
    web::{self, Json, Path, ReqData},
    Result, Scope,
};
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use superposition_rust_sdk::types::builders::VariantBuilder;
use uuid::Uuid;

use crate::{
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    types::{ABError, AppState},
    utils::{
        db::{
            models::{PackageEntryRead, ReleaseEntry},
            schema::hyperotaserver::releases::dsl::*,
        },
        document::value_to_document,
        workspace::get_workspace_name_for_application,
    },
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create)
        .service(list_releases)
        .service(ramp_release)
        .service(conclude_release)
        .service(get_experiment_details)
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    version_id: Option<String>,
    metadata: Option<serde_json::Value>,
    context: Option<Context>, // Changed to accept JsonLogic format directly
}

#[derive(Debug, Deserialize, Clone)]
struct Context {
    and: Vec<serde_json::Value>,
}

#[derive(Serialize)]
struct CreateResponse {
    id: String,
    created_at: DateTime<Utc>,
    package_version: i32,
    config_version: String,
}

#[derive(Serialize)]
struct ReleaseHistoryResponse {
    releases: Vec<ReleaseHistoryEntry>,
}

#[derive(Serialize)]
struct ReleaseHistoryEntry {
    id: String,
    package_version: i32,
    config_version: String,
    created_at: DateTime<Utc>,
    created_by: String,
    metadata: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct RampReleaseRequest {
    traffic_percentage: u8,
    change_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConcludeReleaseRequest {
    chosen_variant: String,
    change_reason: Option<String>,
}

#[derive(Serialize)]
struct RampReleaseResponse {
    success: bool,
    message: String,
    experiment_id: String,
    traffic_percentage: u8,
}

#[derive(Serialize)]
struct ConcludeReleaseResponse {
    success: bool,
    message: String,
    experiment_id: String,
    chosen_variant: String,
}

#[derive(Serialize)]
struct ExperimentDetailsResponse {
    experiment_id: String,
    traffic_percentage: i32,
    status: String,
    variants: Vec<ExperimentVariant>,
}

#[derive(Serialize)]
struct ExperimentVariant {
    id: String,
    name: String,
    variant_type: String,
}

#[post("/create")]
async fn create(
    req: Json<CreateRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<CreateResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let pkg_version = if let Some(version_str) = req.version_id.clone() {
        version_str.parse::<i32>().map_err(|_| {
            ABError::BadRequest(format!("Invalid version ID format: {}", version_str))
        })?
    } else {
        crate::utils::db::schema::hyperotaserver::packages::dsl::packages
            .filter(
                crate::utils::db::schema::hyperotaserver::packages::dsl::org_id
                    .eq(&organisation)
                    .and(
                        crate::utils::db::schema::hyperotaserver::packages::dsl::app_id
                            .eq(&application),
                    ),
            )
            .select(diesel::dsl::max(
                crate::utils::db::schema::hyperotaserver::packages::dsl::version,
            ))
            .first::<Option<i32>>(&mut conn)
            .map_err(|_| ABError::InternalServerError("".to_string()))?
            .ok_or_else(|| {
                ABError::NotFound("No packages found for this application".to_string())
            })?
    };

    // Verify package exists
    crate::utils::db::schema::hyperotaserver::packages::dsl::packages
        .filter(
            crate::utils::db::schema::hyperotaserver::packages::dsl::org_id
                .eq(&organisation)
                .and(
                    crate::utils::db::schema::hyperotaserver::packages::dsl::app_id
                        .eq(&application),
                )
                .and(
                    crate::utils::db::schema::hyperotaserver::packages::dsl::version
                        .eq(pkg_version),
                ),
        )
        .first::<PackageEntryRead>(&mut conn)
        .map_err(|_| ABError::NotFound(format!("Package version {} not found", pkg_version)))?;

    let config = crate::utils::db::schema::hyperotaserver::configs::dsl::configs
        .filter(
            crate::utils::db::schema::hyperotaserver::configs::dsl::org_id
                .eq(&organisation)
                .and(
                    crate::utils::db::schema::hyperotaserver::configs::dsl::app_id.eq(&application),
                )
                .and(
                    crate::utils::db::schema::hyperotaserver::configs::dsl::version.eq(pkg_version),
                ),
        )
        .select(crate::utils::db::models::ConfigEntry::as_select())
        .first(&mut conn)
        .map_err(|_| {
            ABError::NotFound(format!(
                "Config for package version {} not found",
                pkg_version
            ))
        })?;

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
            ABError::InternalServerError(format!("Failed to get workspace name: {}", e))
        })?;
    println!(
        "Using workspace name for create release: {}",
        workspace_name
    );

    // Create control variant with release configuration
    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), Document::from(pkg_version));
    // control_overrides.insert("package.name".to_string(), serde_json::json!(application.clone()));
    // control_overrides.insert("release.id".to_string(), serde_json::json!(release_id.to_string()));
    // control_overrides.insert("release.config_version".to_string(), serde_json::json!(config.config_version.clone()));

    // Create experimental variant with same overrides
    let experimental_overrides = control_overrides.clone();

    let control_variant = VariantBuilder::default()
        .id("control".to_string())
        .variant_type(superposition_rust_sdk::types::VariantType::Control)
        .overrides(Document::from(control_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(format!("{}", e)))?;

    let experimental_variant_id = format!("experimental_{}", pkg_version);

    let experimental_variant = VariantBuilder::default()
        .id(experimental_variant_id.clone())
        .variant_type(superposition_rust_sdk::types::VariantType::Experimental)
        .overrides(Document::from(experimental_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(format!("{}", e)))?;

    let context = if let Some(ctx) = &req.context {
        // Convert JsonLogic context to Document
        ctx.and.iter().map(value_to_document).collect()
    } else {
        vec![] // Default to empty array if no context provided
    };

    let created_experiment_response = state
        .superposition_client
        .create_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .name(format!("{}-{}-exp", application, organisation))
        .experiment_type(superposition_rust_sdk::types::ExperimentType::Default)
        .description(format!(
            "Experiment for application {} in organisation {}",
            application, organisation
        ))
        .change_reason(format!(
            "Experiment for application {} in organisation {}",
            application, organisation
        ))
        .variants(control_variant)
        .variants(experimental_variant);
    let created_experiment_response = if !context.is_empty() {
        created_experiment_response.context("and", Document::Array(context))
    } else {
        created_experiment_response.set_context(Some(HashMap::new()))
    };
    let created_experiment_response = created_experiment_response.send().await.map_err(|e| {
        eprintln!("Failed to create experiment: {:?}", e); // Log the detailed error
        ABError::InternalServerError("Failed to create experiment in Superposition".to_string())
    })?;

    // Assuming 'id' is the field in CreateExperimentResponseContent and it has to_string()
    // The actual type of created_experiment_response.id is models::ExperimentId (likely i64 or similar)
    let experiment_id_for_ramping = created_experiment_response.id.to_string();

    println!(
        "Experiment {} created. Attempting to ramp to 100% traffic.",
        experiment_id_for_ramping
    );

    // state.superposition_client
    //     .ramp_experiment()
    //     .org_id(superposition_org_id_from_env.clone())
    //     .workspace_id(workspace_name.clone())
    //     .id(experiment_id_for_ramping.clone())
    //     .traffic_percentage(50)
    //     .change_reason(format!(
    //         "Auto-activating and ramping experiment for release {} (pkg_version {}) to 100% traffic.",
    //         release_id, pkg_version
    //     ))
    //     .send()
    //     .await
    //     .map_err(error::ErrorInternalServerError)?;

    let mut release_metadata = req
        .metadata
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));

    let experiment_variant_id = format!("experimental_{}", pkg_version);

    if let serde_json::Value::Object(ref mut map) = release_metadata {
        map.insert(
            "experiment_id".to_string(),
            serde_json::Value::String(experiment_id_for_ramping.clone()),
        );
        map.insert(
            "variants".to_string(),
            serde_json::json!([
                {"id": "control", "name": "Control (Original)"},
                {"id": experiment_variant_id, "name": format!("Experimental (v{})", pkg_version)}
            ]),
        );
    } else {
        release_metadata = serde_json::json!({
            "experiment_id": experiment_id_for_ramping.clone(),
            "variants": [
                {"id": "control", "name": "Control (Original)"},
                {"id": experiment_variant_id, "name": format!("Experimental (v{})", pkg_version)}
            ]
        });
    }

    let new_release = ReleaseEntry {
        id: release_id,
        org_id: organisation.clone(),
        app_id: application.clone(),
        package_version: pkg_version,
        config_version: config.config_version.clone(),
        created_at: now,
        created_by: user_id,
        metadata: release_metadata,
    };

    diesel::insert_into(releases)
        .values(&new_release)
        .execute(&mut conn)
        .map_err(|_| ABError::DbError("".to_string()))?;

    let path = format!("/release/{}/{}*", organisation.clone(), application.clone());

    // Invalidate all variants in CloudFront
    if let Err(e) = invalidate_cf(
        &state.cf_client,
        path,
        &state.env.cloudfront_distribution_id,
    )
    .await
    {
        eprintln!("Failed to invalidate CloudFront cache: {:?}", e);
    }

    Ok(Json(CreateResponse {
        id: release_id.to_string(),
        created_at: now,
        package_version: pkg_version,
        config_version: config.config_version,
    }))
}

#[get("/history")]
async fn list_releases(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
) -> Result<Json<ReleaseHistoryResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, READ).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, READ).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let release_entries = releases
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .order_by(created_at.desc())
        .load::<ReleaseEntry>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let release_history = release_entries
        .into_iter()
        .map(|entry| ReleaseHistoryEntry {
            id: entry.id.to_string(),
            package_version: entry.package_version,
            config_version: entry.config_version,
            created_at: entry.created_at,
            created_by: entry.created_by,
            metadata: entry.metadata,
        })
        .collect();

    Ok(Json(ReleaseHistoryResponse {
        releases: release_history,
    }))
}

#[patch("/{release_id}/ramp")]
async fn ramp_release(
    release_id: Path<String>,
    req: Json<RampReleaseRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<RampReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let release_uuid = Uuid::parse_str(&release_id)
        .map_err(|_| error::ErrorBadRequest("Invalid release ID format"))?;

    let release = releases
        .filter(
            id.eq(release_uuid)
                .and(org_id.eq(&organisation))
                .and(app_id.eq(&application)),
        )
        .first::<ReleaseEntry>(&mut conn)
        .map_err(|_| error::ErrorNotFound("Release not found"))?;

    let experiment_id = release
        .metadata
        .get("experiment_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| error::ErrorBadRequest("No experiment associated with this release"))?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;

    println!(
        "Ramping experiment {} to {}% traffic for release {} in workspace {} org {}",
        experiment_id,
        req.traffic_percentage,
        release_id,
        workspace_name,
        superposition_org_id_from_env
    );

    state
        .superposition_client
        .ramp_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(experiment_id.to_string())
        .traffic_percentage(req.traffic_percentage as i32)
        .change_reason(req.change_reason.clone().unwrap_or_else(|| {
            format!(
                "Ramping release {} to {}% traffic",
                release_id, req.traffic_percentage
            )
        }))
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to ramp experiment: {:?}", e);
            error::ErrorInternalServerError("Failed to ramp experiment in Superposition")
        })?;

    println!("Successfully ramped experiment {}", experiment_id);

    Ok(Json(RampReleaseResponse {
        success: true,
        message: format!(
            "Release experiment ramped to {}% traffic",
            req.traffic_percentage
        ),
        experiment_id: experiment_id.to_string(),
        traffic_percentage: req.traffic_percentage,
    }))
}

#[patch("/{release_id}/conclude")]
async fn conclude_release(
    release_id: Path<String>,
    req: Json<ConcludeReleaseRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ConcludeReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let release_uuid = Uuid::parse_str(&release_id)
        .map_err(|_| error::ErrorBadRequest("Invalid release ID format"))?;

    let release = releases
        .filter(
            id.eq(release_uuid)
                .and(org_id.eq(&organisation))
                .and(app_id.eq(&application)),
        )
        .first::<ReleaseEntry>(&mut conn)
        .map_err(|_| error::ErrorNotFound("Release not found"))?;

    let experiment_id = release
        .metadata
        .get("experiment_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| error::ErrorBadRequest("No experiment associated with this release"))?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;

    let experiment_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .id(experiment_id.to_string())
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to get experiment details: {:?}", e);
            error::ErrorInternalServerError("Failed to get experiment details from Superposition")
        })?;

    let transformed_variant_id = experiment_details
        .variants
        .iter()
        .find(|variant| {
            let matches = variant.id.ends_with(&format!("-{}", req.chosen_variant));
            matches
        })
        .map(|variant| variant.id.clone())
        .ok_or_else(|| {
            error::ErrorBadRequest(format!(
                "Variant '{}' not found in experiment. Available variants: {:?}",
                req.chosen_variant,
                experiment_details
                    .variants
                    .iter()
                    .map(|v| &v.id)
                    .collect::<Vec<_>>()
            ))
        })?;

    println!(
        "Concluding experiment {} with transformed variant {} (original: {}) for release {}",
        experiment_id, transformed_variant_id, req.chosen_variant, release_id
    );

    state
        .superposition_client
        .conclude_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(experiment_id.to_string())
        .chosen_variant(transformed_variant_id.clone())
        .change_reason(req.change_reason.clone().unwrap_or_else(|| {
            format!(
                "Concluding release {} with variant {}",
                release_id, req.chosen_variant
            )
        }))
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to conclude experiment: {:?}", e);
            error::ErrorInternalServerError("Failed to conclude experiment in Superposition")
        })?;

    println!(
        "Successfully concluded experiment {} with variant {}",
        experiment_id, transformed_variant_id
    );

    Ok(Json(ConcludeReleaseResponse {
        success: true,
        message: format!(
            "Release experiment concluded with variant {}",
            req.chosen_variant
        ),
        experiment_id: experiment_id.to_string(),
        chosen_variant: req.chosen_variant.clone(),
    }))
}

#[get("/experiment/{experiment_id}")]
async fn get_experiment_details(
    experiment_id: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ExperimentDetailsResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, READ).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, READ).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;

    let experiment_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(experiment_id.to_string())
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to get experiment details: {:?}", e);
            error::ErrorInternalServerError("Failed to get experiment details from Superposition")
        })?;

    let variants = experiment_details
        .variants
        .iter()
        .map(|variant| {
            let variant_type_str = match variant.variant_type {
                superposition_rust_sdk::types::VariantType::Control => "control",
                superposition_rust_sdk::types::VariantType::Experimental => "experimental",
                _ => "unknown",
            };

            ExperimentVariant {
                id: variant.id.clone(),
                name: if variant_type_str == "control" {
                    "Control (Original)".to_string()
                } else {
                    format!("Experimental ({})", variant.id)
                },
                variant_type: variant_type_str.to_string(),
            }
        })
        .collect();

    let status_str = match experiment_details.status {
        superposition_rust_sdk::types::ExperimentStatusType::Created => "CREATED",
        superposition_rust_sdk::types::ExperimentStatusType::Inprogress => "INPROGRESS",
        superposition_rust_sdk::types::ExperimentStatusType::Concluded => "CONCLUDED",
        superposition_rust_sdk::types::ExperimentStatusType::Discarded => "DISCARDED",
        _ => "UNKNOWN",
    };

    Ok(Json(ExperimentDetailsResponse {
        experiment_id: experiment_id.to_string(),
        traffic_percentage: experiment_details.traffic_percentage,
        status: status_str.to_string(),
        variants,
    }))
}

async fn invalidate_cf(
    client: &aws_sdk_cloudfront::Client,
    path: String,
    distribution_id: &str,
) -> Result<(), aws_sdk_cloudfront::Error> {
    // Make this unique on each call
    let caller_reference = format!(
        "invalidate-{}",
        Utc::now()
            .timestamp_nanos_opt()
            .unwrap_or(rand::random::<i64>())
    );

    let paths = aws_sdk_cloudfront::types::Paths::builder()
        .items(path)
        .quantity(1)
        .build()?;

    let batch = aws_sdk_cloudfront::types::InvalidationBatch::builder()
        .caller_reference(caller_reference)
        .paths(paths)
        .build()?;

    let resp = client
        .create_invalidation()
        .distribution_id(distribution_id)
        .invalidation_batch(batch)
        .send()
        .await?;

    resp.invalidation()
        .map(|inv| {
            println!("Invalidation created: {:?}", inv.id);
        })
        .unwrap_or_else(|| {
            println!("Invalidation created but no ID returned");
        });

    Ok(())
}
