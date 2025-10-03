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
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    str::FromStr,
};

use actix_web::web::{self, Json};
use aws_smithy_types::Document;
use chrono::{DateTime, Utc};
use diesel::{pg::Pg, prelude::*, sql_types::Bool, BoxableExpression};
use http::{uri::PathAndQuery, Uri};
use log::info;
use serde_json::Value;
use superposition_sdk::{operation::list_experiment::ListExperimentOutput, types::Variant};
use url::form_urlencoded;

use crate::{
    file::utils::parse_file_key,
    package::utils::parse_package_key,
    release::types::*,
    run_blocking,
    types::{ABError, AppState},
    utils::db::{
        models::FileEntry,
        schema::hyperotaserver::files::{
            app_id as file_dsl_app_id, file_path as file_dsl_path, org_id as file_dsl_org_id,
            table as files_table, tag as file_dsl_tag, version as file_dsl_version,
        },
        DbPool,
    },
    utils::db::{models::PackageV2Entry, schema::hyperotaserver::packages_v2::dsl as packages_dsl},
};

pub fn extract_files_from_configs(opt_obj: &Option<Document>, key: &str) -> Option<Vec<String>> {
    opt_obj.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            let v: Option<Vec<String>> = obj.get(key).and_then(document_to_value).and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|val| val.as_str().map(|s| s.to_string()))
                        .collect()
                })
            });
            v
        } else {
            None
        }
    })
}

pub fn extract_string_from_configs(opt_obj: &Option<Document>, key: &str) -> Option<String> {
    opt_obj.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            obj.get(key)
                .and_then(document_to_value)
                .and_then(|v| v.as_str().map(|s| s.to_string()))
        } else {
            None
        }
    })
}

pub fn extract_file_from_configs(opt_obj: &Option<Document>, key: &str) -> Option<String> {
    extract_string_from_configs(opt_obj, key)
}

pub fn extract_integer_from_configs<T>(opt_obj: &Option<Document>, key: &str) -> T
where
    T: Default + From<i64> + From<u32>,
{
    opt_obj
        .as_ref()
        .and_then(|doc| {
            if let Document::Object(obj) = doc {
                obj.get(key)
                    .and_then(document_to_value)
                    .and_then(|v| v.as_i64().map(|i| T::from(i)))
            } else {
                None
            }
        })
        .unwrap_or_default()
}

pub fn extract_files_from_experiment(
    experimental_variant: &Option<&Variant>,
    key: &str,
) -> Vec<String> {
    experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get(key))
        .and_then(|doc| {
            if let Document::Array(arr) = doc {
                Some(
                    arr.iter()
                        .filter_map(|d| {
                            if let Document::String(s) = d {
                                Some(s.clone())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<String>>(),
                )
            } else {
                None
            }
        })
        .unwrap_or_default()
}

pub fn extract_integer_from_experiment<T>(experimental_variant: &Option<&Variant>, key: &str) -> T
where
    T: Default + From<i32> + From<i64> + From<u32>,
{
    experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get(key))
        .and_then(|doc: &Document| {
            if let Document::Number(s) = doc {
                let f = s.to_f64_lossy();
                if let Ok(i) = i64::try_from(f as i128) {
                    Some(T::from(i))
                } else if let Ok(u) = u32::try_from(f as u64) {
                    Some(T::from(u))
                } else {
                    None
                }
            } else {
                None
            }
        })
        .unwrap_or_default()
}

pub fn extract_string_from_experiment(
    experimental_variant: &Option<&Variant>,
    key: &str,
) -> String {
    experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get(key))
        .and_then(|doc| {
            if let Document::String(s) = doc {
                Some(s.clone())
            } else {
                None
            }
        })
        .unwrap_or_default()
}

pub fn extract_file_from_experiment(experimental_variant: &Option<&Variant>, key: &str) -> String {
    extract_string_from_experiment(experimental_variant, key)
}

pub async fn get_files_by_file_keys_async(
    pool: DbPool,
    organisation: String,
    application: String,
    file_paths: Vec<String>,
) -> Result<Vec<FileEntry>, ABError> {
    if file_paths.is_empty() {
        return Ok(vec![]);
    }

    run_blocking!({
        let mut conn = pool.get()?;

        let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

        for file_id in &file_paths {
            let (fp, ver_opt, tag_opt) = parse_file_key(&file_id.clone());

            if let Some(v) = ver_opt {
                file_conds.push(Box::new(
                    file_dsl_path.eq(fp.clone()).and(file_dsl_version.eq(v)),
                ));
            } else if let Some(t) = tag_opt {
                file_conds.push(Box::new(
                    file_dsl_path.eq(fp.clone()).and(file_dsl_tag.eq(t.clone())),
                ));
            } else {
                return Err(ABError::BadRequest("Invalid file key format".to_string()));
            }
        }

        let combined = file_conds
            .into_iter()
            .reduce(|a, b| Box::new(a.or(b)))
            .unwrap_or(Box::new(file_dsl_path.eq("")));

        let files: Vec<FileEntry> = files_table
            .into_boxed::<Pg>()
            .filter(file_dsl_org_id.eq(&organisation))
            .filter(file_dsl_app_id.eq(&application))
            .filter(combined)
            .load(&mut conn)?;

        Ok(files)
    })
}

