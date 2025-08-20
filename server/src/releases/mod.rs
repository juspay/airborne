use actix_web::{get, post, patch, web::{self, Json, Query, Path}, HttpResponse, Scope, error};
use serde::{Deserialize, Serialize};
use serde_json::{Value};
use std::collections::{HashMap, HashSet};
use diesel::{pg::Pg, prelude::*, sql_types::Bool, BoxableExpression};
use chrono::{DateTime, Utc};
use superposition_rust_sdk::types::builders::VariantBuilder;
use aws_smithy_types::{Document};

use crate::{
    file::utils::parse_file_key, 
    middleware::auth::{validate_user, AuthResponse, READ, WRITE}, 
    package::{self, utils::parse_package_key}, 
    types::AppState, 
    utils::{
        db::{
            models::{FileEntry, PackageV2Entry},
            schema::hyperotaserver::{
                files::{
                    app_id as file_dsl_app_id, file_path as file_dsl_path, org_id as file_dsl_org_id, table as files_table, tag as file_dsl_tag, version as file_dsl_version
                },
                packages_v2::dsl as packages_dsl
            },
        },
        workspace::get_workspace_name_for_application,
    }
};

#[derive(Deserialize)]
pub struct GetReleaseQuery {
    release_key: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateReleaseRequest {
    package_id: Option<String>,
    config: Option<HashMap<String, serde_json::Value>>,
    package: Option<PackageRequest>,
    dimensions: Option<HashMap<String, serde_json::Value>>,
    resources: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct PackageRequest {
    properties: Option<serde_json::Value>,
    important: Option<Vec<String>>,
    lazy: Option<Vec<String>>,
}

#[derive(Serialize, Debug)]
struct File {
    file_path: String,
    url: String,
    checksum: String,
}

#[derive(Serialize)]
struct Package {
    version: i32,
    index: String,
    properties: Value,
    important: Vec<File>,
    lazy: Vec<File>,
}

#[derive(Serialize)]
struct Config {
    boot_timeout: u64,
    package_timeout: u64,
}

#[derive(Serialize)]
struct CreateReleaseResponse {
    id: String,
    created_at: DateTime<Utc>,
    config: Config,
    package: Package,
    resources: Vec<File>,
    experiment: Option<ReleaseExperiment>
}

#[derive(Serialize, Debug)]
struct ReleaseExperiment {
    experiment_id: String,
    package_version: i32,
    config_version: String,
    created_at: String,
    traffic_percentage: u32,
    status: String,
}

#[derive(Serialize)]
struct ListReleaseResponse {
    releases: Vec<CreateReleaseResponse>
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileResource {
    pub url: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
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

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_release)
        .service(get_release)
        .service(list_releases)
        .service(ramp_release)
        .service(conclude_release)
}

#[get("")]
async fn get_release(
    query: Query<GetReleaseQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse> {
    let release_key = query.into_inner().release_key;
    if release_key.is_empty() {
        return Err(actix_web::error::ErrorBadRequest("Release Key cannot be empty"));
    }

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

    let exp_details = state
        .superposition_client
        .get_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(release_key.clone())
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to get experiment details: {:?}", e);
            error::ErrorNotFound("Release/Experiment not found")
        })?;

    let package_version = exp_details.name
        .split('-')
        .last()
        .and_then(|part| part.strip_prefix("exp"))
        .and_then(|v| v.parse::<i32>().ok())
        .or_else(|| {
            exp_details.variants.iter()
                .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental)
                .and_then(|v| v.id.strip_prefix("experimental_"))
                .and_then(|v| v.parse::<i32>().ok())
        })
        .unwrap_or(0);

