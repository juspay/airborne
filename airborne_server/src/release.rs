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

use crate::{
    file::utils::parse_file_key,
    middleware::auth::{require_org_and_app, Auth, AuthResponse},
    release::types::*,
    run_blocking, types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::{
        db::{models::ReleaseViewEntry, schema::hyperotaserver::release_views},
        document::dotted_docs_to_nested,
        release_view::{self, ReleaseViewType},
        workspace::get_workspace_name_for_application,
    },
};
use actix_web::{
    error, get, post, put,
    web::{self, Json, Path, Query},
    Scope,
};
use airborne_authz_macros::authz;
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use http::{HeaderValue, StatusCode};
use log::info;
use open_feature::EvaluationContext;
use serde_json::Value;
use std::{collections::HashMap, sync::Arc};
use superposition_provider::{AllFeatureProvider, SuperpositionAPIProvider};
use superposition_sdk::types::builders::{VariantBuilder, VariantUpdateRequestBuilder};
use superposition_sdk::types::ExperimentStatusType;
use superposition_sdk::types::VariantType::Experimental;
pub mod types;
pub mod utils;

/// Every release experiment is named `<app>-<org>-release-exp`; a delete release adds this suffix
/// so it is recognisable in Superposition's own tooling.
const DELETE_RELEASE_NAME_SUFFIX: &str = "-delete";

/// A deletion is a DELETE_OVERRIDES experiment: concluding it drops the slice's overrides instead
/// of writing new ones. That type is what produces the behaviour, so it is also what identifies it.
fn is_delete_experiment(experiment_type: &superposition_sdk::types::ExperimentType) -> bool {
    *experiment_type == superposition_sdk::types::ExperimentType::DeleteOverrides
}

/// Whether a release was reverted: concluded on its control variant, so the pre-release
/// configuration was kept rather than the new one being rolled out. Superposition records which
/// variant won, so this needs no bookkeeping of ours and holds for releases concluded long ago.
fn is_reverted_conclusion(
    status: &ExperimentStatusType,
    variants: &[superposition_sdk::types::Variant],
    chosen_variant: Option<&str>,
) -> bool {
    *status == ExperimentStatusType::Concluded
        && chosen_variant.is_some_and(|chosen| {
            variants.iter().any(|variant| {
                variant.id == chosen
                    && variant.variant_type == superposition_sdk::types::VariantType::Control
            })
        })
}

fn is_experimental_variant(
    variants: &[superposition_sdk::types::Variant],
    variant_id: &str,
) -> bool {
    variants
        .iter()
        .any(|variant| variant.id == variant_id && variant.variant_type == Experimental)
}

/// A delete release carries a snapshot of the default config, so a global release must not be
/// created while one is in flight: whichever concluded second would leave the slice pinned to a
/// stale default. Markers left behind by out-of-band Superposition activity are reconciled here
/// rather than blocking global releases forever.
async fn ensure_no_pending_deletion(
    organisation: &str,
    application: &str,
    workspace_name: &str,
    superposition_org_id: &str,
    state: &web::Data<AppState>,
) -> airborne_types::Result<()> {
    let in_progress = |view_name: &str| {
        ABError::BadRequest(format!(
            "A release deletion is in progress for '{}'. Conclude or discard it before creating a global release.",
            view_name
        ))
    };

    let pending = release_view::pending_delete_releases(
        state.db_pool.clone(),
        organisation.to_string(),
        application.to_string(),
    )
    .await?;

    for (_, view_name, release_id) in pending {
        let experiment = match state
            .superposition_client
            .get_experiment()
            .org_id(superposition_org_id.to_string())
            .workspace_id(workspace_name.to_string())
            .id(release_id.clone())
            .send()
            .await
        {
            Ok(experiment) => experiment,
            Err(e) => {
                info!(
                    "Failed to fetch pending delete release {}: {:?}",
                    release_id, e
                );
                return Err(in_progress(&view_name));
            }
        };

        if matches!(
            experiment.status,
            ExperimentStatusType::Created | ExperimentStatusType::Inprogress
        ) {
            return Err(in_progress(&view_name));
        }

        let deletion_applied = experiment.status == ExperimentStatusType::Concluded
            && experiment
                .chosen_variant
                .as_deref()
                .map(|chosen| is_experimental_variant(&experiment.variants, chosen))
                .unwrap_or(false);

        info!(
            "Reconciling delete release {} settled outside the API (applied: {})",
            release_id, deletion_applied
        );
        release_view::settle_pending_delete(
            state.db_pool.clone(),
            organisation.to_string(),
            application.to_string(),
            release_id,
            deletion_applied,
        )
        .await?;
    }

    Ok(())
}

fn encode_url_path(raw_url: &str) -> String {
    match url::Url::parse(raw_url) {
        Ok(parsed) => {
            let encoded_path = parsed
                .path_segments()
                .map(|segments| {
                    segments
                        .map(|s| urlencoding::encode(s).into_owned())
                        .collect::<Vec<_>>()
                        .join("/")
                })
                .unwrap_or_default();

            let mut result = format!("{}://{}", parsed.scheme(), parsed.host_str().unwrap_or(""));
            if let Some(port) = parsed.port() {
                result.push_str(&format!(":{}", port));
            }
            result.push('/');
            result.push_str(&encoded_path);
            if let Some(query) = parsed.query() {
                result.push('?');
                result.push_str(query);
            }
            if let Some(fragment) = parsed.fragment() {
                result.push('#');
                result.push_str(fragment);
            }
            result
        }
        Err(_) => raw_url.to_string(),
    }
}

pub fn add_routes(path: &str) -> Scope {
    Scope::new(path).service(serve_release).service(
        Scope::new("")
            .wrap(Auth)
            .service(create_release)
            .service(list_releases)
            .service(delete_release_for_view)
            .service(ramp_release)
            .service(conclude_release)
            .service(get_release)
            .service(update_release)
            .service(discard_release),
    )
}

pub fn add_public_routes() -> Scope {
    Scope::new("")
        .service(serve_release)
        .service(serve_release_v2)
}

