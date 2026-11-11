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
    types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::{document::dotted_docs_to_nested, workspace::get_workspace_name_for_application},
};
use actix_web::{
    get, post, put,
    web::{self, Json, Path, Query},
    Scope,
};
use airborne_authz_macros::authz;
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use http::{HeaderValue, StatusCode};
use log::info;
use open_feature::EvaluationContext;
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc};
use superposition_provider::{AllFeatureProvider, SuperpositionAPIProvider};
use superposition_sdk::types::builders::{VariantBuilder, VariantUpdateRequestBuilder};
use superposition_sdk::types::ExperimentStatusType;
use superposition_sdk::types::VariantType::Experimental;
pub mod control_center;
mod device_seen;
pub(crate) mod maker_checker;
pub(crate) mod operations;
pub(crate) mod recovery;
pub(crate) mod rollback;
pub(crate) mod serving_policy;
mod types;
pub mod utils;
pub(crate) mod write_lock;

fn validate_ramp_traffic_percentage(traffic_percentage: u8) -> airborne_types::Result<()> {
    if traffic_percentage > 50 {
        return Err(ABError::BadRequest(
            "Traffic percentage must be between 0 and 50".into(),
        ));
    }
    Ok(())
}

fn experiment_lookup_error<E>(
    error: &superposition_sdk::error::SdkError<E>,
    failure_message: &str,
) -> ABError {
    use superposition_sdk::error::SdkError;
    let (status, code) = match error {
        SdkError::ServiceError(e) => match e.raw().status().as_u16() {
            // Upstream 404 is ambiguous: it can mean an absent workspace too.
            404 => {
                let body = e.raw().body().bytes().unwrap_or_default();
                let text = String::from_utf8_lossy(body).to_lowercase();
                if text.contains("workspace") {
                    (503, "upstream_workspace_unavailable")
                } else if text.contains("experiment") || text.contains("release") {
                    (404, "release_not_found")
                } else {
                    (404, "release_or_workspace_not_found")
                }
            }
            401 | 403 => (502, "upstream_authentication_failed"),
            _ => (502, "upstream_release_unavailable"),
        },
        SdkError::DispatchFailure(_) => (503, "upstream_connection_failed"),
        SdkError::TimeoutError(_) => (504, "upstream_read_timeout"),
        _ => (502, "upstream_release_invalid_response"),
    };
    lookup_failure(status, code, failure_message)
}