    let experimental_variant = exp_details.variants.iter()
        .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental);

    let package_properties = experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get("package.properties"))
        .and_then(document_to_value)
        .unwrap_or_default();

    let package_important = experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get("package.important"))
        .and_then(|doc| {
            if let Document::Array(arr) = doc {
                Some(arr.iter().filter_map(|d| {
                    if let Document::String(s) = d {
                        Some(s.clone())
                    } else {
                        None
                    }
                }).collect::<Vec<String>>())
            } else {
                None
            }
        })
        .unwrap_or_default();

    let package_lazy = experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get("package.lazy"))
        .and_then(|doc| {
            if let Document::Array(arr) = doc {
                Some(arr.iter().filter_map(|d| {
                    if let Document::String(s) = d {
                        Some(s.clone())
                    } else {
                        None
                    }
                }).collect::<Vec<String>>())
            } else {
                None
            }
        })
        .unwrap_or_default();

    let resources = experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get("resources"))
        .and_then(|doc| {
            if let Document::Array(arr) = doc {
                Some(arr.iter().filter_map(|d| {
                    if let Document::String(s) = d {
                        Some(s.clone())
                    } else {
                        None
                    }
                }).collect::<Vec<String>>())
            } else {
                None
            }
        })
        .unwrap_or_default();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": release_key,
        "experiment_id": release_key,
        "org_id": organisation,
        "app_id": application,
        "package_version": package_version,
        "config_version": format!("v{}", package_version),
        "created_at": dt(&exp_details.created_at),
        "traffic_percentage": exp_details.traffic_percentage,
        "status": match exp_details.status {
            superposition_rust_sdk::types::ExperimentStatusType::Created => "CREATED",
            superposition_rust_sdk::types::ExperimentStatusType::Inprogress => "INPROGRESS",
            superposition_rust_sdk::types::ExperimentStatusType::Concluded => "CONCLUDED",
            superposition_rust_sdk::types::ExperimentStatusType::Discarded => "DISCARDED",
            _ => "UNKNOWN",
        },
        "variants": exp_details.variants.iter().map(|variant| {
            serde_json::json!({
                "id": variant.id,
                "variant_type": match variant.variant_type {
                    superposition_rust_sdk::types::VariantType::Control => "control",
                    superposition_rust_sdk::types::VariantType::Experimental => "experimental",
                    _ => "unknown",
                }
            })
        }).collect::<Vec<_>>(),
        "configuration": {
            "package": {
                "properties": package_properties,
                "important": package_important,
                "lazy": package_lazy
            },
            "resources": resources
        }
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

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();


    let dimensions = req.dimensions.clone().unwrap_or_default();
    let dims1 = dimensions.clone();
    println!("Dimensions: {:?}", serde_json::json!(dimensions));

    let resolved_config_builder = dims1.iter().fold(
        state.superposition_client.get_resolved_config()
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
    println!("resolved config result: {:?}", resolved_config);
    
    let config_document = match resolved_config {
        Ok(config) => {
            println!("config from superposition: {:?}", config);
            config.config
        },
        Err(e) => {
            println!("Failed to get resolved config: {}", e);
            None
        }
    };

    let extract_files_from_configs = |opt_obj: &Option<Document>, key: &str| -> Option<Vec<String>> {
        opt_obj
        .as_ref()
        .and_then(|doc| {
            if let Document::Object(obj) = doc {
                let v: Option<Vec<String>> = obj.get(key)
                    .and_then(document_to_value)
                    .and_then(|v| v.as_array().map(|arr| {
                        arr.iter()
                            .filter_map(|val| val.as_str().map(|s| s.to_string()))
                            .collect()
                    }));
                v
            } else {
                None
            }
        })
    };

    let imp_from_configs = extract_files_from_configs(&config_document, "package.important");
    let lazy_from_configs = extract_files_from_configs(&config_document, "package.lazy");
    let resources_from_configs = extract_files_from_configs(&config_document, "resources");

    // If you give me package_id -> I'll expect you to provide me complete important and lazy splits
    // If you just want to PATCH the important or lazy blocks -> DO NOT provide me the package_id
    //
    let mut package_update = false;
    let mut is_first_release = false;
    let opt_pkg_version_from_config = &config_document
        .as_ref()
        .and_then(|doc| {
            if let Document::Object(obj) = doc {
                obj.get("package.version")
                    .and_then(document_to_value)
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
            error::ErrorBadRequest(format!(
                "Package ID should contain version: {}",
                package_id
            ))
        })?
    } else {
        if is_first_release {
            return Err(error::ErrorBadRequest("First release must provide package_id".to_string()));
        }
        if !opt_pkg_version_from_config.is_some() {
            packages_dsl::packages_v2
            .filter(
                packages_dsl::org_id.eq(&organisation)
                    .and(packages_dsl::app_id.eq(&application))
            )
            .order_by(packages_dsl::version.desc())
            .select(packages_dsl::version)
            .first::<i32>(&mut conn)
            .map_err(|_| error::ErrorNotFound("No packages found for this application".to_string()))?
        }else{
            let version = opt_pkg_version_from_config
                .as_ref()
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .ok_or_else(|| error::ErrorBadRequest("Could not extract package version from config"))?;
            version
        }
    };

    let package_data = packages_dsl::packages_v2
        .filter(
            packages_dsl::org_id.eq(&organisation)
                .and(packages_dsl::app_id.eq(&application))
                .and(packages_dsl::version.eq(pkg_version)),
        )
        .select(PackageV2Entry::as_select())
        .first::<PackageV2Entry>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("Package version {} not found", pkg_version)))?;

    // check any resources don't overlap with important or lazy
    let check_resource_duplicacy = |resources: &Vec<String>| -> bool {
        for resource in resources {
            if package_data.files.contains(&Some(resource.clone())) {
                return true
            }
        }
        false
    };

    // check if a file group exists in package  -> returns (exists, file_that_does_not_exist)
    let check_file_group_exists_in_package = |file_paths: &Vec<String>, | -> (bool, Option<String>) {
        for file_path in file_paths {
            if !package_data.files.contains(&Some(file_path.clone())) {
                return (false, Some(file_path.clone()));
            }
        }
        (true, None)
    };

    let (final_important, final_lazy, final_resources, final_properties) = if let Some(package_req) = &req.package {
        // case where package_id is provided -> Expect to get important and lazy : package_update is true
        // case where package_id is not provided and package block is provided -> Use whatever is in request package and others from config : package_update is false
        let mut f_imp: Option<Vec<String>> = if package_update { Some(vec![]) } else { imp_from_configs };
        let mut f_lazy: Option<Vec<String>> = if package_update { Some(vec![]) } else { lazy_from_configs };

        if let Some(req_imp) = &package_req.important {
            let (exists, file_that_does_not_exist) = check_file_group_exists_in_package(&req_imp);
            if !exists {
                return Err(error::ErrorBadRequest(format!(
                    "Important file '{}' not found in package {}",
                    file_that_does_not_exist.unwrap_or_default(), pkg_version
                )));
            }
            f_imp = Some(req_imp.clone());
        }

        if let Some(req_lazy) = &package_req.lazy {
            let (exists, file_that_does_not_exist) = check_file_group_exists_in_package(&req_lazy);
            if !exists {
                return Err(error::ErrorBadRequest(format!(
                    "Lazy file '{}' not found in package {}",
                    file_that_does_not_exist.unwrap_or_default(), pkg_version
                )));
            }
            f_lazy = Some(req_lazy.clone());
        }
        if let (Some(important), Some(lazy)) = (&package_req.important, &package_req.lazy) {
            let important_set: HashSet<&String> = important.iter().collect();
            let lazy_set: HashSet<&String> = lazy.iter().collect();
            let overlap: Vec<&String> = important_set.intersection(&lazy_set).cloned().collect();
            if !overlap.is_empty() {
                return Err(error::ErrorBadRequest(format!(
                    "Files cannot be in both important and lazy splits: {:?}",
                    overlap
                )));
            }
        }
        
        let f_resources = if let Some(resources) = &req.resources {
            if check_resource_duplicacy(resources) {
                return Err(error::ErrorBadRequest(format!(
                    "Resource cannot be a file in package {}",
                    pkg_version
                )));
            }
            req.resources.clone()
        } else {
            if resources_from_configs.is_some() && check_resource_duplicacy(&resources_from_configs.clone().unwrap_or_default()) {
                return Err(error::ErrorBadRequest(format!(
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
            return Err(error::ErrorBadRequest("Package ID provided but no package block in request".to_string()));
        }

        (imp_from_configs, lazy_from_configs, resources_from_configs, None)
    };

    println!("Final: {:?}", (final_important.clone(), final_lazy.clone(), final_resources.clone()));

    let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

    let combined_files = package_data.files.iter()
        .filter_map(|f| f.as_ref().cloned())
        .chain(final_resources.clone().unwrap_or_default())
        .collect::<Vec<String>>();

    for file_id in &combined_files {
        let (fp, ver_opt, tag_opt) = parse_file_key(&file_id.clone());

        if let Some(v) = ver_opt {
            file_conds.push(Box::new(
                file_dsl_path
                    .eq(fp.clone())
                    .and(file_dsl_version.eq(v))
            ));
        } else if let Some(t) = tag_opt {
            file_conds.push(Box::new(
                file_dsl_path
                    .eq(fp.clone())
                    .and(file_dsl_tag.eq(t.clone()))
            ));
        } else {
            return Err(actix_web::error::ErrorBadRequest("Invalid file key format"));
        }
    }

    let combined = file_conds
        .into_iter()
        .reduce(|a, b| Box::new(a.or(b)))
        .expect("Package should have files");

    let files: Vec<FileEntry> = files_table
        .into_boxed::<Pg>()
        .filter(file_dsl_org_id.eq(&organisation))
        .filter(file_dsl_app_id.eq(&application))
        .filter(combined)
        .load(&mut conn)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    if files.len() != combined_files.len() {
        return Err(actix_web::error::ErrorInternalServerError("Some files were missing in DB"));
    }

    let now = Utc::now();

    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)));
    
    if !is_first_release {
        if let Some(Document::Object(obj)) = &config_document {
            control_overrides.insert("package.name".to_string(), Document::String(workspace_name.clone()));
            if let Some(version) = obj.get("package.version") {
                control_overrides.insert("package.version".to_string(), version.clone());
            } else {
                control_overrides.insert("package.version".to_string(), Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)));
            }
            if let Some(props) = obj.get("package.properties") {
                control_overrides.insert("package.properties".to_string(), props.clone());
            } else {
                control_overrides.insert("package.properties".to_string(), Document::Object(std::collections::HashMap::new()));
            }
            if let Some(important) = obj.get("package.important") {
                control_overrides.insert("package.important".to_string(), important.clone());
            } else {
                let default_important_docs: Vec<Document> = package_data.files.iter()
                    .filter_map(|f| f.as_ref().map(|s| Document::String(s.clone())))
                    .collect();
                control_overrides.insert("package.important".to_string(), Document::Array(default_important_docs));
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
            return Err(error::ErrorInternalServerError("Resolved config is not an object".to_string()));
        }
    }

    let mut experimental_overrides: std::collections::HashMap<String, Document> = std::collections::HashMap::new();
    experimental_overrides.insert("package.name".to_string(), Document::String(workspace_name.clone()));
    experimental_overrides.insert("package.version".to_string(), Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)));

    if let Some(ref properties) = final_properties {
        experimental_overrides.insert("package.properties".to_string(), value_to_document(properties));
    } else {
        experimental_overrides.insert("package.properties".to_string(), Document::Object(std::collections::HashMap::new()));
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

    // If it's first release, make control same as experimental
    if is_first_release {
        control_overrides = experimental_overrides.clone();
        control_overrides.insert("package.version".to_string(), Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)));
    }

    println!("Control overrides: {:?}", control_overrides);
    println!("Experimental overrides: {:?}", experimental_overrides);

    let control_variant = VariantBuilder::default()
        .id("control".to_string())
        .variant_type(superposition_rust_sdk::types::VariantType::Control)
        .overrides(Document::Object(control_overrides))
        .build()
        .map_err(error::ErrorInternalServerError)?;

    let experimental_variant_id = format!("experimental_{}", pkg_version);
    
    let experimental_variant = VariantBuilder::default()
        .id(experimental_variant_id.clone())
        .variant_type(superposition_rust_sdk::types::VariantType::Experimental)
        .overrides(Document::Object(experimental_overrides))
        .build()
        .map_err(error::ErrorInternalServerError)?;

    let context = if let Some(dims) = &req.dimensions {
        let conditions: Vec<Document> = dims.iter().map(|(key, value)| {
            let condition = serde_json::json!({
                "==": [
                    {"var": key},
                    value
                ]
            });
            value_to_document(&condition)
        }).collect();
        conditions
    } else {
        vec![]
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
            "Release creation for application {} with PATCH-style overrides",
            application
        ))
        .variants(control_variant)
        .variants(experimental_variant);

    let created_experiment_response = if !context.is_empty() {
        created_experiment_response.context("and", Document::Array(context))
    } else {
        created_experiment_response.set_context(Some(std::collections::HashMap::new()))
    };
    
    let created_experiment_response = created_experiment_response.send().await.map_err(|e| {
        eprintln!("Failed to create experiment: {:?}", e);
        error::ErrorInternalServerError("Failed to create experiment in Superposition".to_string())
    })?;

    let experiment_id_for_ramping = created_experiment_response.id.to_string();

    let response_important = final_important.unwrap_or_else(|| {
        package_data.files.iter()
            .filter_map(|f| f.as_ref().cloned())
            .collect()
    });

    let response_lazy = final_lazy.unwrap_or_default();

    let response_resources = final_resources.unwrap_or_default();

    Ok(Json(CreateReleaseResponse {
        id: experiment_id_for_ramping.clone(),
        created_at: now,
        config: Config {
            boot_timeout: 4000,
            package_timeout: 4000
        },
        package: Package {
            version: pkg_version,
            index: req.package_id.clone().unwrap_or_else(|| format!("pkg@version:{}", pkg_version)),
            properties: final_properties.unwrap_or_default(),
            important: response_important.iter().filter_map(|file_key| {
                let (file_path, _, _) = parse_file_key(file_key);
                files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                    file_path: file.file_path.clone(),
                    url: file.url.clone(),
                    checksum: file.checksum.clone()
                })
            }).collect(),
            lazy: response_lazy.iter().filter_map(|file_key| {
                let (file_path, _, _) = parse_file_key(file_key);
                files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                    file_path: file.file_path.clone(),
                    url: file.url.clone(),
                    checksum: file.checksum.clone()
                })
            }).collect(),
        },
        resources: response_resources.iter().filter_map(|file_key| {
            let (file_path, _, _) = parse_file_key(file_key);
            files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                file_path: file.file_path.clone(),
                url: file.url.clone(),
                checksum: file.checksum.clone()
            })
        }).collect(),
        experiment: Some(ReleaseExperiment {
            experiment_id: experiment_id_for_ramping,
            package_version: pkg_version,
            config_version: format!("v{}", pkg_version),
            created_at: now.to_string(),
            traffic_percentage: 0, // Default to 100% for new releases
            status: "CREATED".to_string()
        })
    }))
}