#[authz(
    resource = "release",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{release_id}")]
async fn get_release(
    release_id: Path<String>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<GetReleaseResponse>> {
    let release_key = release_id.into_inner();
    if release_key.is_empty() {
        return Err(ABError::BadRequest(
            "Release Key cannot be empty".to_string(),
        ));
    }

    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|_| ABError::InternalServerError("Failed to get workspace name".to_string()))?;

    let exp_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(release_key.clone())
        .send()
        .await
        .map_err(|e| {
            info!("Failed to get experiment details: {:?}", e);
            ABError::NotFound("Release/Experiment not found".to_string())
        })?;

    let experimental_variant = exp_details
        .variants
        .iter()
        .find(|v| v.variant_type == superposition_sdk::types::VariantType::Experimental);

    let package_version =
        utils::extract_integer_from_experiment::<i64>(&experimental_variant, "package.version");

    let package_properties = experimental_variant
        .map(|v| &v.overrides)
        .and_then(|obj| obj.get("package.properties"))
        .and_then(utils::document_to_value)
        .unwrap_or_default();

    let rc_properties = experimental_variant
        .map(|v| &v.overrides)
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| {
                    let key = k.clone();
                    if key.starts_with("config.properties.") {
                        let key = key
                            .strip_prefix("config.properties.")
                            .unwrap_or(&key)
                            .to_string();
                        Some((key, v.to_owned()))
                    } else {
                        None
                    }
                })
                .collect::<HashMap<String, Document>>()
        })
        .unwrap_or_default();

    let rc_package_important =
        utils::extract_files_from_experiment(&experimental_variant, "package.important");
    let rc_package_lazy =
        utils::extract_files_from_experiment(&experimental_variant, "package.lazy");
    let rc_resources = utils::extract_files_from_experiment(&experimental_variant, "resources");
    let rc_index = utils::extract_file_from_experiment(&experimental_variant, "package.index");
    let rc_version = utils::extract_string_from_experiment(&experimental_variant, "config.version");
    let rc_boot_timeout =
        utils::extract_integer_from_experiment::<i64>(&experimental_variant, "config.boot_timeout");
    let rc_release_config_timeout = utils::extract_integer_from_experiment::<i64>(
        &experimental_variant,
        "config.release_config_timeout",
    );

    let (index_file, important_files, lazy_files, resource_files) = {
        let all_files = rc_package_important
            .iter()
            .chain(rc_package_lazy.iter())
            .chain(rc_resources.iter())
            .chain([rc_index.clone()].iter())
            .cloned()
            .collect::<Vec<String>>();

        let files_result = utils::get_files_by_file_keys_async(
            state.db_pool.clone(),
            &state.redis_cache,
            organisation.clone(),
            application.clone(),
            all_files,
        )
        .await;

        if let Ok(files) = files_result {
            let important_files: Vec<ServeFile> = rc_package_important
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect();
            info!("Important files: {:?}", important_files);

            let lazy_files: Vec<ServeFile> = rc_package_lazy
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect();

            let resource_files: Vec<Resource> = rc_resources
                .iter()
                .filter_map(|file_key| {
                    let file_key_cloned = file_key.clone();
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| Resource {
                            file_id: file_key_cloned,
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect();

            let index_file: ServeFile = {
                let (file_path, _, _) = parse_file_key(&rc_index);
                files
                    .iter()
                    .find(|file| file.file_path == file_path.clone())
                    .map(|file| ServeFile {
                        file_path: file.file_path.clone(),
                        url: encode_url_path(&file.url),
                        checksum: file.checksum.clone(),
                        size: file.size,
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: String::new(),
                        checksum: String::new(),
                        size: 0,
                    })
            };

            info!("Lazy files: {:?}", lazy_files);

            (index_file, important_files, lazy_files, resource_files)
        } else {
            (
                ServeFile {
                    file_path: String::new(),
                    url: String::new(),
                    checksum: String::new(),
                    size: 0,
                },
                Vec::new(),
                Vec::new(),
                Vec::new(),
            )
        }
    };

    let nested_config_props_result = dotted_docs_to_nested(rc_properties);
    let nested_config_props_response = nested_config_props_result.unwrap_or_else(|err| {
        info!(
            "Failed to convert dotted docs to nested structure: {:?}",
            err
        );
        Value::Object(serde_json::Map::new())
    });

    let resp = GetReleaseResponse {
        id: release_key.clone(),
        is_delete_release: is_delete_experiment(&exp_details.experiment_type),
        is_reverted: is_reverted_conclusion(
            &exp_details.status,
            &exp_details.variants,
            exp_details.chosen_variant.as_deref(),
        ),
        created_at: DateTime::parse_from_rfc3339(&utils::dt(&exp_details.created_at))
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|_| ABError::InternalServerError("Failed to parse created_at".to_string()))?,
        config: Config {
            boot_timeout: rc_boot_timeout as u32,
            release_config_timeout: rc_release_config_timeout as u32,
            version: rc_version,
            properties: Some(nested_config_props_response),
        },
        package: ServePackage {
            name: application.clone(),
            version: package_version.to_string(),
            index: index_file,
            properties: package_properties,
            important: important_files,
            lazy: lazy_files,
        },
        resources: resource_files,
        experiment: Some(ReleaseExperiment {
            experiment_id: release_key,
            experiment_variants: utils::extract_variants_from_experiment(&exp_details.variants),
            package_version: package_version as i32,
            config_version: format!("v{}", package_version),
            created_at: utils::dt(&exp_details.created_at),
            traffic_percentage: exp_details.traffic_percentage as u32,
            status: match exp_details.status {
                superposition_sdk::types::ExperimentStatusType::Created => "CREATED".to_string(),
                superposition_sdk::types::ExperimentStatusType::Inprogress => {
                    "INPROGRESS".to_string()
                }
                superposition_sdk::types::ExperimentStatusType::Concluded => {
                    "CONCLUDED".to_string()
                }
                superposition_sdk::types::ExperimentStatusType::Discarded => {
                    "DISCARDED".to_string()
                }
                _ => "UNKNOWN".to_string(),
            },
        }),
        dimensions: exp_details
            .context
            .iter()
            .map(|(k, v)| {
                (
                    k.clone(),
                    utils::document_to_value(v).unwrap_or(Value::Null),
                )
            })
            .collect(),
    };

    Ok(Json(resp))
}

#[authz(
    resource = "release",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("")]