fn lookup_failure(status: u16, code: &str, message: &str) -> ABError {
    ABError::ReleaseOperation {
        status,
        body: json!({
            "code": code, "message": message, "stage": "read_release",
            "mutation_committed": false, "mutation_may_have_committed": false,
            "automatic_retry": false
        }),
    }
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
            .service(ramp_release)
            .service(conclude_release)
            .service(get_release)
            .service(update_release)
            .service(discard_release)
            .service(control_center::rollback)
            .service(maker_checker::acknowledge),
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
    .await?;

    let exp_details = state
        .release_superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(release_key.clone())
        .send()
        .await
        .map_err(|e| {
            info!("Failed to get experiment details: {:?}", e);
            experiment_lookup_error(&e, "Failed to get experiment details from Superposition")
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
    create_release_impl(req, auth_response.into_inner(), state).await
}

pub(super) async fn create_release_impl(
    req: Json<CreateReleaseRequest>,
    auth_response: AuthResponse,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateReleaseResponse>> {
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    write_lock::locked(&state, &organisation, &application, async {
        maker_checker::gate(&state, &organisation, &application, "create", "", &serde_json::to_value(&*req).map_err(|_| ABError::BadRequest("Invalid payload".into()))?).await?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let dimensions = req.dimensions.clone().unwrap_or_default();
    let strict = serving_policy::get(&state, &organisation, &application).await?["effective_strict"].as_bool().unwrap_or(true);
    validate_creation_targeting(strict, &dimensions, req.compatibility_exception.as_deref())?;



    if utils::check_non_concluded_releases(
        superposition_org_id_from_env.clone(),
        dimensions.clone(),
        state.clone(),
        workspace_name.clone(),
    )
    .await?
    {
        return Err(ABError::Conflict(
            "There is already an ongoing release for the given dimensions. Please conclude it before creating a new release."
                .to_string(),
        ));
    }

    let BuildOverrides {
        final_important,
        package_data,

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
        .release_superposition_client
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

    if strict && !["app_version", "version_cohort"].iter().any(|key| dimensions.get(*key).and_then(Value::as_str).is_some_and(|v| !v.trim().is_empty())) {
        let mut payload = serde_json::json!({"reason":req.compatibility_exception,"dimensions":dimensions,"outcome":"creation_attempt"});
        if let Some(approval) = maker_checker::audit_context() { payload["approval"] = approval; }
        // Required before the upstream write; failed attempts remain explicitly labelled.
        control_center::required_event(&state, &auth_response, "", "compatibility_exception", payload).await?;
    }
    write_lock::check().await?;
    let created_experiment_response = Box::pin(write_lock::mutate(control_center::create_expected(&control_variant, &experimental_variant, &dimensions), created_experiment_response.idempotency_key(write_lock::reason()).change_reason(write_lock::user_reason(&format!("Release creation for application {} with PATCH-style overrides", application))?).send())).await?;

    let experiment_id_for_ramping = created_experiment_response.id.to_string();
    maker_checker::protect_created(&state, &organisation,&application,&experiment_id_for_ramping, req.rollback_sensitive.as_deref()).await?;
    control_center::event(
        &state,
        &auth_response,
        &experiment_id_for_ramping,
        "created",
        serde_json::json!({"compatibility_exception":req.compatibility_exception}),
    )
    .await;

    let response_important = final_important.unwrap_or_else(|| {
        package_data
            .files
            .iter()
            .filter_map(|f| f.as_ref().cloned())
            .collect()
    });

    // Initial/default configuration is also seen after a workspace rebuild.
    // Never infer operator approval from missing upstream release state.

    let response_lazy = final_lazy.unwrap_or_default();

    let response_resources = final_resources.unwrap_or_default();

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
            warnings: targeting_warnings(&dimensions),
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
            config_version: config_version.clone(),
            created_at: now.to_string(),
            traffic_percentage: 0,
            status: "CREATED".to_string(),
        }),
    }))
    }).await
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
    .await?;

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
            warnings: targeting_warnings(&dimensions),
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
    ramp_release_impl(release_id, req, auth_response.into_inner(), state).await
}