#[get("/list")]
async fn list_releases(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<ListReleaseResponse>> {
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

    let experiments_list = state
        .superposition_client
        .list_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to list experiments: {:?}", e);
            error::ErrorInternalServerError("Failed to list experiments from Superposition")
        })?;

    let experiments = experiments_list.data();

    let release_experiments: Vec<_> = experiments
        .into_iter()
        .filter(|exp| exp.name.contains(&format!("{}-{}-release-exp", application, organisation)))
        .collect();

    let mut releases = Vec::new();
    
    for experiment in release_experiments {
        let package_version = experiment.name
            .split('-')
            .last()
            .and_then(|part| part.strip_prefix("exp"))
            .and_then(|v| v.parse::<i32>().ok())
            .or_else(|| {
                experiment.variants.iter()
                    .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental)
                    .and_then(|v| v.id.strip_prefix("experimental_"))
                    .and_then(|v| v.parse::<i32>().ok())
            })
            .unwrap_or(0);

        let experimental_variant = experiment.variants.iter()
            .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental);

        let rc_package_properties = experimental_variant
            .and_then(|v| v.overrides.as_object())
            .and_then(|obj| obj.get("package.properties"))
            .and_then(document_to_value)
            .unwrap_or_default();

        let rc_package_important = experimental_variant
            .and_then(|v| v.overrides.as_object())
            .and_then(|obj| obj.get("package.important"))
            .and_then(|doc| {
                if let Document::Array(arr) = doc {
                    Some(arr.iter().filter_map(|d| {
                        if let Document::String(s) = d {
                            Some(s.clone())
                        } else {
                            None
                        }
                    }).collect::<Vec<String>>())
                } else {
                    None
                }
            })
            .unwrap_or_default();

        let rc_package_lazy = experimental_variant
            .and_then(|v| v.overrides.as_object())
            .and_then(|obj| obj.get("package.lazy"))
            .and_then(|doc| {
                if let Document::Array(arr) = doc {
                    Some(arr.iter().filter_map(|d| {
                        if let Document::String(s) = d {
                            Some(s.clone())
                        } else {
                            None
                        }
                    }).collect::<Vec<String>>())
                } else {
                    None
                }
            })
            .unwrap_or_default();

        let rc_resources = experimental_variant
            .and_then(|v| v.overrides.as_object())
            .and_then(|obj| obj.get("resources"))
            .and_then(|doc| {
                if let Document::Array(arr) = doc {
                    Some(arr.iter().filter_map(|d| {
                        if let Document::String(s) = d {
                            Some(s.clone())
                        } else {
                            None
                        }
                    }).collect::<Vec<String>>())
                } else {
                    None
                }
            })
            .unwrap_or_default();

        println!("Resources files: {:?}", rc_resources);

        let (important_files, lazy_files, resource_files) = {
            // Build file conditions for querying
            let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

            let all_files = rc_package_important.iter()
                .chain(rc_package_lazy.iter())
                .chain(rc_resources.iter())
                .cloned()
                .collect::<Vec<String>>();

            for file_id in all_files {
                let (fp, ver_opt, tag_opt) = parse_file_key(&file_id);
                
                if let Some(v) = ver_opt {
                    file_conds.push(Box::new(
                        file_dsl_path
                            .eq(fp.clone())
                            .and(file_dsl_version.eq(v))
                    ));
                } else if let Some(t) = tag_opt {
                    file_conds.push(Box::new(
                        file_dsl_path
                            .eq(fp.clone())
                            .and(file_dsl_tag.eq(t.clone()))
                    ));
                }
            }

            // println!("File conditions: {:?}", file_conds);
            
            if let Some(combined) = file_conds
                .into_iter()
                .reduce(|a, b| Box::new(a.or(b))) {
                
                let files_result: Result<Vec<FileEntry>, _> = files_table
                    .into_boxed::<Pg>()
                    .filter(file_dsl_org_id.eq(&organisation))
                    .filter(file_dsl_app_id.eq(&application))
                    .filter(combined)
                    .load(&mut conn);

                println!("Files result: {:?}", files_result);
                
                if let Ok(files) = files_result {
                    let important_files: Vec<File> = rc_package_important.iter().filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                            file_path: file.file_path.clone(),
                            url: file.url.clone(),
                            checksum: file.checksum.clone()
                        })
                    }).collect();
                    println!("Important files: {:?}", important_files);
                    
                    let lazy_files: Vec<File> = rc_package_lazy.iter().filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                            file_path: file.file_path.clone(),
                            url: file.url.clone(),
                            checksum: file.checksum.clone()
                        })
                    }).collect();

                    let resource_files: Vec<File> = rc_resources.iter().filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                            file_path: file.file_path.clone(),
                            url: file.url.clone(),
                            checksum: file.checksum.clone()
                        })
                    }).collect();

                    println!("Lazy files: {:?}", lazy_files);

                    (important_files, lazy_files, resource_files)
                } else {
                    (Vec::new(), Vec::new(), Vec::new())
                }
            } else {
                (Vec::new(), Vec::new(), Vec::new())
            }
        };

        println!("Important files: {:?}", important_files);
        println!("Lazy files: {:?}", lazy_files);
        
        // Parse created_at string to DateTime<Utc>
        let created_at_str = dt(&experiment.created_at);
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .unwrap_or_else(|_| Utc::now().into())
            .with_timezone(&Utc);

        let release_response = CreateReleaseResponse {
            id: experiment.id.to_string(),
            created_at,
            config: Config {
                boot_timeout: 4000,
                package_timeout: 4000
            },
            package: Package {
                version: package_version,
                index: format!("pkg@version:{}", package_version),
                properties: rc_package_properties,
                important: important_files,
                lazy: lazy_files,
            },
            resources: resource_files,
            experiment: Some(build_release_experiment_from_experiment(
                &experiment,
                package_version,
            )),
        };

        releases.push(release_response);
    }

    releases.sort_by(|a, b| {
        b.created_at.cmp(&a.created_at)
    });

    Ok(Json(ListReleaseResponse {
        releases,
    }))
}

