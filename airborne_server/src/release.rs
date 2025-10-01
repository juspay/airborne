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

use crate::{run_blocking, types::ABError, utils::workspace::get_workspace_name_for_application};
use actix_web::{
    error, get, post,
    web::{self, Json, Path},
    HttpResponse, Scope,
};
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use http::{uri::PathAndQuery, Uri};
use log::info;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use superposition_sdk::types::builders::VariantBuilder;
use url::form_urlencoded;

use crate::{
    file::utils::parse_file_key,
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    package::utils::parse_package_key,
    release::{types::*, utils::value_to_document},
    types::AppState,
    utils::db::{models::PackageV2Entry, schema::hyperotaserver::packages_v2::dsl as packages_dsl},
};

mod types;
mod utils;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_release)
        .service(list_releases)
        .service(ramp_release)
        .service(conclude_release)
        .service(serve_release)
        .service(get_release)
}

pub fn add_public_routes() -> Scope {
    Scope::new("").service(serve_release)
}

#[get("/{release_id}")]
async fn get_release(
    release_id: Path<String>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse, ABError> {
    let release_key = release_id.into_inner();
    if release_key.is_empty() {
        return Err(ABError::BadRequest(
            "Release Key cannot be empty".to_string(),
        ));
    }

    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, READ)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;
    let application = validate_user(auth_response.application, READ)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;

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
        .and_then(|obj| obj.get("config.properties"))
        .and_then(utils::document_to_value)
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

    let resp = GetReleaseResponse {
        id: release_key.clone(),
        created_at: DateTime::parse_from_rfc3339(&utils::dt(&exp_details.created_at))
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|_| ABError::InternalServerError("Failed to parse created_at".to_string()))?,
        config: Config {
            boot_timeout: rc_boot_timeout as u32,
            release_config_timeout: rc_release_config_timeout as u32,
            version: rc_version,
            properties: Some(rc_properties),
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

    Ok(HttpResponse::Ok().json(resp))
}

#[post("")]
async fn create_release(
    req: Json<CreateReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<CreateReleaseResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;

    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let dimensions = req.dimensions.clone().unwrap_or_default();
    let dims1 = dimensions.clone();
    info!("Dimensions: {:?}", serde_json::json!(dimensions));

    let resolved_config_builder = dims1.iter().fold(
        state
            .superposition_client
            .get_resolved_config()
            .workspace_id(workspace_name.clone())
            .org_id(superposition_org_id_from_env.clone())
            .context("variantIds", vec![].into()),
        |builder, (key, value)| {
            builder.context(
                key.clone(),
                Document::String(value.as_str().unwrap_or("").to_string()),
            )
        },
    );

    let resolved_config = resolved_config_builder.send().await;
    info!("resolved config result: {:?}", resolved_config);

    let config_document = match resolved_config {
        Ok(config) => {
            info!("config from superposition: {:?}", config);
            config.config
        }
        Err(e) => {
            info!("Failed to get resolved config: {}", e);
            None
        }
    };

    let imp_from_configs = utils::extract_files_from_configs(&config_document, "package.important");
    let lazy_from_configs = utils::extract_files_from_configs(&config_document, "package.lazy");
    let resources_from_configs = utils::extract_files_from_configs(&config_document, "resources");

    // If you give me package_id -> I'll expect you to provide me complete important and lazy splits
    // If you just want to PATCH the important or lazy blocks -> DO NOT provide me the package_id
    //
    let mut package_update = false;
    let mut is_first_release = false;
    let opt_pkg_version_from_config = &config_document.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            obj.get("package.version")
                .and_then(utils::document_to_value)
        } else {
            None
        }
    });
    if let Some(pkg_version_from_config) = opt_pkg_version_from_config {
        is_first_release = pkg_version_from_config == 0;
    }
    let pkg_version = if let Some(package_id) = &req.package_id {
        package_update = true;
        let (version_opt, _) = parse_package_key(package_id);
        version_opt.ok_or_else(|| {
            ABError::InternalServerError(format!(
                "Package ID should contain version: {}",
                package_id
            ))
        })?
    } else {
        if is_first_release {
            return Err(ABError::BadRequest(
                "First release must provide package_id".to_string(),
            ));
        }
        if !opt_pkg_version_from_config.is_some() {
            let pool = state.db_pool.clone();
            let org = organisation.clone();
            let app = application.clone();

            run_blocking!({
                let mut conn = pool.get()?;
                packages_dsl::packages_v2
                    .filter(
                        packages_dsl::org_id
                            .eq(&org)
                            .and(packages_dsl::app_id.eq(&app)),
                    )
                    .order_by(packages_dsl::version.desc())
                    .select(packages_dsl::version)
                    .first::<i32>(&mut conn)
                    .map_err(|_| {
                        ABError::NotFound("No packages found for this application".to_string())
                    })
            })?
        } else {
            let version = opt_pkg_version_from_config
                .as_ref()
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .ok_or_else(|| {
                    ABError::BadRequest("Could not extract package version from config".to_string())
                })?;
            version
        }
    };

    let package_data = {
        let pool = state.db_pool.clone();
        let org = organisation.clone();
        let app = application.clone();

        run_blocking!({
            let mut conn = pool.get()?;
            packages_dsl::packages_v2
                .filter(
                    packages_dsl::org_id
                        .eq(&org)
                        .and(packages_dsl::app_id.eq(&app))
                        .and(packages_dsl::version.eq(pkg_version)),
                )
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)
                .map_err(|_| {
                    ABError::NotFound(format!("Package version {} not found", pkg_version))
                })
        })?
    };

    // check any resources don't overlap with important or lazy
    let check_resource_duplicacy = |resources: &Vec<String>| -> bool {
        for resource in resources {
            if package_data.files.contains(&Some(resource.clone())) {
                return true;
            }
        }
        false
    };

    // check if a file group exists in package  -> returns (exists, file_that_does_not_exist)
    let check_file_group_exists_in_package = |file_paths: &Vec<String>| -> (bool, Option<String>) {
        for file_path in file_paths {
            if !package_data.files.contains(&Some(file_path.clone())) {
                return (false, Some(file_path.clone()));
            }
        }
        (true, None)
    };

    let (final_important, final_lazy, final_resources, final_properties) =
        if let Some(package_req) = &req.package {
            // case where package_id is provided -> Expect to get important and lazy : package_update is true
            // case where package_id is not provided and package block is provided -> Use whatever is in request package and others from config : package_update is false
            let mut f_imp: Option<Vec<String>> = if package_update {
                Some(vec![])
            } else {
                imp_from_configs
            };
            let mut f_lazy: Option<Vec<String>> = if package_update {
                Some(vec![])
            } else {
                lazy_from_configs
            };

            if let Some(req_imp) = &package_req.important {
                let (exists, file_that_does_not_exist) =
                    check_file_group_exists_in_package(req_imp);
                if !exists {
                    return Err(ABError::BadRequest(format!(
                        "Important file '{}' not found in package {}",
                        file_that_does_not_exist.unwrap_or_default(),
                        pkg_version
                    )));
                }
                f_imp = Some(req_imp.clone());
            }

            if let Some(req_lazy) = &package_req.lazy {
                let (exists, file_that_does_not_exist) =
                    check_file_group_exists_in_package(req_lazy);
                if !exists {
                    return Err(ABError::BadRequest(format!(
                        "Lazy file '{}' not found in package {}",
                        file_that_does_not_exist.unwrap_or_default(),
                        pkg_version
                    )));
                }
                f_lazy = Some(req_lazy.clone());
            }
            if let (Some(important), Some(lazy)) = (&package_req.important, &package_req.lazy) {
                let important_set: HashSet<&String> = important.iter().collect();
                let lazy_set: HashSet<&String> = lazy.iter().collect();
                let overlap: Vec<&String> =
                    important_set.intersection(&lazy_set).cloned().collect();
                if !overlap.is_empty() {
                    return Err(ABError::BadRequest(format!(
                        "Files cannot be in both important and lazy splits: {:?}",
                        overlap
                    )));
                }
            }

            let f_resources = if let Some(resources) = &req.resources {
                if check_resource_duplicacy(resources) {
                    return Err(ABError::BadRequest(format!(
                        "Resource cannot be a file in package {}",
                        pkg_version
                    )));
                }
                req.resources.clone()
            } else {
                if resources_from_configs.is_some()
                    && check_resource_duplicacy(&resources_from_configs.clone().unwrap_or_default())
                {
                    return Err(ABError::BadRequest(format!(
                        "Resource cannot be a file in package {}",
                        pkg_version
                    )));
                }
                resources_from_configs
            };

            (f_imp, f_lazy, f_resources, package_req.properties.clone())
        } else {
            // handle if package id is provided but package block was not provided
            if req.package_id.is_some() {
                return Err(ABError::BadRequest(
                    "Package ID provided but no package block in request".to_string(),
                ));
            }

            (
                imp_from_configs,
                lazy_from_configs,
                resources_from_configs,
                None,
            )
        };

    info!(
        "Final: {:?}",
        (
            final_important.clone(),
            final_lazy.clone(),
            final_resources.clone()
        )
    );

    let combined_files = package_data
        .files
        .iter()
        .filter_map(|f| f.as_ref().cloned())
        .chain(final_resources.clone().unwrap_or_default())
        .chain(vec![package_data.index.clone()])
        .collect::<Vec<String>>();

    let files = utils::get_files_by_file_keys_async(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        combined_files.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get files by keys: {}", e)))?;

    if files.len() != combined_files.len() {
        return Err(ABError::InternalServerError(
            "Some files were missing in DB".to_string(),
        ));
    }

    let now = Utc::now();
    let config_version = uuid::Uuid::new_v4().to_string();

    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert(
        "package.version".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)),
    );

    if let Some(Document::Object(obj)) = &config_document {
        if let Some(version) = obj.get("config.version") {
            control_overrides.insert("config.version".to_string(), version.clone());
        } else {
            control_overrides.insert(
                "config.version".to_string(),
                Document::String(config_version.clone()),
            );
        }
        if let Some(boot_timeout) = obj.get("config.boot_timeout") {
            control_overrides.insert("config.boot_timeout".to_string(), boot_timeout.clone());
        } else {
            control_overrides.insert(
                "config.boot_timeout".to_string(),
                Document::Number(aws_smithy_types::Number::PosInt(req.config.boot_timeout)),
            );
        }
        if let Some(release_config_timeout) = obj.get("config.release_config_timeout") {
            control_overrides.insert(
                "config.release_config_timeout".to_string(),
                release_config_timeout.clone(),
            );
        } else {
            control_overrides.insert(
                "config.release_config_timeout".to_string(),
                Document::Number(aws_smithy_types::Number::PosInt(
                    req.config.release_config_timeout,
                )),
            );
        }
        if let Some(props) = obj.get("config.properties") {
            control_overrides.insert("config.properties".to_string(), props.clone());
        } else {
            control_overrides.insert(
                "config.properties".to_string(),
                Document::Object(std::collections::HashMap::new()),
            );
        }
        if let Some(version) = obj.get("package.name") {
            control_overrides.insert("package.name".to_string(), version.clone());
        } else {
            control_overrides.insert("package.name".to_string(), Document::String("".to_string()));
        }
        if let Some(package_idx) = obj.get("package.index") {
            control_overrides.insert("package.index".to_string(), package_idx.clone());
        } else {
            control_overrides.insert(
                "package.index".to_string(),
                Document::String("".to_string()),
            );
        }
        if let Some(version) = obj.get("package.version") {
            control_overrides.insert("package.version".to_string(), version.clone());
        } else {
            control_overrides.insert(
                "package.version".to_string(),
                Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)),
            );
        }
        if let Some(props) = obj.get("package.properties") {
            control_overrides.insert("package.properties".to_string(), props.clone());
        } else {
            control_overrides.insert(
                "package.properties".to_string(),
                Document::Object(std::collections::HashMap::new()),
            );
        }
        if let Some(important) = obj.get("package.important") {
            control_overrides.insert("package.important".to_string(), important.clone());
        } else {
            let default_important_docs: Vec<Document> = package_data
                .files
                .iter()
                .filter_map(|f| f.as_ref().map(|s| Document::String(s.clone())))
                .collect();
            control_overrides.insert(
                "package.important".to_string(),
                Document::Array(default_important_docs),
            );
        }
        if let Some(lazy) = obj.get("package.lazy") {
            control_overrides.insert("package.lazy".to_string(), lazy.clone());
        } else {
            control_overrides.insert("package.lazy".to_string(), Document::Array(Vec::new()));
        }
        if let Some(resources) = obj.get("resources") {
            control_overrides.insert("resources".to_string(), resources.clone());
        } else {
            control_overrides.insert("resources".to_string(), Document::Array(Vec::new()));
        }
    } else {
        // Config is empty, throw internal error
        return Err(ABError::InternalServerError(
            "Resolved config is not an object".to_string(),
        ));
    }

    let mut experimental_overrides: std::collections::HashMap<String, Document> =
        std::collections::HashMap::new();
    experimental_overrides.insert(
        "config.version".to_string(),
        Document::String(config_version.clone()),
    );
    experimental_overrides.insert(
        "config.boot_timeout".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(req.config.boot_timeout)),
    );
    experimental_overrides.insert(
        "config.release_config_timeout".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(
            req.config.release_config_timeout,
        )),
    );

    let config_props = value_to_document(&req.config.properties.clone().unwrap_or_default());

    experimental_overrides.insert("config.properties".to_string(), config_props.clone());
    experimental_overrides.insert(
        "package.name".to_string(),
        Document::String(application.clone()),
    );
    experimental_overrides.insert(
        "package.version".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)),
    );
    experimental_overrides.insert(
        "package.index".to_string(),
        Document::String(package_data.index.clone()),
    );

    if let Some(ref properties) = final_properties {
        experimental_overrides.insert(
            "package.properties".to_string(),
            utils::value_to_document(properties),
        );
    } else {
        experimental_overrides.insert(
            "package.properties".to_string(),
            Document::Object(std::collections::HashMap::new()),
        );
    }
    if let Some(ref imp_vec) = final_important {
        let imp_docs: Vec<Document> = imp_vec.iter().cloned().map(Document::String).collect();
        experimental_overrides.insert("package.important".to_string(), Document::Array(imp_docs));
    }
    if let Some(ref lazy_vec) = final_lazy {
        let lazy_docs: Vec<Document> = lazy_vec.iter().cloned().map(Document::String).collect();
        experimental_overrides.insert("package.lazy".to_string(), Document::Array(lazy_docs));
    }
    if let Some(ref resources) = final_resources {
        let res_docs: Vec<Document> = resources.iter().cloned().map(Document::String).collect();
        experimental_overrides.insert("resources".to_string(), Document::Array(res_docs));
    }

    info!("Control overrides: {:?}", control_overrides);
    info!("Experimental overrides: {:?}", experimental_overrides);

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
        .variants(control_variant)
        .variants(experimental_variant);

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

    Ok(Json(CreateReleaseResponse {
        id: experiment_id_for_ramping.clone(),
        created_at: now,
        config: Config {
            boot_timeout: req.config.boot_timeout as u32,
            release_config_timeout: req.config.release_config_timeout as u32,
            version: config_version.clone(),
            properties: config_props.clone().as_object().map(|obj| {
                obj.iter()
                    .map(|(k, v)| {
                        (
                            k.clone(),
                            utils::document_to_value(v).unwrap_or(Value::Null),
                        )
                    })
                    .collect()
            }),
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
    req: actix_web::HttpRequest,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<ListReleaseResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, READ)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;
    let application = validate_user(auth_response.application, READ)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(utils::parse_kv_string)
        .unwrap_or_default();

    let experiments_list = state
        .superposition_client
        .list_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .customize()
        .mutate_request(move |req| {
            let uri: http::Uri = match req.uri().parse() {
                Ok(uri) => uri,
                Err(e) => {
                    info!("Failed to parse URI from request: {:?}", e);
                    return;
                }
            };

            let mut parts = uri.into_parts();
            let (path, existing_q) = match parts.path_and_query.take() {
                Some(pq) => {
                    let s = pq.as_str();
                    match s.split_once('?') {
                        Some((p, q)) => (p.to_string(), Some(q.to_string())),
                        None => (s.to_string(), None),
                    }
                }
                None => ("/".to_string(), None),
            };

            let mut ser = form_urlencoded::Serializer::new(String::new());
            if let Some(eq) = existing_q {
                for (k, v) in form_urlencoded::parse(eq.as_bytes()) {
                    ser.append_pair(&k, &v);
                }
            }
            for (k, v) in &context {
                if let Some(val_str) = v.as_str() {
                    ser.append_pair(&format!("dimension[{k}]"), val_str);
                }
            }

            let new_q = ser.finish();
            let pq = if new_q.is_empty() {
                path
            } else {
                format!("{path}?{new_q}")
            };

            let path_and_query = match PathAndQuery::from_str(&pq) {
                Ok(pq) => pq,
                Err(e) => {
                    info!("Failed to create valid path/query from '{}': {:?}", pq, e);
                    return; // Skip URI modification on error
                }
            };

            parts.path_and_query = Some(path_and_query);

            let new_uri = match Uri::from_parts(parts) {
                Ok(uri) => uri,
                Err(e) => {
                    info!("Failed to create valid URI from parts: {:?}", e);
                    return;
                }
            };

            *req.uri_mut() = new_uri.into();
        })
        .send()
        .await
        .map_err(|e| {
            info!("Failed to list experiments: {:?}", e);
            ABError::InternalServerError(
                "Failed to list experiments from Superposition".to_string(),
            )
        })?;

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
            .and_then(|obj| obj.get("config.properties"))
            .and_then(utils::document_to_value)
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

        let release_response = CreateReleaseResponse {
            id: experiment.id.to_string(),
            created_at,
            config: Config {
                boot_timeout: rc_boot_timeout as u32,
                release_config_timeout: rc_release_config_timeout as u32,
                version: rc_version,
                properties: Some(rc_config_properties),
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

    releases.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(Json(ListReleaseResponse { releases }))
}

#[post("/{release_id}/ramp")]
async fn ramp_release(
    release_id: Path<String>,
    req: Json<RampReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<RampReleaseResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;

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
) -> Result<(), actix_web::Error> {
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
            error::ErrorInternalServerError("Failed to ramp experiment in Superposition")
        })?;
    Ok(())
}

#[post("/{release_id}/conclude")]
async fn conclude_release(
    release_id: Path<String>,
    req: Json<ConcludeReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<ConcludeReleaseResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("".to_string()))?;

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

#[get("{organisation}/{application}")]
async fn serve_release(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    query: web::Query<ServeReleaseQueryParams>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ABError> {
    let (organisation, application) = path.into_inner();
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

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
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(utils::parse_kv_string)
        .unwrap_or_default();

    // If toss not sent fallback to
    let toss = query.into_inner().toss.unwrap_or("99".into());

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
    let opt_rc_config_properties = &config_document.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            obj.get("config.properties")
                .and_then(utils::document_to_value)
        } else {
            None
        }
    });

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

    // let nested_config_props_result =
    //     dotted_docs_to_nested(opt_rc_config_properties.unwrap_or_default().into_iter());
    // let nested_config_props_response = nested_config_props_result.unwrap_or_else(|err| {
    //     Value::Object(serde_json::Map::new())
    // });

    let release_response = ServeReleaseResponse {
        version: "2".to_string(),
        config: Config {
            boot_timeout: rc_boot_timeout as u32,
            release_config_timeout: rc_release_config_timeout as u32,
            version: rc_version.clone(),
            properties: opt_rc_config_properties.clone(),
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

    let response = actix_web::HttpResponse::Ok()
        .insert_header((
            actix_web::http::header::CACHE_CONTROL,
            "Cache-Control: public, max-age=86400, stale-while-revalidate=60",
        ))
        .insert_header((actix_web::http::header::CONTENT_TYPE, "application/json"))
        .json(release_response);
    Ok(response)
}