pub(super) async fn ramp_release_impl(
    release_id: Path<String>,
    req: Json<RampReleaseRequest>,
    auth_response: AuthResponse,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<RampReleaseResponse>> {
    write_lock::validate_user_reason(req.change_reason.as_deref().unwrap_or_default())?;
    validate_ramp_traffic_percentage(req.traffic_percentage)?;

    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    write_lock::locked(&state, &organisation, &application, async {
        maker_checker::gate(
            &state,
            &organisation,
            &application,
            "ramp",
            &release_id.to_string(),
            &serde_json::to_value(&*req)
                .map_err(|_| ABError::BadRequest("Invalid payload".into()))?,
        )
        .await?;

        let experiment_id = release_id.to_string();

        let superposition_org_id_from_env = state.env.superposition_org_id.clone();

        let workspace_name = get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;

        let details = state
            .release_superposition_client
            .get_experiment()
            .org_id(&superposition_org_id_from_env)
            .workspace_id(&workspace_name)
            .id(&experiment_id)
            .send()
            .await
            .map_err(|e| {
                info!("Failed to read release {}: {:?}", experiment_id, e);
                experiment_lookup_error(&e, "Failed to read release")
            })?;
        control_center::ensure_active(&details.status)?;

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
        .await?;

        info!("Successfully ramped experiment {}", experiment_id);

        control_center::event(
            &state,
            &auth_response,
            &release_id.to_string(),
            "ramped",
            serde_json::json!({"traffic_percentage":req.traffic_percentage}),
        )
        .await;
        Ok(Json(RampReleaseResponse {
            success: true,
            message: format!(
                "Release experiment ramped to {}% traffic",
                req.traffic_percentage
            ),
            experiment_id: experiment_id.to_string(),
            traffic_percentage: req.traffic_percentage,
        }))
    })
    .await
}

async fn ramp_experiment(
    state: &AppState,
    workspace_name: &String,
    experiment_id: &String,
    traffic_percentage: i32,
    change_reason: &Option<String>,
) -> airborne_types::Result<()> {
    write_lock::check().await?;
    Box::pin(write_lock::mutate_ramp(serde_json::json!({"id":experiment_id,"status":"INPROGRESS","traffic_percentage":traffic_percentage}),     state
        .release_superposition_client
        .ramp_experiment()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(workspace_name)
        .id(experiment_id.to_string())
        .traffic_percentage(traffic_percentage)
        .change_reason(write_lock::user_reason(&(change_reason.clone().unwrap_or_else(|| {
            format!(
                "Ramping release {} to {}% traffic",
                experiment_id, traffic_percentage
            )
        })))?).send())).await?;
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
    conclude_release_impl(release_id, req, auth_response.into_inner(), state).await
}

pub(super) async fn conclude_release_impl(
    release_id: Path<String>,
    req: Json<ConcludeReleaseRequest>,
    auth_response: AuthResponse,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ConcludeReleaseResponse>> {
    write_lock::validate_user_reason(req.change_reason.as_deref().unwrap_or_default())?;

    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    write_lock::locked(&state, &organisation, &application, async {
        maker_checker::gate(&state, &organisation, &application, "conclude", &release_id.to_string(), &serde_json::to_value(&*req).map_err(|_| ABError::BadRequest("Invalid payload".into()))?).await?;

        let experiment_id = release_id.to_string();

        let superposition_org_id_from_env = state.env.superposition_org_id.clone();

        let workspace_name = get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;

        let experiment_details = state
            .release_superposition_client
            .get_experiment()
            .org_id(superposition_org_id_from_env.clone())
            .workspace_id(workspace_name.clone())
            .id(experiment_id.to_string())
            .send()
            .await
            .map_err(|e| {
                info!("Failed to get experiment details: {:?}", e);
                experiment_lookup_error(&e, "Failed to get experiment details from Superposition")
            })?;

        control_center::ensure_inprogress(&experiment_details.status)?;

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

        write_lock::check().await?;

    Box::pin(write_lock::mutate(serde_json::json!({"id":experiment_id,"status":"CONCLUDED","chosen_variant":transformed_variant_id}),         state
            .release_superposition_client
            .conclude_experiment()
            .org_id(superposition_org_id_from_env)
            .workspace_id(workspace_name)
            .id(experiment_id.to_string())
            .chosen_variant(transformed_variant_id.clone())
            .change_reason(write_lock::user_reason(&(req.change_reason.clone().unwrap_or_else(|| {
                format!(
                    "Concluding release {} with variant {}",
                    release_id, req.chosen_variant
                )
            })))?).send())).await?;

        control_center::event(
            &state,
            &auth_response,
            &experiment_id,
            "concluded",
            serde_json::json!({"chosen_variant":req.chosen_variant}),
        )
        .await;
        info!(
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
    })
    .await
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
    discard_release_impl(release_id, req, auth_response.into_inner(), state).await
}

pub(super) async fn discard_release_impl(
    release_id: Path<String>,
    req: Json<DiscardReleaseRequest>,
    auth_response: AuthResponse,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DiscardReleaseResponse>> {
    write_lock::validate_user_reason(req.change_reason.as_deref().unwrap_or_default())?;

    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    write_lock::locked(&state, &organisation, &application, async {
        maker_checker::gate(
            &state,
            &organisation,
            &application,
            "discard",
            &release_id.to_string(),
            &serde_json::to_value(&*req)
                .map_err(|_| ABError::BadRequest("Invalid payload".into()))?,
        )
        .await?;

        let experiment_id = release_id.to_string();

        let superposition_org_id_from_env = state.env.superposition_org_id.clone();

        let workspace_name = get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;

        let experiment_details = state
            .release_superposition_client
            .get_experiment()
            .org_id(superposition_org_id_from_env.clone())
            .workspace_id(workspace_name.clone())
            .id(experiment_id.to_string())
            .send()
            .await
            .map_err(|e| {
                info!("Failed to get experiment details: {:?}", e);
                experiment_lookup_error(&e, "Failed to get experiment details from Superposition")
            })?;

        if experiment_details.status != ExperimentStatusType::Created {
            return Err(ABError::Conflict(
                "Release can only be discarded when in CREATED status".to_string(),
            ));
        }

        write_lock::check().await?;

        Box::pin(write_lock::mutate(
            serde_json::json!({"id":experiment_id,"status":"DISCARDED"}),
            state
                .release_superposition_client
                .discard_experiment()
                .workspace_id(workspace_name)
                .org_id(superposition_org_id_from_env)
                .id(experiment_id.to_string())
                .change_reason(write_lock::user_reason(
                    &(req
                        .change_reason
                        .clone()
                        .unwrap_or_else(|| format!("Discarding release {} ", release_id))),
                )?)
                .send(),
        ))
        .await?;

        control_center::event(
            &state,
            &auth_response,
            &experiment_id,
            "discarded",
            serde_json::json!({"change_reason":req.change_reason}),
        )
        .await;
        info!("Successfully discarded experiment {}", experiment_id);

        Ok(Json(DiscardReleaseResponse {
            success: true,
            message: "Release experiment discarded".to_string(),
            experiment_id: experiment_id.to_string(),
        }))
    })
    .await
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
    .map_err(|e| ABError::NotFound(format!("Workspace unavailable; keep current code: {}", e)))?;

    // The app exists (workspace lookup succeeded). A first strict fetch may return 404.
    device_seen::record(&state, &organisation, &application);

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
    let toss = query.toss.clone().unwrap_or("99".into());

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

    let strict = serving_policy::cached(&state, &organisation, &application)
        .await
        .map_err(|_| ABError::NotFound("Serving policy unavailable; keep current code".into()))?
        ["effective_strict"]
        .as_bool()
        .unwrap_or(true);
    let of_release_config = if strict {
        // Keep snapshot versions: a concurrent default change must never make an
        // old fallback look like a targeted override. Fail closed on that race.
        let builder = state
            .release_superposition_client
            .get_resolved_config_with_identifier()
            .org_id(state.env.superposition_org_id.clone())
            .workspace_id(workspace_name.clone())
            .identifier(toss.clone());
        let resolved = builder
            .clone()
            .set_context(Some(
                context
                    .iter()
                    .map(|(k, v)| (k.clone(), Document::String(v.clone())))
                    .collect(),
            ))
            .send()
            .await
            .map_err(|e| {
                log::error!("Strict release resolve failed: {e}");
                ABError::NotFound("Release resolution unavailable; keep current code".into())
            })?;
        let defaults = builder.send().await.map_err(|e| {
            log::error!("Strict defaults resolve failed: {e}");
            ABError::NotFound("Release resolution unavailable; keep current code".into())
        })?;
        let resolved_json = crate::utils::document::document_to_json_value(&resolved.config);
        let default_json = crate::utils::document::document_to_json_value(&defaults.config);
        if !has_targeted_release(
            resolved_json["config.version"].as_str().unwrap_or("0.0.0"),
            default_json["config.version"].as_str().unwrap_or("0.0.0"),
            &resolved.version,
            &defaults.version,
        ) {
            return Err(ABError::NotFound(
                "No compatible targeted release; use bundled code".into(),
            ));
        }
        serde_json::from_value(dotted_docs_to_nested(
            resolved_json
                .as_object()
                .ok_or_else(|| {
                    ABError::NotFound("Release resolution unavailable; keep current code".into())
                })?
                .iter()
                .map(|(k, v)| (k.clone(), v.clone())),
        )?)
        .map_err(|e| ABError::NotFound(format!("Invalid strict release; keep current code: {e}")))?
    } else {
        get_release_config_from_provider(&provider, &evaluation_context).await?
    };

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
            organisation.clone(),
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
        blocked_package_versions: crate::telemetry::blocked(&state, &organisation, &application)
            .await
            .map_err(|e| {
                log::error!("Security exclusions unavailable: {e}");
                ABError::NotFound("Security policy unavailable; keep current code".into())
            })?,
        telemetry: crate::telemetry::served(
            &state,
            &organisation,
            &application,
            &of_release_config.package.version.to_string(),
            &of_release_config.config.version,
            query.telemetry_platform.as_deref(),
            query.native_version.as_deref(),
        )
        .await
        .unwrap_or_else(|e| {
            log::warn!("Optional telemetry receipt unavailable: {e}");
            None
        }),
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
            HeaderValue::from_static("public, max-age=0, s-maxage=60, stale-if-error=300"),
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
    update_release_impl(path, req, auth_response.into_inner(), state).await
}

pub(super) async fn update_release_impl(
    path: Path<String>,
    req: Json<CreateReleaseRequest>,
    auth_response: AuthResponse,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CreateReleaseResponse>> {
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    write_lock::locked(&state, &organisation, &application, async {
        maker_checker::gate(
            &state,
            &organisation,
            &application,
            "update",
            &path.to_string(),
            &serde_json::to_value(&*req)
                .map_err(|_| ABError::BadRequest("Invalid payload".into()))?,
        )
        .await?;

        let workspace_name = get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;
        let superposition_org_id_from_env = state.env.superposition_org_id.clone();

        let dimensions = req.dimensions.clone().unwrap_or_default();

        let release_id = path.into_inner();

        let BuildOverrides {
            final_important,
            package_data,

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
            .release_superposition_client
            .get_experiment()
            .org_id(superposition_org_id_from_env.clone())
            .workspace_id(workspace_name.clone())
            .id(release_id.to_string())
            .send()
            .await
            .map_err(|e| {
                info!("Failed to get experiment details: {:?}", e);
                experiment_lookup_error(&e, "Failed to get experiment details from Superposition")
            })?;
        control_center::ensure_active(&experiment_details.status)?;
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

        let expected_variants =
            control_center::override_values(&control_overrides, &experimental_overrides);
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
            .release_superposition_client
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

        let updated_experiment_response = Box::pin(write_lock::mutate(
            serde_json::json!({"id":release_id,"variants":expected_variants}),
            updated_experiment_response
                .change_reason(write_lock::user_reason(&format!(
                    "Release update for application {} with PATCH-style overrides",
                    application
                ))?)
                .send(),
        ))
        .await?;

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

        maker_checker::protect_created(
            &state,
            &organisation,
            &application,
            &release_id,
            req.rollback_sensitive.as_deref(),
        )
        .await?;
        Ok(Json(CreateReleaseResponse {
            warnings: targeting_warnings(&dimensions),
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
    })
    .await
}

pub(crate) fn strict_release_application(setting: &str, org: &str, app: &str) -> bool {
    setting
        .split(',')
        .any(|entry| entry.trim() == format!("{org}/{app}"))
}
fn has_targeted_release(
    resolved: &str,
    default: &str,
    snapshot: &str,
    default_snapshot: &str,
) -> bool {
    !snapshot.is_empty()
        && snapshot == default_snapshot
        && resolved != "0.0.0"
        && resolved != default
}
#[cfg(test)]
mod release_safety_tests {
    use super::*;
    #[test]
    fn ramp_traffic_percentage_is_validated_before_writes() {
        assert!(validate_ramp_traffic_percentage(0).is_ok());
        assert!(validate_ramp_traffic_percentage(50).is_ok());
        assert!(matches!(
            validate_ramp_traffic_percentage(51),
            Err(ABError::BadRequest(_))
        ));
    }

    #[test]
    fn strict_selection_rejects_default_and_empty_release() {
        assert!(!has_targeted_release("old-rn", "old-rn", "1", "1"));
        assert!(!has_targeted_release("0.0.0", "default", "1", "1"));
        assert!(has_targeted_release("compatible", "old-rn", "1", "1"));
        assert!(!has_targeted_release(
            "old-fallback",
            "new-default",
            "1",
            "2"
        ));
        assert!(!has_targeted_release("compatible", "default", "", ""));
        assert!(strict_release_application(
            " kharcha/scratch,org/other",
            "kharcha",
            "scratch"
        ));
        assert!(!strict_release_application(
            "kharcha/scratch",
            "kharcha",
            "live"
        ));
        assert!(!strict_release_application("", "kharcha", "live"));
    }
}

fn targeting_warnings(dimensions: &HashMap<String, Value>) -> Vec<String> {
    if !dimensions.contains_key("locale") {
        vec!["Superposition specificity: older locale-specific releases may continue to override this general rollout, even after conclusion. Preview each locale and explicitly release to those contexts when superseding them.".into()]
    } else {
        Vec::new()
    }
}
#[cfg(test)]
mod targeting_warning_tests {
    use super::*;
    #[test]
    fn general_release_exposes_specificity_warning() {
        assert_eq!(targeting_warnings(&HashMap::new()).len(), 1);
        assert!(targeting_warnings(&HashMap::from([(
            "locale".into(),
            Value::String("kn".into())
        )]))
        .is_empty());
    }
}

fn validate_creation_targeting(
    strict: bool,
    dimensions: &HashMap<String, Value>,
    exception: Option<&str>,
) -> airborne_types::Result<()> {
    if exception.is_some_and(|r| r.trim().chars().count() > 2000) {
        return Err(ABError::BadRequest(
            "Compatibility exception exceeds 2000 characters".into(),
        ));
    }
    let explicit_version = ["app_version", "version_cohort"].iter().any(|key| {
        dimensions
            .get(*key)
            .and_then(Value::as_str)
            .is_some_and(|v| !v.trim().is_empty())
    });
    if strict
        && (dimensions.is_empty()
            || (!explicit_version
                && !exception.is_some_and(|r| (20..=2000).contains(&r.trim().chars().count()))))
    {
        return Err(ABError::BadRequest("Strict creation requires a nonempty app_version or version_cohort target declaring compatible native versions. For custom targeting provide compatibility_exception (20–2000 Unicode characters explaining native compatibility); it is audited. Compatibility remains the operator's declaration, not server verification.".into()));
    }
    Ok(())
}

#[cfg(test)]
mod creation_targeting_tests {
    use super::*;
    #[test]
    fn strict_creation_requires_declared_compatibility() {
        let locale = HashMap::from([("locale".into(), serde_json::json!("en"))]);
        assert!(validate_creation_targeting(true, &locale, None).is_err());
        assert!(validate_creation_targeting(
            true,
            &locale,
            Some("legacy native cohort reviewed by owner")
        )
        .is_ok());
        assert!(validate_creation_targeting(true, &locale, Some(" ")).is_err());
        assert!(validate_creation_targeting(true, &locale, Some("原".repeat(7).as_str())).is_err());
        assert!(validate_creation_targeting(true, &locale, Some("原".repeat(20).as_str())).is_ok());
        assert!(
            validate_creation_targeting(false, &locale, Some("x".repeat(2001).as_str())).is_err()
        );
        assert!(validate_creation_targeting(
            true,
            &HashMap::new(),
            Some("legacy native cohort reviewed by owner")
        )
        .is_err());
        assert!(validate_creation_targeting(false, &HashMap::new(), None).is_ok());
        for key in ["app_version", "version_cohort"] {
            assert!(validate_creation_targeting(
                true,
                &HashMap::from([(key.into(), json!("1.0.0"))]),
                None
            )
            .is_ok());
            for v in [json!(""), json!(null), json!(true), json!([])] {
                assert!(
                    validate_creation_targeting(true, &HashMap::from([(key.into(), v)]), None)
                        .is_err()
                );
            }
        }
    }
}

#[cfg(test)]
mod lookup_error_tests {
    use super::*;
    #[test]
    fn read_failures_are_definitely_before_mutation() {
        for (status, code) in [
            (404, "release_or_workspace_not_found"),
            (502, "upstream_authentication_failed"),
            (503, "upstream_connection_failed"),
            (504, "upstream_read_timeout"),
        ] {
            let ABError::ReleaseOperation {
                status: actual,
                body,
            } = lookup_failure(status, code, "Read refused")
            else {
                panic!()
            };
            assert_eq!(actual, status);
            assert_eq!(body["code"], code);
            assert_eq!(body["mutation_committed"], false);
            assert_eq!(body["automatic_retry"], false);
        }
    }
}

#[cfg(test)]
mod upstream_read_fault_tests {
    use super::*;
    #[tokio::test]
    async fn injected_reads_distinguish_faults_without_write_retry() {
        use std::io::{Read, Write};
        for (status, message, expected) in [
            (404, "Experiment not found", "release_not_found"),
            (404, "Workspace not found", "upstream_workspace_unavailable"),
            (403, "Forbidden", "upstream_authentication_failed"),
            (503, "Unavailable", "upstream_release_unavailable"),
        ] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let addr = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0; 8192];
                let count = stream.read(&mut request).unwrap();
                assert!(String::from_utf8_lossy(&request[..count]).starts_with("GET "));
                let body = json!({"message":message}).to_string();
                write!(stream,"HTTP/1.1 {status} Fault\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",body.len(),body).unwrap();
            });
            let client = superposition_sdk::Client::from_conf(
                superposition_sdk::Config::builder()
                    .bearer_token("scratch".into())
                    .endpoint_url(format!("http://{addr}"))
                    .retry_config(aws_smithy_types::retry::RetryConfig::disabled())
                    .behavior_version_latest()
                    .build(),
            );
            let error = client
                .get_experiment()
                .org_id("scratch")
                .workspace_id("scratch")
                .id("1")
                .send()
                .await
                .unwrap_err();
            server.join().unwrap();
            let ABError::ReleaseOperation { body, .. } =
                experiment_lookup_error(&error, "Release read failed")
            else {
                panic!()
            };
            assert_eq!(body["code"], expected);
            assert_eq!(body["mutation_committed"], false);
        }
        let addr = "127.0.0.1:0";
        let client = superposition_sdk::Client::from_conf(
            superposition_sdk::Config::builder()
                .bearer_token("scratch".into())
                .endpoint_url(format!("http://{addr}"))
                .retry_config(aws_smithy_types::retry::RetryConfig::disabled())
                .behavior_version_latest()
                .build(),
        );
        let error = client
            .get_experiment()
            .org_id("scratch")
            .workspace_id("scratch")
            .id("1")
            .send()
            .await
            .unwrap_err();
        let ABError::ReleaseOperation { body, .. } =
            experiment_lookup_error(&error, "Release read failed")
        else {
            panic!()
        };
        assert_eq!(body["code"], "upstream_connection_failed");
    }
}