#[patch("/{release_id}/ramp")]
async fn ramp_release(
    release_id: Path<String>,
    req: Json<RampReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<RampReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let experiment_id = release_id.to_string();

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            error::ErrorInternalServerError(format!("Failed to get workspace name: {}", e))
        })?;

    println!(
        "Ramping experiment {} to {}% traffic for release {} in workspace {} org {}",
        experiment_id, req.traffic_percentage, release_id, workspace_name, superposition_org_id_from_env
    );

    state
        .superposition_client
        .ramp_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .id(experiment_id.to_string())
        .traffic_percentage(req.traffic_percentage as i32)
        .change_reason(
            req.change_reason
                .clone()
                .unwrap_or_else(|| format!("Ramping release {} to {}% traffic", release_id, req.traffic_percentage))
        )
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to ramp experiment: {:?}", e);
            error::ErrorInternalServerError("Failed to ramp experiment in Superposition")
        })?;

    println!("Successfully ramped experiment {}", experiment_id);

    Ok(Json(RampReleaseResponse {
        success: true,
        message: format!("Release experiment ramped to {}% traffic", req.traffic_percentage),
        experiment_id: experiment_id.to_string(),
        traffic_percentage: req.traffic_percentage,
    }))
}

#[patch("/{release_id}/conclude")]
async fn conclude_release(
    release_id: Path<String>,
    req: Json<ConcludeReleaseRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<ConcludeReleaseResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let experiment_id = release_id.to_string();

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
            error::ErrorBadRequest(format!("Variant '{}' not found in experiment. Available variants: {:?}", 
                req.chosen_variant, 
                experiment_details.variants.iter().map(|v| &v.id).collect::<Vec<_>>()))
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
        .change_reason(
            req.change_reason
                .clone()
                .unwrap_or_else(|| format!("Concluding release {} with variant {}", release_id, req.chosen_variant))
        )
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to conclude experiment: {:?}", e);
            error::ErrorInternalServerError("Failed to conclude experiment in Superposition")
        })?;

    println!("Successfully concluded experiment {} with variant {}", experiment_id, transformed_variant_id);

    Ok(Json(ConcludeReleaseResponse {
        success: true,
        message: format!("Release experiment concluded with variant {}", req.chosen_variant),
        experiment_id: experiment_id.to_string(),
        chosen_variant: req.chosen_variant.clone(),
    }))
}