pub fn build_release_experiment_from_experiment(
    experiment: &superposition_sdk::types::ExperimentResponse,
    package_version: i32,
) -> ReleaseExperiment {
    ReleaseExperiment {
        experiment_id: experiment.id.to_string(),
        package_version,
        config_version: format!("v{}", package_version),
        created_at: dt(&experiment.created_at),
        traffic_percentage: experiment.traffic_percentage as u32,
        status: match experiment.status {
            superposition_sdk::types::ExperimentStatusType::Created => "CREATED",
            superposition_sdk::types::ExperimentStatusType::Inprogress => "INPROGRESS",
            superposition_sdk::types::ExperimentStatusType::Concluded => "CONCLUDED",
            superposition_sdk::types::ExperimentStatusType::Discarded => "DISCARDED",
            _ => "UNKNOWN",
        }
        .to_string(),
    }
}

pub fn dt(x: &aws_smithy_types::DateTime) -> String {
    // Convert smithy datetime to milliseconds since epoch
    let millis_since_epoch = x.to_millis().unwrap_or(0);

    // Split into whole seconds and remaining milliseconds
    let secs = millis_since_epoch / 1000;
    let millis = (millis_since_epoch % 1000) as u32;

    // Create DateTime from seconds + nanos
    let datetime = DateTime::from_timestamp(secs, millis * 1_000_000);

    // Format in ISO 8601 with milliseconds
    datetime
        .unwrap_or_else(Utc::now)
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

// Helper function to convert serde_json::Value to Document
pub fn value_to_document(value: &serde_json::Value) -> Document {
    match value {
        serde_json::Value::Null => Document::Null,
        serde_json::Value::Bool(b) => Document::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                if i >= 0 {
                    Document::Number(aws_smithy_types::Number::PosInt(i as u64))
                } else {
                    Document::Number(aws_smithy_types::Number::NegInt(i))
                }
            } else if let Some(f) = n.as_f64() {
                Document::Number(aws_smithy_types::Number::Float(f))
            } else {
                Document::Null
            }
        }
        serde_json::Value::String(s) => Document::String(s.clone()),
        serde_json::Value::Array(arr) => {
            let docs: Vec<Document> = arr.iter().map(value_to_document).collect();
            Document::Array(docs)
        }
        serde_json::Value::Object(obj) => {
            let map: std::collections::HashMap<String, Document> = obj
                .iter()
                .map(|(k, v)| (k.clone(), value_to_document(v)))
                .collect();
            Document::Object(map)
        }
    }
}

// Helper function to convert Document to serde_json::Value
pub fn document_to_value(doc: &Document) -> Option<serde_json::Value> {
    match doc {
        Document::Null => Some(serde_json::Value::Null),
        Document::Bool(b) => Some(serde_json::Value::Bool(*b)),
        Document::Number(n) => match n {
            aws_smithy_types::Number::NegInt(i) => {
                Some(serde_json::Value::Number(serde_json::Number::from(*i)))
            }
            aws_smithy_types::Number::PosInt(i) => {
                if let Ok(i_as_i64) = i64::try_from(*i) {
                    Some(serde_json::Value::Number(serde_json::Number::from(
                        i_as_i64,
                    )))
                } else {
                    Some(serde_json::Value::Null)
                }
            }
            aws_smithy_types::Number::Float(f) => {
                if let Some(num) = serde_json::Number::from_f64(*f) {
                    Some(serde_json::Value::Number(num))
                } else {
                    Some(serde_json::Value::Null)
                }
            }
        },
        Document::String(s) => Some(serde_json::Value::String(s.clone())),
        Document::Array(arr) => {
            let values: Option<Vec<serde_json::Value>> =
                arr.iter().map(document_to_value).collect();
            values.map(serde_json::Value::Array)
        }
        Document::Object(obj) => {
            let map: Option<serde_json::Map<String, serde_json::Value>> = obj
                .iter()
                .map(|(k, v)| document_to_value(v).map(|val| (k.clone(), val)))
                .collect();
            map.map(serde_json::Value::Object)
        }
    }
}

