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

use actix_web::{
    error, get, post, put,
    web::{self, Json, Path, Query},
    Scope,
};
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use http::{HeaderValue, StatusCode};
use log::info;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use superposition_sdk::types::builders::{VariantBuilder, VariantUpdateRequestBuilder};
use superposition_sdk::types::ExperimentStatusType;
use superposition_sdk::types::VariantType::Experimental;

use crate::{
    file::utils::parse_file_key,
    middleware::auth::{validate_user, Auth, AuthResponse, ADMIN, READ, WRITE},
    release::types::*,
    types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::{document::dotted_docs_to_nested, workspace::get_workspace_name_for_application},
};

mod types;
pub mod utils;

pub fn add_routes(path: &str) -> Scope {
    Scope::new(path).service(serve_release).service(
        Scope::new("")
            .wrap(Auth)
            .service(create_release)
            .service(list_releases)
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
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
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
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get("package.properties"))
        .and_then(utils::document_to_value)
        .unwrap_or_default();

    let rc_properties = experimental_variant
        .and_then(|v| v.overrides.as_object())
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                        url: file.url.clone(),
                        checksum: file.checksum.clone(),
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: String::new(),
                        checksum: String::new(),
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

#[post("")]
async fn create_release(
    req: Json<CreateReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let dimensions = req.dimensions.clone().unwrap_or_default();

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
        .overrides(Document::Object(control_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let experimental_variant_id = format!("experimental_{}", pkg_version);

    let experimental_variant = VariantBuilder::default()
        .id(experimental_variant_id.clone())
        .variant_type(superposition_sdk::types::VariantType::Experimental)
        .overrides(Document::Object(experimental_overrides))
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
                        url: file.url.clone(),
                        checksum: file.checksum.clone(),
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: "".to_string(),
                        checksum: "".to_string(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                        url: file.url.clone(),
                        checksum: file.checksum.clone(),
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

#[get("/list")]
async fn list_releases(
    pagination_query: Query<PaginatedQuery>,
    release_query: Query<ListReleaseQuery>,
    req: actix_web::HttpRequest,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<CreateReleaseResponse>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
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

    let experiments = experiments_list.data();

    let release_experiments: Vec<_> = experiments
        .iter()
        .filter(|exp| {
            exp.name
                .contains(&format!("{}-{}-release-exp", application, organisation))
        })
        .collect();

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
            .and_then(|v| v.overrides.as_object())
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
            .and_then(|v| v.overrides.as_object())
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
                                url: file.url.clone(),
                                checksum: file.checksum.clone(),
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
                                url: file.url.clone(),
                                checksum: file.checksum.clone(),
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
                                url: file.url.clone(),
                                checksum: file.checksum.clone(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
                        })
                        .unwrap_or_else(|| ServeFile {
                            file_path: file_path.clone(),
                            url: String::new(),
                            checksum: String::new(),
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

#[post("/{release_id}/ramp")]
async fn ramp_release(
    release_id: Path<String>,
    req: Json<RampReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<RampReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
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

#[post("/{release_id}/conclude")]
async fn conclude_release(
    release_id: Path<String>,
    req: Json<ConcludeReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ConcludeReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
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

#[post("/{release_id}/discard")]
async fn discard_release(
    release_id: Path<String>,
    req: Json<DiscardReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DiscardReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
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

async fn serve_release_handler(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    query: Query<ServeReleaseQueryParams>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<ServeReleaseResponse>>> {
    let (organisation, application) = path.into_inner();
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let span = tracing::Span::current();
    span.record("org_id", tracing::field::display(&organisation));
    span.record("app_id", tracing::field::display(&application));

    info!(
        "Serving release for organisation: {}, application: {}",
        organisation, application
    );

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::NotFound(format!("Failed to get workspace name: {}", e)))?;

    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(utils::parse_kv_string)
        .unwrap_or_default();

    // If toss not sent fallback to
    let toss = query.into_inner().toss.unwrap_or("99".into());

    info!(
        "Got Toss for serving release: {}, workspace: {}, org: {}, app: {}",
        toss, workspace_name, organisation, application
    );
    info!("Context for serving release: {:?}", context);

    let applicable_variants = context.iter().fold(
        state
            .superposition_client
            .applicable_variants()
            .workspace_id(workspace_name.clone())
            .org_id(superposition_org_id_from_env.clone())
            .identifier(toss),
        |builder, (key, value)| {
            builder.context(
                key.clone(),
                Document::String(value.as_str().unwrap_or("").to_string()),
            )
        },
    );
    let applicable_variants = if applicable_variants.get_context().is_none() {
        applicable_variants.set_context(Some(HashMap::new()))
    } else {
        applicable_variants
    };
    let applicable_variants = applicable_variants.send().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to get applicable variants: {}", e))
    })?;

    let applicable_variants_ids = applicable_variants
        .data
        .iter()
        .map(|v| Document::from(v.id.clone()))
        .collect::<Vec<_>>();

    let resolved_config_builder = context.iter().fold(
        state
            .superposition_client
            .get_resolved_config()
            .workspace_id(workspace_name.clone())
            .org_id(superposition_org_id_from_env.clone())
            .context("variantIds", Document::from(applicable_variants_ids)),
        |builder, (key, value)| {
            builder.context(
                key.clone(),
                Document::String(value.as_str().unwrap_or("").to_string()),
            )
        },
    );

    let resolved_config = resolved_config_builder.send().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to get resolved config: {}", e))
    })?;

    let config_document = resolved_config.config;

    let rc_package_important =
        utils::extract_files_from_configs(&config_document, "package.important")
            .unwrap_or_default();
    let rc_package_lazy =
        utils::extract_files_from_configs(&config_document, "package.lazy").unwrap_or_default();
    let rc_resources =
        utils::extract_files_from_configs(&config_document, "resources").unwrap_or_default();
    let rc_index =
        utils::extract_file_from_configs(&config_document, "package.index").unwrap_or_default();
    let rc_version =
        utils::extract_string_from_configs(&config_document, "config.version").unwrap_or_default();
    let rc_boot_timeout =
        utils::extract_integer_from_configs::<i64>(&config_document, "config.boot_timeout");
    let rc_release_config_timeout = utils::extract_integer_from_configs::<i64>(
        &config_document,
        "config.release_config_timeout",
    );
    let opt_rc_config_properties = config_document.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            Some(
                obj.iter()
                    .filter_map(|(k, v)| {
                        if k.starts_with("config.properties.") {
                            Some((
                                k.strip_prefix("config.properties.").unwrap().to_string(),
                                v.clone(),
                            ))
                        } else {
                            None
                        }
                    })
                    .collect::<BTreeMap<_, _>>(),
            )
        } else {
            None
        }
    });

    if rc_version == "0.0.0" {
        return Err(ABError::NotFound("No release yet".to_string()));
    }

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
            organisation,
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
                        })
                })
                .collect();

            let lazy_files: Vec<ServeFile> = rc_package_lazy
                .iter()
                .filter_map(|file_key| {
                    let (file_path, _, _) = parse_file_key(file_key);
                    files
                        .iter()
                        .find(|file| file.file_path == file_path.clone())
                        .map(|file| ServeFile {
                            file_path: file.file_path.clone(),
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                        url: file.url.clone(),
                        checksum: file.checksum.clone(),
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: String::new(),
                        checksum: String::new(),
                    })
            };

            (index_file, important_files, lazy_files, resource_files)
        } else {
            (
                ServeFile {
                    file_path: String::new(),
                    url: String::new(),
                    checksum: String::new(),
                },
                Vec::new(),
                Vec::new(),
                Vec::new(),
            )
        }
    };

    let pkg_version =
        utils::extract_integer_from_configs::<i64>(&config_document, "package.version");

    let opt_rc_package_properties = &config_document.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            obj.get("package.properties")
                .and_then(utils::document_to_value)
        } else {
            None
        }
    });

    let nested_config_props_result =
        dotted_docs_to_nested(opt_rc_config_properties.unwrap_or_default().into_iter());
    let nested_config_props_response = nested_config_props_result.unwrap_or_else(|err| {
        info!(
            "Failed to convert dotted docs to nested structure: {:?}",
            err
        );
        Value::Object(serde_json::Map::new())
    });

    let release_response = ServeReleaseResponse {
        version: "2".to_string(),
        config: Config {
            boot_timeout: rc_boot_timeout as u32,
            release_config_timeout: rc_release_config_timeout as u32,
            version: rc_version.clone(),
            properties: Some(nested_config_props_response),
        },
        package: ServePackage {
            name: application.clone(),
            version: pkg_version.to_string(),
            index: index_file,
            properties: opt_rc_package_properties
                .clone()
                .unwrap_or(serde_json::Value::default()),
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

#[put("/{release_id}")]
async fn update_release(
    path: Path<String>,
    req: Json<CreateReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
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
        .overrides(Document::Object(control_overrides))
        .build()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let experiment_variant = VariantUpdateRequestBuilder::default()
        .id(experiment_variant_id.clone())
        .overrides(Document::Object(experimental_overrides))
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
                        url: file.url.clone(),
                        checksum: file.checksum.clone(),
                    })
                    .unwrap_or_else(|| ServeFile {
                        file_path: file_path.clone(),
                        url: "".to_string(),
                        checksum: "".to_string(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                            url: file.url.clone(),
                            checksum: file.checksum.clone(),
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
                        url: file.url.clone(),
                        checksum: file.checksum.clone(),
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