fn build_release_experiment_from_experiment(
    experiment: &superposition_rust_sdk::types::ExperimentResponse,
    package_version: i32,
) -> ReleaseExperiment {
    ReleaseExperiment {
        experiment_id: experiment.id.to_string(),
        package_version,
        config_version: format!("v{}", package_version),
        created_at: dt(&experiment.created_at),
        traffic_percentage: experiment.traffic_percentage as u32,
        status: match experiment.status {
            superposition_rust_sdk::types::ExperimentStatusType::Created => "CREATED",
            superposition_rust_sdk::types::ExperimentStatusType::Inprogress => "INPROGRESS",
            superposition_rust_sdk::types::ExperimentStatusType::Concluded => "CONCLUDED",
            superposition_rust_sdk::types::ExperimentStatusType::Discarded => "DISCARDED",
            _ => "UNKNOWN",
        }.to_string(),
    }
}

fn dt(x: &aws_smithy_types::DateTime) -> String {
    // Convert smithy datetime to milliseconds since epoch
    let millis_since_epoch = x.to_millis().expect("Failed to convert DateTime to millis");

    // Split into whole seconds and remaining milliseconds
    let secs = millis_since_epoch / 1000;
    let millis = (millis_since_epoch % 1000) as u32;

    // Create DateTime from seconds + nanos
    let datetime = DateTime::from_timestamp(secs, millis * 1_000_000);

    // Format in ISO 8601 with milliseconds
    datetime.unwrap_or_else(|| Utc::now()).format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

// Helper function to convert serde_json::Value to Document
fn value_to_document(value: &serde_json::Value) -> Document {
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
        },
        serde_json::Value::String(s) => Document::String(s.clone()),
        serde_json::Value::Array(arr) => {
            let docs: Vec<Document> = arr.iter().map(value_to_document).collect();
            Document::Array(docs)
        },
        serde_json::Value::Object(obj) => {
            let map: std::collections::HashMap<String, Document> = obj.iter()
                .map(|(k, v)| (k.clone(), value_to_document(v)))
                .collect();
            Document::Object(map)
        }
    }
}