async fn create_release(
    req: Json<CreateReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let dimensions = req.dimensions.clone().unwrap_or_default();

    utils::validate_dimensions_exist(
        superposition_org_id_from_env.clone(),
        &dimensions,
        state.clone(),
        workspace_name.clone(),
    )
    .await?;

    if dimensions.is_empty() {
        ensure_no_pending_deletion(
            &organisation,
            &application,
            &workspace_name,
            &superposition_org_id_from_env,
            &state,
        )
        .await?;
    }

    if utils::check_non_concluded_releases(
        superposition_org_id_from_env.clone(),
        dimensions.clone(),
        state.clone(),
        workspace_name.clone(),
    )
    .await?
    {
        return Err(ABError::BadRequest(
            "There is already an ongoing release for the given dimensions. Please conclude it before creating a new release."
                .to_string(),
        ));
    }

    let BuildOverrides {
        final_important,
        package_data,
        is_first_release,
        final_lazy,
        final_resources,
        config_version,
        config_properties,
        pkg_version,
        files,
        final_properties,
        control_overrides,
        experimental_overrides,
    } = utils::build_overrides(
        &req,
        superposition_org_id_from_env.clone(),
        application.clone(),
        organisation.clone(),
        dimensions.clone(),
        state.clone(),
        workspace_name.clone(),
    )
    .await?;

    let control_variant = VariantBuilder::default()
        .id("control".to_string())
        .variant_type(superposition_sdk::types::VariantType::Control)
        .set_overrides(Some(control_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let experimental_variant_id = format!("experimental_{}", pkg_version);

    let experimental_variant = VariantBuilder::default()
        .id(experimental_variant_id.clone())
        .variant_type(superposition_sdk::types::VariantType::Experimental)
        .set_overrides(Some(experimental_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let created_experiment_response = state
        .superposition_client
        .create_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .name(format!("{}-{}-release-exp", application, organisation))
        .experiment_type(superposition_sdk::types::ExperimentType::Default)
        .description(format!(
            "Release experiment for application {} in organisation {} with package version {}",
            application, organisation, pkg_version
        ))
        .change_reason(format!(
            "Release creation for application {} with PATCH-style overrides",
            application
        ))
        .variants(control_variant.clone())
        .variants(experimental_variant.clone());

    let created_experiment_response = created_experiment_response.set_context(Some(
        req.dimensions
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k.clone(), utils::value_to_document(&v)))
            .collect::<HashMap<_, _>>(),
    ));

    let created_experiment_response = created_experiment_response.send().await.map_err(|e| {
        info!("Failed to create experiment: {:?}", e);
        ABError::InternalServerError("Failed to create experiment in Superposition".to_string())
    })?;

    let experiment_id_for_ramping = created_experiment_response.id.to_string();

    let response_important = final_important.unwrap_or_else(|| {
        package_data
            .files
            .iter()
            .filter_map(|f| f.as_ref().cloned())
            .collect()
    });

    if is_first_release {
        // For first ever release -> Directly conclude the experiment to make it live
        let transformed_variant_id = format!("{}-experimental_1", experiment_id_for_ramping);
        info!(
            "Concluding first release experiment with variant id: {}",
            transformed_variant_id
        );
        ramp_experiment(
            &state,
            &workspace_name,
            &experiment_id_for_ramping,
            50,
            &Some("Ramping first release experiment to 50%".to_string()),
        )
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;
        let _ = state
            .superposition_client
            .conclude_experiment()
            .org_id(superposition_org_id_from_env.clone())
            .workspace_id(workspace_name.clone())
            .id(experiment_id_for_ramping.clone())
            .chosen_variant(transformed_variant_id.clone())
            .change_reason("Concluding first release experiment to make it live".to_string())
            .send()
            .await
            .map_err(|e| {
                info!("Failed to conclude first release experiment: {:?}", e);
                error::ErrorInternalServerError("Failed to conclude experiment".to_string())
            });
    }

    let response_lazy = final_lazy.unwrap_or_default();

    let response_resources = final_resources.unwrap_or_default();

    let path = format!("/release/{}/{}*", organisation.clone(), application.clone());

    if let Err(e) = utils::invalidate_cf(
        &state.cf_client,
        path,
        &state.env.cloudfront_distribution_id,
    )
    .await
    {
        info!("Failed to invalidate CloudFront cache: {:?}", e);
    }

    // Best-effort: make this release's dimension slice browsable as a view. The release already
    // exists at this point, so a failure here must not fail the request.
    match crate::utils::release_view::ensure_auto_generated_view(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        &dimensions,
    )
    .await
    {
        Ok(Some(view)) => info!("Created auto-generated release view '{}'", view.name),
        Ok(None) => {}
        Err(e) => info!("Failed to create auto-generated release view: {:?}", e),
    }

    let now = Utc::now();
    let nested_config_props_result = dotted_docs_to_nested(config_properties.clone());
    let nested_config_props_response = nested_config_props_result.unwrap_or_else(|err| {
        info!(
            "Failed to convert dotted docs to nested structure: {:?}",
            err
        );
        Value::Object(serde_json::Map::new())
    });

    Ok(Json(CreateReleaseResponse {
        id: experiment_id_for_ramping.clone(),
        created_at: now,
        is_delete_release: is_delete_experiment(&created_experiment_response.experiment_type),
        is_reverted: false,
        config: Config {
            boot_timeout: req.config.boot_timeout as u32,
            release_config_timeout: req.config.release_config_timeout as u32,
            version: config_version.clone(),
            properties: Some(nested_config_props_response),
        },
        package: ServePackage {
            name: application.clone(),
            version: pkg_version.to_string(),
            index: {
                let (file_path, _, _) = parse_file_key(&package_data.index);
                files
                    .iter()
                    .find(|file| file.file_path == file_path.clone())
                    .map(|file| ServeFile {
                        file_path: file.file_path.clone(),
                        url: encode_url_path(&file.url),
                        checksum: file.checksum.clone(),
                        size: file.size,
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: "".to_string(),
                        checksum: "".to_string(),
                        size: 0,
                    })
            },
            properties: final_properties.unwrap_or_default(),
            important: response_important
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect(),
            lazy: response_lazy
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect(),
        },
        resources: response_resources
            .iter()
            .filter_map(|file_key| {
                let (file_path, _, _) = parse_file_key(file_key);
                files
                    .iter()
                    .find(|file| file.file_path == file_path.clone())
                    .map(|file| ServeFile {
                        file_path: file.file_path.clone(),
                        url: encode_url_path(&file.url),
                        checksum: file.checksum.clone(),
                        size: file.size,
                    })
            })
            .collect(),
        dimensions: dimensions.clone(),
        experiment: Some(ReleaseExperiment {
            experiment_id: experiment_id_for_ramping,
            experiment_variants: ExperimentVariants {
                control: control_variant.id,
                experimentals: vec![experimental_variant.id],
            },
            package_version: pkg_version,
            config_version: format!("v{}", pkg_version),
            created_at: now.to_string(),
            traffic_percentage: 0, // Default to 100% for new releases
            status: "CREATED".to_string(),
        }),
    }))
}

#[authz(
    resource = "release",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/list")]
async fn list_releases(
    pagination_query: Query<PaginatedQuery>,
    release_query: Query<ListReleaseQuery>,
    req: actix_web::HttpRequest,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<CreateReleaseResponse>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    let status = release_query.status.clone().map(|s| s.into());

    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(utils::parse_kv_string)
        .unwrap_or_default();

    let mut query = ListExperimentsQuery {
        superposition_org_id: superposition_org_id_from_env.clone(),
        workspace_name: workspace_name.clone(),
        context,
        strict_mode: false,
        page: None,
        count: None,
        all: false,
        status,
        // Superposition applies this before paging, so a page cannot come back short and
        // `total_items` counts releases rather than every experiment in the workspace.
        experiment_name: Some(format!("{}-{}-release-exp", application, organisation)),
    };

    match *pagination_query {
        PaginatedQuery::All => {
            query.all = true;
        }
        PaginatedQuery::Paginated { page: p, count: c } => {
            query.page = Some(p.into());
            query.count = Some(c.into());
        }
    }

    let experiments_list = utils::list_experiments_by_context(query, state.clone()).await?;

    let release_experiments = experiments_list.data();

    let mut releases = Vec::new();

    for experiment in release_experiments {
        let experimental_variant = experiment
            .variants
            .iter()
            .find(|v| v.variant_type == superposition_sdk::types::VariantType::Experimental);

        let package_version =
            utils::extract_integer_from_experiment::<i64>(&experimental_variant, "package.version")
                as i32;

        let rc_package_properties = experimental_variant
            .map(|v| &v.overrides)
            .and_then(|obj| obj.get("package.properties"))
            .and_then(utils::document_to_value)
            .unwrap_or_default();

        let dimensions: HashMap<String, Value> = experiment
            .context
            .iter()
            .map(|(k, v)| {
                (
                    k.clone(),
                    utils::document_to_value(v).unwrap_or(Value::Null),
                )
            })
            .collect();

        let rc_package_important =
            utils::extract_files_from_experiment(&experimental_variant, "package.important");
        let rc_package_lazy =
            utils::extract_files_from_experiment(&experimental_variant, "package.lazy");
        let rc_resources = utils::extract_files_from_experiment(&experimental_variant, "resources");
        let rc_index = utils::extract_file_from_experiment(&experimental_variant, "package.index");
        let rc_version =
            utils::extract_string_from_experiment(&experimental_variant, "config.version");
        let rc_boot_timeout = utils::extract_integer_from_experiment::<i64>(
            &experimental_variant,
            "config.boot_timeout",
        );
        let rc_release_config_timeout = utils::extract_integer_from_experiment::<i64>(
            &experimental_variant,
            "config.release_config_timeout",
        );
        let rc_config_properties = experimental_variant
            .map(|v| &v.overrides)
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| {
                        let key = k.clone();
                        if key.starts_with("config.properties.") {
                            let key = key
                                .strip_prefix("config.properties.")
                                .unwrap_or(&key)
                                .to_string();
                            Some((key, v.to_owned()))
                        } else {
                            None
                        }
                    })
                    .collect::<HashMap<String, Document>>()
            })
            .unwrap_or_default();

        info!("Resources files: {:?}", rc_resources);

        let (index_file, important_files, lazy_files, resource_files) = {
            let all_files = rc_package_important
                .iter()
                .chain(rc_package_lazy.iter())
                .chain(rc_resources.iter())
                .chain([rc_index.clone()].iter())
                .cloned()
                .collect::<Vec<String>>();

            let files_result = utils::get_files_by_file_keys_async(
                state.db_pool.clone(),
                &state.redis_cache,
                organisation.clone(),
                application.clone(),
                all_files.clone(),
            )
            .await;

            if let Ok(files) = files_result {
                let important_files: Vec<ServeFile> = rc_package_important
                    .iter()
                    .filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files
                            .iter()
                            .find(|file| file.file_path == file_path.clone())
                            .map(|file| ServeFile {
                                file_path: file.file_path.clone(),
                                url: encode_url_path(&file.url),
                                checksum: file.checksum.clone(),
                                size: file.size,
                            })
                    })
                    .collect();
                info!("Important files: {:?}", important_files);

                let lazy_files: Vec<ServeFile> = rc_package_lazy
                    .iter()
                    .filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files
                            .iter()
                            .find(|file| file.file_path == file_path.clone())
                            .map(|file| ServeFile {
                                file_path: file.file_path.clone(),
                                url: encode_url_path(&file.url),
                                checksum: file.checksum.clone(),
                                size: file.size,
                            })
                    })
                    .collect();

                let resource_files: Vec<ServeFile> = rc_resources
                    .iter()
                    .filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files
                            .iter()
                            .find(|file| file.file_path == file_path.clone())
                            .map(|file| ServeFile {
                                file_path: file.file_path.clone(),
                                url: encode_url_path(&file.url),
                                checksum: file.checksum.clone(),
                                size: file.size,
                            })
                    })
                    .collect();

                let index_file: ServeFile = {
                    let (file_path, _, _) = parse_file_key(&rc_index);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                        .unwrap_or_else(|| ServeFile {
                            file_path: file_path.clone(),
                            url: String::new(),
                            checksum: String::new(),
                            size: 0,
                        })
                };

                info!("Lazy files: {:?}", lazy_files);

                (index_file, important_files, lazy_files, resource_files)
            } else {
                (
                    ServeFile {
                        file_path: String::new(),
                        url: String::new(),
                        checksum: String::new(),
                        size: 0,
                    },
                    Vec::new(),
                    Vec::new(),
                    Vec::new(),
                )
            }
        };

        info!("Important files: {:?}", important_files);
        info!("Lazy files: {:?}", lazy_files);

        // Parse created_at string to DateTime<Utc>
        let created_at_str = utils::dt(&experiment.created_at);
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .unwrap_or_else(|_| Utc::now().into())
            .with_timezone(&Utc);

        let nested_config_props_result = dotted_docs_to_nested(rc_config_properties);
        let nested_config_props_response = nested_config_props_result.unwrap_or_else(|err| {
            info!(
                "Failed to convert dotted docs to nested structure: {:?}",
                err
            );
            Value::Object(serde_json::Map::new())
        });

        let release_response = CreateReleaseResponse {
            id: experiment.id.to_string(),
            created_at,
            is_delete_release: is_delete_experiment(&experiment.experiment_type),
            is_reverted: is_reverted_conclusion(
                &experiment.status,
                &experiment.variants,
                experiment.chosen_variant.as_deref(),
            ),
            config: Config {
                boot_timeout: rc_boot_timeout as u32,
                release_config_timeout: rc_release_config_timeout as u32,
                version: rc_version,
                properties: Some(nested_config_props_response),
            },
            package: ServePackage {
                name: application.clone(),
                version: package_version.to_string(),
                index: index_file,
                properties: rc_package_properties,
                important: important_files,
                lazy: lazy_files,
            },
            resources: resource_files,
            dimensions,
            experiment: Some(utils::build_release_experiment_from_experiment(
                experiment,
                package_version,
            )),
        };

        releases.push(release_response);
    }

    Ok(Json(PaginatedResponse {
        data: releases,
        total_items: experiments_list.total_items as u64,
        total_pages: experiments_list.total_pages as u32,
    }))
}