pub fn parse_kv_string(input: &str) -> HashMap<String, Value> {
    input
        .split(';')
        .filter(|pair| !pair.is_empty())
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.trim();
            let value = parts.next()?.trim();
            Some((key.to_string(), Value::String(value.to_string())))
        })
        .collect()
}

pub async fn invalidate_cf(
    client: &aws_sdk_cloudfront::Client,
    path: String,
    distribution_id: &str,
) -> Result<(), aws_sdk_cloudfront::Error> {
    // Make this unique on each call
    let caller_reference = format!("invalidate-{}", uuid::Uuid::new_v4());

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
            info!("Invalidation created: {:?}", inv.id);
        })
        .unwrap_or_else(|| {
            info!("Invalidation created but no ID returned");
        });

    Ok(())
}

pub async fn check_non_concluded_releases(
    superposition_org_id: String,
    dims: HashMap<String, Value>,
    state: web::Data<AppState>,
    workspace: String,
) -> Result<bool, ABError> {
    let experiments_list = list_experiments_by_context(
        superposition_org_id.clone(),
        workspace.clone(),
        dims,
        true,
        state.clone(),
    )
    .await?;

    let non_concluded_exists = experiments_list.data().iter().any(|exp| {
        matches!(
            exp.status,
            superposition_sdk::types::ExperimentStatusType::Created
                | superposition_sdk::types::ExperimentStatusType::Inprogress
        )
    });
    Ok(non_concluded_exists)
}

pub async fn build_overrides(
    req: &Json<CreateReleaseRequest>,
    superposition_org_id: String,
    application: String,
    organisation: String,
    dims: HashMap<String, Value>,
    state: web::Data<AppState>,
    workspace: String,
) -> Result<BuildOverrides, ABError> {
    let resolved_config_builder = dims.iter().fold(
        state
            .superposition_client
            .get_resolved_config()
            .workspace_id(workspace.clone())
            .org_id(superposition_org_id.clone())
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

    let imp_from_configs = extract_files_from_configs(&config_document, "package.important");
    let lazy_from_configs = extract_files_from_configs(&config_document, "package.lazy");
    let resources_from_configs = extract_files_from_configs(&config_document, "resources");

    // If you give me package_id -> I'll expect you to provide me complete important and lazy splits
    // If you just want to PATCH the important or lazy blocks -> DO NOT provide me the package_id
    //
    let mut package_update = false;
    let mut is_first_release = false;
    let opt_pkg_version_from_config = &config_document.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            obj.get("package.version").and_then(document_to_value)
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

    let files = get_files_by_file_keys_async(
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

    let config_version = uuid::Uuid::new_v4().to_string();

    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert(
        "package.version".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)),
    );

    let put_config_props_in_experiment = |properties: &BTreeMap<String, Document>,
                                          overrides_map: &mut HashMap<String, Document>|
     -> () {
        for (key, value) in properties {
            overrides_map.insert(format!("config.properties.{}", key), value.clone());
        }
    };

    let opt_old_config_props = config_document.as_ref().and_then(|doc| {
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
    let opt_old_config_props_cloned = opt_old_config_props.clone();

    if let Some(Document::Object(obj)) = &config_document {
        for (key, value) in obj {
            control_overrides.insert(key.clone(), value.clone());
        }
    } else {
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
    experimental_overrides.insert(
        "config.properties".to_string(),
        Document::Object(std::collections::HashMap::new()),
    );
    let config_properties: BTreeMap<String, aws_smithy_types::Document> =
        if let Some(ref props) = req.config.properties {
            props
                .iter()
                .map(|(k, v)| (k.clone(), value_to_document(v)))
                .collect()
        } else {
            opt_old_config_props_cloned.unwrap_or_default()
        };

    put_config_props_in_experiment(&config_properties, &mut experimental_overrides);
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
            value_to_document(properties),
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

    Ok(BuildOverrides {
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
    })
}

pub async fn list_experiments_by_context(
    superposition_org_id: String,
    workspace_name: String,
    context: HashMap<String, Value>,
    strict_mode: bool,
    state: web::Data<AppState>,
) -> Result<ListExperimentOutput, ABError> {
    let experiments_list = state
        .superposition_client
        .list_experiment()
        .org_id(superposition_org_id)
        .workspace_id(workspace_name)
        .dimension_match_strategy(superposition_sdk::types::DimensionMatchStrategy::Exact)
        .global_experiments_only(context.is_empty() && strict_mode)
        .all(true)
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
    Ok(experiments_list)
}
