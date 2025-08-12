use actix_web::{get, post, web::{self, Json, Query}, HttpResponse, Scope, error};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use diesel::{pg::Pg, prelude::*, sql_types::Bool, BoxableExpression};
use chrono::{DateTime, Utc, NaiveDateTime, TimeZone};
use uuid::Uuid;
use superposition_rust_sdk::types::builders::VariantBuilder;
use aws_smithy_types::{Document};

use crate::{
    file::utils::parse_file_key, 
    middleware::auth::{validate_user, AuthResponse, READ, WRITE}, 
    package::utils::parse_package_key, 
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

fn dt(x: &aws_smithy_types::DateTime) -> String {
    // Convert smithy datetime to milliseconds since epoch
    let millis_since_epoch = x.to_millis().expect("Failed to convert DateTime to millis");

    // Split into whole seconds and remaining milliseconds
    let secs = millis_since_epoch / 1000;
    let millis = (millis_since_epoch % 1000) as u32;

    // Create NaiveDateTime from seconds + nanos
    let naive = NaiveDateTime::from_timestamp(secs, millis * 1_000_000);

    // Format in ISO 8601 with milliseconds
    Utc.from_utc_datetime(&naive).format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
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

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_release)
        .service(get_release)
        .service(list_releases)
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

    let experiments_list = state
        .superposition_client
        .list_experiment()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .send()
        .await
        .map_err(|e| {
            eprintln!("Failed to list experiments: {:?}", e);
            error::ErrorInternalServerError("Failed to list experiments from Superposition")
        })?;

    let experiments = experiments_list.data();

    let last_release = experiments
        .into_iter()
        .filter(|exp| exp.name.contains(&format!("{}-{}-release-exp", application, organisation)))
        .max_by_key(|exp| exp.created_at.clone());

    let pkg_version = if let Some(package_id) = &req.package_id {
        let (version_opt, _) = parse_package_key(package_id);
        version_opt.ok_or_else(|| {
            error::ErrorBadRequest(format!(
                "Package ID should contain version: {}",
                package_id
            ))
        })?
    } else {
        packages_dsl::packages_v2
            .filter(
                packages_dsl::org_id.eq(&organisation)
                    .and(packages_dsl::app_id.eq(&application))
            )
            .order_by(packages_dsl::version.desc())
            .select(packages_dsl::version)
            .first::<i32>(&mut conn)
            .map_err(|_| error::ErrorNotFound("No packages found for this application".to_string()))?
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

    let (final_important, final_lazy, final_properties) = if let Some(package_req) = &req.package {
        if let Some(important) = &package_req.important {
            for file_path in important {
                if !package_data.files.contains(&Some(file_path.clone())) {
                    return Err(error::ErrorBadRequest(format!(
                        "Important file '{}' not found in package {}",
                        file_path, pkg_version
                    )));
                }
            }
        }
        if let Some(lazy) = &package_req.lazy {
            for file_path in lazy {
                if !package_data.files.contains(&Some(file_path.clone())) {
                    return Err(error::ErrorBadRequest(format!(
                        "Lazy file '{}' not found in package {}",
                        file_path, pkg_version
                    )));
                }
            }
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
        (
            package_req.important.clone(),
            package_req.lazy.clone(),
            package_req.properties.clone(),
        )
    } else if req.package_id.is_some() {
        let default_properties = last_release
            .as_ref()
            .and_then(|exp| {
                exp.variants.iter()
                    .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental)
                    .and_then(|v| v.overrides.as_object())
                    .and_then(|obj| obj.get("package.properties"))
                    .and_then(document_to_value)
            });

        let all_files_as_important: Vec<String> = package_data
            .files
            .iter()
            .filter_map(|f| f.as_ref().map(|s| s.clone()))
            .collect();

        (
            Some(all_files_as_important),
            Some(vec![]),
            default_properties,
        )
    } else {
        let last_exp_defaults = last_release.as_ref().and_then(|exp| {
            exp.variants.iter()
                .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental)
        });
        
        let default_important = last_exp_defaults
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
                    }).collect())
                } else {
                    None
                }
            });
            
        let default_lazy = last_exp_defaults
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
                    }).collect())
                } else {
                    None
                }
            });
            
        let default_properties = last_exp_defaults
            .and_then(|v| v.overrides.as_object())
            .and_then(|obj| obj.get("package.properties"))
            .and_then(document_to_value);
        
        (
            default_important,
            default_lazy,
            default_properties,
        )
    };

    let release_id = Uuid::new_v4();
    let now = Utc::now();

    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)));

    if let Some(last_exp) = &last_release {
        if let Some(exp_variant) = last_exp.variants.iter()
            .find(|v| v.variant_type == superposition_rust_sdk::types::VariantType::Experimental) {
            if let Some(obj) = exp_variant.overrides.as_object() {
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
            }
        }
    } else {
        control_overrides.insert("package.properties".to_string(), Document::Object(std::collections::HashMap::new()));
        let default_important_docs: Vec<Document> = package_data.files.iter()
            .filter_map(|f| f.as_ref().map(|s| Document::String(s.clone())))
            .collect();
        control_overrides.insert("package.important".to_string(), Document::Array(default_important_docs));
        control_overrides.insert("package.lazy".to_string(), Document::Array(Vec::new()));
        control_overrides.insert("resources".to_string(), Document::Array(Vec::new()));
    }

    let mut experimental_overrides: std::collections::HashMap<String, Document> = std::collections::HashMap::new();
    experimental_overrides.insert("package.version".to_string(), Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)));

    if let Some(ref properties) = final_properties {
        experimental_overrides.insert("package.properties".to_string(), value_to_document(properties));
    }
    if let Some(ref imp_vec) = final_important {
        let imp_docs: Vec<Document> = imp_vec.iter().cloned().map(Document::String).collect();
        experimental_overrides.insert("package.important".to_string(), Document::Array(imp_docs));
    }
    if let Some(ref lazy_vec) = final_lazy {
        let lazy_docs: Vec<Document> = lazy_vec.iter().cloned().map(Document::String).collect();
        experimental_overrides.insert("package.lazy".to_string(), Document::Array(lazy_docs));
    }
    if let Some(ref resources) = req.resources {
        let res_docs: Vec<Document> = resources.iter().cloned().map(Document::String).collect();
        experimental_overrides.insert("resources".to_string(), Document::Array(res_docs));
    }

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

    let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

    for file_id in &package_data.files {
        let (fp, ver_opt, tag_opt) = parse_file_key(&file_id.clone().unwrap_or("".to_string()));

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

    let response_important = final_important.unwrap_or_else(|| {
        package_data.files.iter()
            .filter_map(|f| f.as_ref().cloned())
            .collect()
    });

    let response_lazy = final_lazy.unwrap_or_default();

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

        println!("Package important files: {:?}", package_important);

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
            
        let (important_files, lazy_files) = {
            // Build file conditions for querying
            let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();
            
            let all_files = package_important.iter()
                .chain(package_lazy.iter())
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
                    let important_files: Vec<File> = package_important.iter().filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                            file_path: file.file_path.clone(),
                            url: file.url.clone(),
                            checksum: file.checksum.clone()
                        })
                    }).collect();
                    println!("Important files: {:?}", important_files);
                    
                    let lazy_files: Vec<File> = package_lazy.iter().filter_map(|file_key| {
                        let (file_path, _, _) = parse_file_key(file_key);
                        files.iter().find(|file| file.file_path == file_path.clone()).map(|file| File {
                            file_path: file.file_path.clone(),
                            url: file.url.clone(),
                            checksum: file.checksum.clone()
                        })
                    }).collect();

                    println!("Lazy files: {:?}", lazy_files);
                    
                    (important_files, lazy_files)
                } else {
                    (Vec::new(), Vec::new())
                }
            } else {
                (Vec::new(), Vec::new())
            }
        };

        println!("Important 1files: {:?}", important_files);
        println!("Lazy 1files: {:?}", lazy_files);
        
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
                properties: package_properties,
                important: important_files,
                lazy: lazy_files,
            },
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