/// Deletes the release covering a dimension slice by shipping a release that carries the default,
/// dimension-less config. Nothing is removed from Superposition — once this concludes on its
/// experimental variant the slice resolves exactly as the global release does, and the
/// auto-generated view that tracked the slice is dropped.
#[authz(
    resource = "release",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/views/{view_id}/delete")]
async fn delete_release_for_view(
    path: Path<String>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateDeleteReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let view_id = uuid::Uuid::parse_str(&path.into_inner())
        .map_err(|_| ABError::BadRequest("Invalid view_id format".to_string()))?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let view = {
        let pool = state.db_pool.clone();
        let org = organisation.clone();
        let app = application.clone();

        run_blocking!({
            let mut conn = pool.get()?;
            release_views::table
                .filter(release_views::app_id.eq(&app))
                .filter(release_views::org_id.eq(&org))
                .filter(release_views::id.eq(&view_id))
                .first::<ReleaseViewEntry>(&mut conn)
                .optional()
                .map_err(|e| ABError::InternalServerError(format!("Failed to fetch view: {}", e)))?
                .ok_or_else(|| ABError::NotFound("View not found".to_string()))
        })?
    };

    if ReleaseViewType::from(view.view_type.as_str()) != ReleaseViewType::AutoGenerated {
        return Err(ABError::BadRequest(
            "Only auto-generated views track a released dimension slice and can be deleted"
                .to_string(),
        ));
    }

    if let Some(pending) = &view.pending_delete_release_id {
        return Err(ABError::BadRequest(format!(
            "A deletion is already in progress for this view (release {})",
            pending
        )));
    }

    let dimensions = release_view::view_dimensions_to_context(&view.dimensions);

    if dimensions.is_empty() {
        return Err(ABError::BadRequest(
            "The default release has no dimensions to fall back to and cannot be deleted"
                .to_string(),
        ));
    }

    if utils::check_non_concluded_releases(
        superposition_org_id_from_env.clone(),
        dimensions.clone(),
        state.clone(),
        workspace_name.clone(),
    )
    .await?
    {
        return Err(ABError::BadRequest(
            "There is already an ongoing release for the given dimensions. Please conclude it before deleting."
                .to_string(),
        ));
    }

    if utils::check_non_concluded_releases(
        superposition_org_id_from_env.clone(),
        HashMap::new(),
        state.clone(),
        workspace_name.clone(),
    )
    .await?
    {
        return Err(ABError::BadRequest(
            "A global release is in progress. Conclude or discard it first so this deletion previews the final default config."
                .to_string(),
        ));
    }

    if !utils::slice_has_override(
        superposition_org_id_from_env.clone(),
        &dimensions,
        state.clone(),
        workspace_name.clone(),
    )
    .await?
    {
        return Err(ABError::BadRequest(
            "These dimensions have no configuration of their own, so there is nothing to delete"
                .to_string(),
        ));
    }

    let control_overrides = utils::config_document_to_overrides(
        &utils::resolve_config_document(
            superposition_org_id_from_env.clone(),
            &dimensions,
            state.clone(),
            workspace_name.clone(),
        )
        .await?,
    )?;

    let experimental_overrides = utils::config_document_to_overrides(
        &utils::resolve_config_document(
            superposition_org_id_from_env.clone(),
            &HashMap::new(),
            state.clone(),
            workspace_name.clone(),
        )
        .await?,
    )?;

    let control_variant = VariantBuilder::default()
        .id("control".to_string())
        .variant_type(superposition_sdk::types::VariantType::Control)
        .set_overrides(Some(control_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let experimental_variant = VariantBuilder::default()
        .id("experimental_delete".to_string())
        .variant_type(Experimental)
        .set_overrides(Some(experimental_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let created_experiment_response = state
        .superposition_client
        .create_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .name(format!(
            "{}-{}-release-exp{}",
            application, organisation, DELETE_RELEASE_NAME_SUFFIX
        ))
        .experiment_type(superposition_sdk::types::ExperimentType::DeleteOverrides)
        .description(format!(
            "Deleting the release overrides for view '{}'",
            view.name
        ))
        .change_reason(format!(
            "Deleting targeted release overrides for application {}",
            application
        ))
        .variants(control_variant)
        .variants(experimental_variant)
        .set_context(Some(
            dimensions
                .iter()
                .map(|(k, v)| (k.clone(), utils::value_to_document(v)))
                .collect::<HashMap<_, _>>(),
        ))
        .send()
        .await
        .map_err(|e| {
            info!("Failed to create delete release experiment: {:?}", e);
            ABError::InternalServerError("Failed to create experiment in Superposition".to_string())
        })?;

    let release_id = created_experiment_response.id.to_string();

    release_view::mark_delete_release_pending(state.db_pool.clone(), view.id, release_id.clone())
        .await?;

    Ok(Json(CreateDeleteReleaseResponse {
        release_id,
        view_id: view.id,
        dimensions,
        status: "CREATED".to_string(),
    }))
}

#[authz(
    resource = "release",
    action = "ramp",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{release_id}/ramp")]
async fn ramp_release(
    release_id: Path<String>,
    req: Json<RampReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<RampReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    info!(
        "Ramping experiment {} to {}% traffic for release {} in workspace {} org {}",
        experiment_id,
        req.traffic_percentage,
        release_id,
        workspace_name,
        superposition_org_id_from_env
    );

    ramp_experiment(
        &state,
        &workspace_name,
        &experiment_id,
        req.traffic_percentage as i32,
        &req.change_reason,
    )
    .await
    .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    info!("Successfully ramped experiment {}", experiment_id);

    let path = format!("/release/{}/{}*", organisation.clone(), application.clone());

    if let Err(e) = utils::invalidate_cf(
        &state.cf_client,
        path,
        &state.env.cloudfront_distribution_id,
    )
    .await
    {
        info!("Failed to invalidate CloudFront cache: {:?}", e);
    }

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

async fn ramp_experiment(
    state: &AppState,
    workspace_name: &String,
    experiment_id: &String,
    traffic_percentage: i32,
    change_reason: &Option<String>,
) -> airborne_types::Result<()> {
    state
        .superposition_client
        .ramp_experiment()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name)
        .id(experiment_id.to_string())
        .traffic_percentage(traffic_percentage)
        .change_reason(change_reason.clone().unwrap_or_else(|| {
            format!(
                "Ramping release {} to {}% traffic",
                experiment_id, traffic_percentage
            )
        }))
        .send()
        .await
        .map_err(|e| {
            info!("Failed to ramp experiment: {:?}", e);
            ABError::InternalServerError("Failed to ramp experiment in Superposition".to_owned())
        })?;
    Ok(())
}

#[authz(
    resource = "release",
    action = "conclude",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{release_id}/conclude")]
async fn conclude_release(
    release_id: Path<String>,
    req: Json<ConcludeReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ConcludeReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    let experiment_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .id(experiment_id.to_string())
        .send()
        .await
        .map_err(|e| {
            info!("Failed to get experiment details: {:?}", e);
            ABError::InternalServerError(
                "Failed to get experiment details from Superposition".to_string(),
            )
        })?;

    let transformed_variant_id = experiment_details
        .variants
        .iter()
        .find(|variant| variant.id == req.chosen_variant)
        .map(|variant| variant.id.clone())
        .ok_or_else(|| {
            ABError::BadRequest(format!(
                "Variant '{}' not found in experiment. Available variants: {:?}",
                req.chosen_variant,
                experiment_details
                    .variants
                    .iter()
                    .map(|v| &v.id)
                    .collect::<Vec<_>>()
            ))
        })?;

    info!(
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
            info!("Failed to conclude experiment: {:?}", e);
            ABError::InternalServerError(
                "Failed to conclude experiment in Superposition".to_string(),
            )
        })?;

    info!(
        "Successfully concluded experiment {} with variant {}",
        experiment_id, transformed_variant_id
    );

    // If this was a delete release, its view goes away only when the deletion actually took effect;
    // concluding on control means the slice kept its overrides. Best-effort — the conclude already
    // happened in Superposition, so a bookkeeping failure must not fail the request.
    if let Err(e) = release_view::settle_pending_delete(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        experiment_id.clone(),
        is_experimental_variant(&experiment_details.variants, &transformed_variant_id),
    )
    .await
    {
        info!("Failed to settle pending release view deletion: {:?}", e);
    }

    let path = format!("/release/{}/{}*", organisation.clone(), application.clone());

    if let Err(e) = utils::invalidate_cf(
        &state.cf_client,
        path,
        &state.env.cloudfront_distribution_id,
    )
    .await
    {
        info!("Failed to invalidate CloudFront cache: {:?}", e);
    }

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

#[authz(
    resource = "release",
    action = "discard",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{release_id}/discard")]
async fn discard_release(
    release_id: Path<String>,
    req: Json<DiscardReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DiscardReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    let experiment_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .id(experiment_id.to_string())
        .send()
        .await
        .map_err(|e| {
            info!("Failed to get experiment details: {:?}", e);
            ABError::InternalServerError(
                "Failed to get experiment details from Superposition".to_string(),
            )
        })?;

    if experiment_details.status != ExperimentStatusType::Created {
        return Err(ABError::BadRequest(
            "Release can only be discarded when in CREATED status".to_string(),
        ));
    }

    state
        .superposition_client
        .discard_experiment()
        .workspace_id(workspace_name)
        .org_id(superposition_org_id_from_env)
        .id(experiment_id.to_string())
        .change_reason(
            req.change_reason
                .clone()
                .unwrap_or_else(|| format!("Discarding release {} ", release_id)),
        )
        .send()
        .await
        .map_err(|e| {
            info!("Failed to discard experiment: {:?}", e);
            ABError::InternalServerError(
                "Failed to discard experiment in Superposition".to_string(),
            )
        })?;

    info!("Successfully discarded experiment {}", experiment_id);

    // A discarded delete release leaves the slice untouched, so its view stays and becomes
    // deletable again.
    if let Err(e) = release_view::settle_pending_delete(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        experiment_id.clone(),
        false,
    )
    .await
    {
        info!("Failed to clear pending release view deletion: {:?}", e);
    }

    Ok(Json(DiscardReleaseResponse {
        success: true,
        message: "Release experiment discarded".to_string(),
        experiment_id: experiment_id.to_string(),
    }))
}

#[get("{organisation}/{application}")]
async fn serve_release(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    query: Query<ServeReleaseQueryParams>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<ServeReleaseResponse>>> {
    serve_release_handler(path, req, query, state).await
}

#[get("v2/{organisation}/{application}")]
async fn serve_release_v2(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    query: Query<ServeReleaseQueryParams>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<ServeReleaseResponse>>> {
    serve_release_handler(path, req, query, state).await
}

async fn get_release_config_from_provider(
    provider: &Arc<SuperpositionAPIProvider>,
    evaluation_context: &EvaluationContext,
) -> Result<OpenFeatureReleaseConfig, ABError> {
    let config = provider
        .resolve_all_features(evaluation_context.clone())
        .await
        .map_err(|e| {
            log::error!("Error getting superposition keys: {:?}", e);
            ABError::InternalServerError("Failed to resolve full config".to_string())
        })?;

    let of_release_config: OpenFeatureReleaseConfig = serde_json::from_value(
        dotted_docs_to_nested(config.iter().map(|(k, v)| (k.clone(), v.clone())))?,
    )
    .map_err(|e| {
        ABError::InternalServerError(format!("Failed to deserialize release config: {}", e))
    })?;

    Ok(of_release_config)
}

async fn serve_release_handler(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    query: Query<ServeReleaseQueryParams>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<ServeReleaseResponse>>> {
    let (organisation, application) = path.into_inner();

    let span = tracing::Span::current();
    span.record("org_id", tracing::field::display(&organisation));
    span.record("app_id", tracing::field::display(&application));

    info!(
        "Serving release for organisation: {}, application: {}",
        organisation, application
    );

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::NotFound(format!("Failed to get workspace name: {}", e)))?;

    let context: HashMap<String, String> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(utils::parse_kv_string)
        .unwrap_or_default()
        .iter()
        .map(|(k, v)| {
            (k.clone(), {
                match v {
                    Value::String(s) => s.clone(),
                    _ => v.to_string(),
                }
            })
        })
        .collect();

    // If toss not sent fallback to
    let toss = query.into_inner().toss.unwrap_or("99".into());

    info!(
        "Got Toss for serving release: {}, workspace: {}, org: {}, app: {}",
        toss, workspace_name, organisation, application
    );
    info!("Context for serving release: {:?}", context);

    let workspace_handle = state.provider_registry.get_or_init(&workspace_name).await;

    let provider = workspace_handle.provider.clone();

    let evaluation_context = EvaluationContext {
        custom_fields: context.iter().fold(HashMap::new(), |mut acc, (k, v)| {
            acc.insert(
                k.clone(),
                open_feature::EvaluationContextFieldValue::String(v.clone()),
            );
            acc
        }),
        targeting_key: Some(toss.clone()),
    };

    log::info!("Final evaluation Context {:?}", evaluation_context);

    let of_release_config =
        get_release_config_from_provider(&provider, &evaluation_context).await?;

    if of_release_config.config.version == "0.0.0" {
        return Err(ABError::NotFound("No release yet".to_string()));
    }

    let (index_file, important_files, lazy_files, resource_files) = {
        let all_files = of_release_config
            .package
            .important
            .iter()
            .chain(of_release_config.package.lazy.iter())
            .chain(of_release_config.resources.iter())
            .chain([of_release_config.package.index.clone()].iter())
            .cloned()
            .collect::<Vec<String>>();

        let files_result = utils::get_files_by_file_keys_async(
            state.db_pool.clone(),
            &state.redis_cache,
            organisation,
            application.clone(),
            all_files,
        )
        .await;

        if let Ok(files) = files_result {
            let important_files: Vec<ServeFile> = of_release_config
                .package
                .important
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect();

            let lazy_files: Vec<ServeFile> = of_release_config
                .package
                .lazy
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect();

            let resource_files: Vec<ServeFile> = of_release_config
                .resources
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect();

            let index_file: ServeFile = {
                let (file_path, _, _) = parse_file_key(&of_release_config.package.index);
                files
                    .iter()
                    .find(|file| file.file_path == file_path.clone())
                    .map(|file| ServeFile {
                        file_path: file.file_path.clone(),
                        url: encode_url_path(&file.url),
                        checksum: file.checksum.clone(),
                        size: file.size,
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: String::new(),
                        checksum: String::new(),
                        size: 0,
                    })
            };

            (index_file, important_files, lazy_files, resource_files)
        } else {
            (
                ServeFile {
                    file_path: String::new(),
                    url: String::new(),
                    checksum: String::new(),
                    size: 0,
                },
                Vec::new(),
                Vec::new(),
                Vec::new(),
            )
        }
    };

    let release_response = ServeReleaseResponse {
        version: "2".to_string(),
        config: of_release_config.config,
        package: ServePackage {
            name: of_release_config.package.name,
            version: of_release_config.package.version.to_string(),
            index: index_file,
            properties: of_release_config.package.properties,
            important: important_files,
            lazy: lazy_files,
        },
        resources: resource_files,
    };

    Ok(WithHeaders::new(Json(release_response))
        .header(
            actix_web::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )
        .header(
            actix_web::http::header::CACHE_CONTROL,
            HeaderValue::from_static("public, s-maxage=86400, max-age=0"),
        )
        .status(StatusCode::OK))
}

#[authz(
    resource = "release",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[put("/{release_id}")]
async fn update_release(
    path: Path<String>,
    req: Json<CreateReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let dimensions = req.dimensions.clone().unwrap_or_default();

    let release_id = path.into_inner();

    let BuildOverrides {
        final_important,
        package_data,
        is_first_release: _,
        final_lazy,
        final_resources,
        config_version,
        config_properties,
        pkg_version,
        files,
        final_properties,
        control_overrides,
        experimental_overrides,
    } = utils::build_overrides(
        &req,
        superposition_org_id_from_env.clone(),
        application.clone(),
        organisation.clone(),
        dimensions.clone(),
        state.clone(),
        workspace_name.clone(),
    )
    .await?;

    let experiment_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .id(release_id.to_string())
        .send()
        .await
        .map_err(|e| {
            info!("Failed to get experiment details: {:?}", e);
            ABError::InternalServerError(
                "Failed to get experiment details from Superposition".to_string(),
            )
        })?;
    let experiment_variant_id = experiment_details
        .variants
        .iter()
        .find(|variant| variant.variant_type == Experimental)
        .map(|variant| variant.id.clone())
        .ok_or_else(|| {
            ABError::BadRequest(format!(
                "Variant '{}' not found in experiment. Available variants: {:?}",
                Experimental,
                experiment_details
                    .variants
                    .iter()
                    .map(|v| &v.id)
                    .collect::<Vec<_>>()
            ))
        })?;

    let control_variant = VariantUpdateRequestBuilder::default()
        .id(format!("{:}-control", release_id))
        .set_overrides(Some(control_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let experiment_variant = VariantUpdateRequestBuilder::default()
        .id(experiment_variant_id.clone())
        .set_overrides(Some(experimental_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let updated_experiment_response = state
        .superposition_client
        .update_overrides_experiment()
        .id(release_id.clone())
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .description(format!(
            "Release Update for application {} in organisation {} with package version {}",
            application, organisation, pkg_version
        ))
        .change_reason(format!(
            "Release update for application {} with PATCH-style overrides",
            application
        ))
        .variant_list(control_variant)
        .variant_list(experiment_variant);

    let updated_experiment_response = updated_experiment_response.send().await.map_err(|e| {
        info!("Failed to update experiment: {:?}", e);
        ABError::InternalServerError("Failed to update experiment in Superposition".to_string())
    })?;

    let response_important = final_important.unwrap_or_else(|| {
        package_data
            .files
            .iter()
            .filter_map(|f| f.as_ref().cloned())
            .collect()
    });
    let response_resources = final_resources.unwrap_or_default();
    let response_lazy = final_lazy.unwrap_or_default();
    let millis = updated_experiment_response
        .created_at
        .to_millis()
        .map_err(|_| ABError::InternalServerError("Error while converting time".to_string()))?;
    let created_at = DateTime::from_timestamp_millis(millis)
        .ok_or_else(|| ABError::InternalServerError("Invalid timestamp".to_string()))?;

    let nested_config_props_result = dotted_docs_to_nested(config_properties.clone());
    let nested_config_props_response = nested_config_props_result.unwrap_or_else(|err| {
        info!(
            "Failed to convert dotted docs to nested structure: {:?}",
            err
        );
        Value::Object(serde_json::Map::new())
    });

    Ok(Json(CreateReleaseResponse {
        id: release_id.clone(),
        created_at,
        is_delete_release: is_delete_experiment(&updated_experiment_response.experiment_type),
        // An update is only possible while CREATED, so nothing has been concluded yet.
        is_reverted: false,
        config: Config {
            boot_timeout: req.config.boot_timeout as u32,
            release_config_timeout: req.config.release_config_timeout as u32,
            version: config_version.clone(),
            properties: Some(nested_config_props_response),
        },
        package: ServePackage {
            name: application.clone(),
            version: pkg_version.to_string(),
            index: {
                let (file_path, _, _) = parse_file_key(&package_data.index);
                files
                    .iter()
                    .find(|file| file.file_path == file_path.clone())
                    .map(|file| ServeFile {
                        file_path: file.file_path.clone(),
                        url: encode_url_path(&file.url),
                        checksum: file.checksum.clone(),
                        size: file.size,
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: "".to_string(),
                        checksum: "".to_string(),
                        size: 0,
                    })
            },
            properties: final_properties.unwrap_or_default(),
            important: response_important
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect(),
            lazy: response_lazy
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: encode_url_path(&file.url),
                            checksum: file.checksum.clone(),
                            size: file.size,
                        })
                })
                .collect(),
        },
        resources: response_resources
            .iter()
            .filter_map(|file_key| {
                let (file_path, _, _) = parse_file_key(file_key);
                files
                    .iter()
                    .find(|file| file.file_path == file_path.clone())
                    .map(|file| ServeFile {
                        file_path: file.file_path.clone(),
                        url: encode_url_path(&file.url),
                        checksum: file.checksum.clone(),
                        size: file.size,
                    })
            })
            .collect(),
        dimensions: dimensions.clone(),
        experiment: Some(ReleaseExperiment {
            experiment_id: release_id,
            experiment_variants: utils::extract_variants_from_experiment(
                &experiment_details.variants,
            ),
            package_version: pkg_version,
            config_version: format!("v{}", pkg_version),
            created_at: created_at.to_string(),
            traffic_percentage: 0, // Default to 100% for new releases
            status: "CREATED".to_string(),
        }),
    }))
}