// Helper function to convert Document to serde_json::Value
fn document_to_value(doc: &Document) -> Option<serde_json::Value> {
    match doc {
        Document::Null => Some(serde_json::Value::Null),
        Document::Bool(b) => Some(serde_json::Value::Bool(*b)),
        Document::Number(n) => match n {
            aws_smithy_types::Number::NegInt(i) => Some(serde_json::Value::Number(serde_json::Number::from(*i))),
            aws_smithy_types::Number::PosInt(i) => {
                if let Ok(i_as_i64) = i64::try_from(*i) {
                    Some(serde_json::Value::Number(serde_json::Number::from(i_as_i64)))
                } else {
                    Some(serde_json::Value::Null)
                }
            },
            aws_smithy_types::Number::Float(f) => {
                if let Some(num) = serde_json::Number::from_f64(*f) {
                    Some(serde_json::Value::Number(num))
                } else {
                    Some(serde_json::Value::Null)
                }
            },
        },
        Document::String(s) => Some(serde_json::Value::String(s.clone())),
        Document::Array(arr) => {
            let values: Option<Vec<serde_json::Value>> = arr.iter()
                .map(document_to_value)
                .collect();
            values.map(serde_json::Value::Array)
        },
        Document::Object(obj) => {
            let map: Option<serde_json::Map<String, serde_json::Value>> = obj.iter()
                .map(|(k, v)| document_to_value(v).map(|val| (k.clone(), val)))
                .collect();
            map.map(serde_json::Value::Object)
        }
    }
}