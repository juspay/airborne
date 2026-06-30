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
use superposition_sdk::{
    operation::list_experiment::ListExperimentOutput,
    types::{ExperimentSortOn, SortBy, Variant, VariantType},
};
use url::form_urlencoded;

use crate::{
    file::utils::parse_file_key,
    package::utils::parse_package_key,
    release::types::*,
    run_blocking, types as airborne_types,
    types::{ABError, AppState},
    utils::db::{models::PackageV2Entry, schema::hyperotaserver::packages_v2::dsl as packages_dsl},
    utils::db::{
        models::{FileEntry, PackageGroupsEntry},
        schema::hyperotaserver::{
            files::{
                app_id as file_dsl_app_id, file_path as file_dsl_path, org_id as file_dsl_org_id,
                table as files_table, tag as file_dsl_tag, version as file_dsl_version,
            },
            package_groups::{
                app_id as package_group_app_id, id as pkg_group_id,
                is_primary as package_group_is_primary, org_id as package_group_org_id,
                table as package_groups_table,
            },
        },
        DbPool,
    },
};

/// Parses a sub-package key in the format "groupid@version"
/// Returns (group_id, version) if valid, or None if parsing fails
pub fn parse_sub_package_key(spec: &str) -> Option<(uuid::Uuid, i32)> {
    if let Some((group_id_str, version_str)) = spec.split_once('@') {
        let group_id = uuid::Uuid::parse_str(group_id_str).ok()?;
        let version = version_str.parse::<i32>().ok()?;
        Some((group_id, version))
    } else {
        None
    }
}

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

pub fn extract_vector_from_experiment(
    experimental_variant: &Option<&Variant>,
    key: &str,
) -> Vec<String> {
    experimental_variant
        .map(|v| &v.overrides)
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
        .map(|v| &v.overrides)
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
        .map(|v| &v.overrides)
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

pub fn extract_variants_from_experiment(variants: &[Variant]) -> ExperimentVariants {
    let control = variants
        .iter()
        .find(|v| v.variant_type == VariantType::Control)
        .map(|v| v.id.clone())
        .unwrap_or_default();

    let experimentals = variants
        .iter()
        .filter(|v| v.variant_type == VariantType::Experimental)
        .map(|v| v.id.clone())
        .collect();

    ExperimentVariants {
        control,
        experimentals,
    }
}

pub fn extract_file_from_experiment(experimental_variant: &Option<&Variant>, key: &str) -> String {
    extract_string_from_experiment(experimental_variant, key)
}

pub async fn get_files_by_file_keys_async(
    pool: DbPool,
    organisation: String,
    application: String,
    file_paths: Vec<String>,
) -> airborne_types::Result<Vec<FileEntry>> {
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
                    file_dsl_path
                        .eq(fp.clone())
                        .and(file_dsl_tag.is_not_distinct_from(t.clone())),
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
        experiment_variants: extract_variants_from_experiment(experiment.variants()),
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
) -> airborne_types::Result<()> {
    // Make this unique on each call
    let caller_reference = format!("invalidate-{}", uuid::Uuid::new_v4());

    let paths = aws_sdk_cloudfront::types::Paths::builder()
        .items(path)
        .quantity(1)
        .build()
        .map_err(|e| ABError::InternalServerError(format!("Failed to build paths: {}", e)))?;

    let batch = aws_sdk_cloudfront::types::InvalidationBatch::builder()
        .caller_reference(caller_reference)
        .paths(paths)
        .build()
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to build invalidation batch: {}", e))
        })?;

    let resp = client
        .create_invalidation()
        .distribution_id(distribution_id)
        .invalidation_batch(batch)
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to send invalidation request: {}", e))
        })?;

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
) -> airborne_types::Result<bool> {
    let experiments_list = list_experiments_by_context(
        ListExperimentsQuery {
            superposition_org_id: superposition_org_id.clone(),
            workspace_name: workspace.clone(),
            context: dims,
            strict_mode: true,
            page: None,
            count: None,
            all: true,
            status: None,
        },
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

// --- Helper structs for build_overrides decomposition ---

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

async fn fetch_config(
    state: &web::Data<AppState>,
    workspace: &str,
    superposition_org_id: &str,
    dims: &HashMap<String, Value>,
) -> Option<Document> {
    let resolved_config = dims
        .iter()
        .fold(
            state
                .superposition_client
                .get_resolved_config()
                .workspace_id(workspace.to_string())
                .org_id(superposition_org_id.to_string())
                .context("variantIds", vec![].into()),
            |builder, (key, value)| {
                builder.context(
                    key.clone(),
                    Document::String(value.as_str().unwrap_or("").to_string()),
                )
            },
        )
        .send()
        .await;
    info!("resolved config result: {:?}", resolved_config);

    match resolved_config {
        Ok(config) => {
            info!("config from superposition: {:?}", config);
            Some(config.config)
        }
        Err(e) => {
            info!("Failed to get resolved config: {}", e);
            None
        }
    }
}

fn parse_sub_package_keys(specs: &[String]) -> airborne_types::Result<Vec<(uuid::Uuid, i32)>> {
    let parsed: Vec<_> = specs
        .iter()
        .filter_map(|s| parse_sub_package_key(s))
        .collect();
    if parsed.len() != specs.len() {
        return Err(ABError::BadRequest(
            "Invalid sub_package format. Expected format: 'groupid@version'".to_string(),
        ));
    }
    Ok(parsed)
}

fn resolve_package_info(
    req: &Json<CreateReleaseRequest>,
    config_document: &Option<Document>,
) -> airborne_types::Result<PackageInfo> {
    let opt_pkg_version_from_config: Option<i32> = config_document.as_ref().and_then(|doc| {
        if let Document::Object(obj) = doc {
            obj.get("package.version")
                .and_then(document_to_value)
                .and_then(|v| v.as_i64().map(|v| v as i32))
        } else {
            None
        }
    });
    let is_first_release = opt_pkg_version_from_config == Some(0);

    let (version_opt, _) = parse_package_key(&req.package_id);
    let known_version = Some(version_opt.ok_or_else(|| {
        ABError::InternalServerError(format!(
            "Package ID should contain version: {}",
            req.package_id
        ))
    })?);

    Ok(PackageInfo {
        known_version,
        is_first_release,
    })
}

async fn fetch_package_db(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    known_version: Option<i32>,
    parsed_sub_packages: Vec<(uuid::Uuid, i32)>,
) -> airborne_types::Result<PackageDbData> {
    let pool = state.db_pool.clone();
    let org = organisation.to_string();
    let app = application.to_string();

    let (pkg_version, primary_group, package_data, sub_packages_data, sub_package_names) = run_blocking!(
        {
            let mut conn = pool.get()?;

            let primary_group: PackageGroupsEntry = package_groups_table
                .filter(package_group_org_id.eq(&org))
                .filter(package_group_app_id.eq(&app))
                .filter(package_group_is_primary.eq(true))
                .select(PackageGroupsEntry::as_select())
                .first::<PackageGroupsEntry>(&mut conn)?;

            let version = match known_version {
                Some(v) => v,
                None => packages_dsl::packages_v2
                    .filter(
                        packages_dsl::org_id
                            .eq(&org)
                            .and(packages_dsl::app_id.eq(&app))
                            .and(packages_dsl::package_group_id.eq(&primary_group.id)),
                    )
                    .order_by(packages_dsl::version.desc())
                    .select(packages_dsl::version)
                    .first::<i32>(&mut conn)
                    .map_err(|_| {
                        ABError::NotFound("No packages found for this application".to_string())
                    })?,
            };

            let package_data = packages_dsl::packages_v2
                .filter(
                    packages_dsl::org_id
                        .eq(&org)
                        .and(packages_dsl::app_id.eq(&app))
                        .and(packages_dsl::package_group_id.eq(&primary_group.id))
                        .and(packages_dsl::version.eq(version)),
                )
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)
                .map_err(|_| {
                    ABError::NotFound(format!(
                        "Package version {} not found in primary group",
                        version
                    ))
                })?;

            let (sub_entries, sub_names) = if parsed_sub_packages.is_empty() {
                (vec![], vec![])
            } else {
                let mut pkg_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> =
                    Vec::new();
                for (gid, ver) in &parsed_sub_packages {
                    pkg_conds.push(Box::new(
                        packages_dsl::package_group_id
                            .eq(gid)
                            .and(packages_dsl::version.eq(*ver)),
                    ));
                }
                let combined_pkg = pkg_conds
                    .into_iter()
                    .reduce(|a, b| Box::new(a.or(b)))
                    .unwrap();

                let entries: Vec<PackageV2Entry> = packages_dsl::packages_v2
                    .filter(packages_dsl::org_id.eq(&org))
                    .filter(packages_dsl::app_id.eq(&app))
                    .filter(combined_pkg)
                    .select(PackageV2Entry::as_select())
                    .load(&mut conn)?;

                if entries.len() != parsed_sub_packages.len() {
                    for (gid, ver) in &parsed_sub_packages {
                        let found = entries
                            .iter()
                            .any(|e| e.package_group_id == *gid && e.version == *ver);
                        if !found {
                            return Err(ABError::NotFound(format!(
                                "Sub-package version {} not found in group {}",
                                ver, gid
                            )));
                        }
                    }
                }

                let group_ids: Vec<uuid::Uuid> =
                    parsed_sub_packages.iter().map(|(gid, _)| *gid).collect();
                let groups: Vec<PackageGroupsEntry> = package_groups_table
                    .filter(pkg_group_id.eq_any(group_ids))
                    .select(PackageGroupsEntry::as_select())
                    .load(&mut conn)?;

                let group_map: HashMap<uuid::Uuid, &PackageGroupsEntry> =
                    groups.iter().map(|g| (g.id, g)).collect();

                let mut names = Vec::with_capacity(parsed_sub_packages.len());
                for (gid, ver) in &parsed_sub_packages {
                    let group = group_map.get(gid).ok_or_else(|| {
                        ABError::NotFound(format!("Package group {} not found", gid))
                    })?;

                    if group.is_primary {
                        return Err(ABError::BadRequest(format!(
                            "Sub-package group {} is a primary group. Sub-packages must come from non-primary groups.",
                            gid
                        )));
                    }

                    let sub_pkg = entries
                        .iter()
                        .find(|e| e.package_group_id == *gid && e.version == *ver)
                        .unwrap();
                    if sub_pkg.index.is_some() {
                        return Err(ABError::BadRequest(format!(
                            "Sub-package {}@{} has an index file. Sub-packages should not have index files.",
                            gid, ver
                        )));
                    }

                    names.push(group.name.clone());
                }

                (entries, names)
            };

            Ok((version, primary_group, package_data, sub_entries, sub_names))
        }
    )?;

    Ok(PackageDbData {
        pkg_version,
        primary_group,
        package_data,
        sub_packages_data,
        sub_package_names,
    })
}

fn validate_file_groups(
    req: &Json<CreateReleaseRequest>,
    package_data: &PackageV2Entry,
    sub_packages_data: &[PackageV2Entry],
    pkg_version: i32,
) -> airborne_types::Result<String> {
    let sub_package_file_keys: Vec<String> = sub_packages_data
        .iter()
        .flat_map(|pkg| pkg.files.iter().filter_map(|f| f.clone()))
        .collect();

    let all_package_files: HashSet<String> = package_data
        .files
        .iter()
        .filter_map(|f| f.clone())
        .chain(sub_package_file_keys.iter().cloned())
        .collect();

    let parse_path = |key: &str| {
        let (p, _, _) = parse_file_key(key);
        p
    };

    for file in &req.package.important {
        if !all_package_files.contains(file) {
            return Err(ABError::BadRequest(format!(
                "Important file '{}' not found in package or sub-packages",
                file
            )));
        }
    }

    for file in &req.package.lazy {
        if !all_package_files.contains(file) {
            return Err(ABError::BadRequest(format!(
                "Lazy file '{}' not found in package or sub-packages",
                file
            )));
        }
    }

    {
        let imp_set: HashSet<&String> = req.package.important.iter().collect();
        let lazy_set: HashSet<&String> = req.package.lazy.iter().collect();
        let overlap: Vec<&&String> = imp_set.intersection(&lazy_set).collect();
        if !overlap.is_empty() {
            return Err(ABError::BadRequest(format!(
                "Files cannot be in both important and lazy splits: {:?}",
                overlap
            )));
        }
    }

    for res in &req.resources {
        if all_package_files.contains(res) {
            return Err(ABError::BadRequest(format!(
                "Resource cannot be a file in package {}",
                pkg_version
            )));
        }
    }

    let primary_index = package_data.index.clone().ok_or_else(|| {
        ABError::InternalServerError("Primary package must have an index file".to_string())
    })?;

    // Mutual exclusivity: index, important, lazy, resources must not share file paths
    {
        let mut entries: Vec<(&str, Vec<String>)> =
            vec![("index", vec![parse_path(&primary_index)])];
        entries.push((
            "important",
            req.package
                .important
                .iter()
                .map(|k| parse_path(k))
                .collect(),
        ));
        entries.push((
            "lazy",
            req.package.lazy.iter().map(|k| parse_path(k)).collect(),
        ));
        entries.push((
            "resources",
            req.resources.iter().map(|k| parse_path(k)).collect(),
        ));

        for i in 0..entries.len() {
            for j in (i + 1)..entries.len() {
                let set_a: HashSet<&String> = entries[i].1.iter().collect();
                let set_b: HashSet<&String> = entries[j].1.iter().collect();
                let overlap: Vec<&&String> = set_a.intersection(&set_b).collect();
                if !overlap.is_empty() {
                    return Err(ABError::BadRequest(format!(
                        "File(s) {:?} appear in both '{}' and '{}'",
                        overlap, entries[i].0, entries[j].0
                    )));
                }
            }
        }
    }

    // Coverage: package files (primary + sub-packages) must exactly match important + lazy
    {
        let package_paths: HashSet<String> = package_data
            .files
            .iter()
            .filter_map(|f| f.as_ref().map(|key| parse_path(key)))
            .chain(sub_package_file_keys.iter().map(|key| parse_path(key)))
            .collect();

        let split_paths: HashSet<String> = req
            .package
            .important
            .iter()
            .chain(req.package.lazy.iter())
            .map(|key| parse_path(key))
            .collect();

        if package_paths != split_paths {
            let missing: Vec<&String> = package_paths.difference(&split_paths).collect();
            let extra: Vec<&String> = split_paths.difference(&package_paths).collect();
            return Err(ABError::BadRequest(format!(
                "Package files must exactly match important + lazy. Missing from splits: {:?}, Extra in splits: {:?}",
                missing, extra
            )));
        }
    }

    Ok(primary_index)
}

async fn fetch_release_files(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    important: &[String],
    lazy: &[String],
    resources: &[String],
    primary_index: &str,
) -> airborne_types::Result<Vec<FileEntry>> {
    let total_expected: usize = important.len() + lazy.len() + resources.len() + 1;

    let combined_files: Vec<String> = important
        .iter()
        .cloned()
        .chain(lazy.iter().cloned())
        .chain(resources.iter().cloned())
        .chain(std::iter::once(primary_index.to_string()))
        .collect();

    let files = get_files_by_file_keys_async(
        state.db_pool.clone(),
        organisation.to_string(),
        application.to_string(),
        combined_files,
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get files by keys: {}", e)))?;

    if files.len() != total_expected {
        return Err(ABError::InternalServerError(
            "Some files were missing in DB".to_string(),
        ));
    }

    Ok(files)
}

struct OverrideInputs<'a> {
    important: &'a [String],
    lazy: &'a [String],
    resources: &'a [String],
    sub_packages: &'a [String],
    properties: &'a Option<Value>,
}

fn build_override_maps(
    req: &Json<CreateReleaseRequest>,
    config_document: &Option<Document>,
    pkg_version: i32,
    application: &str,
    package_data: &PackageV2Entry,
    primary_index: &str,
    inputs: OverrideInputs<'_>,
) -> airborne_types::Result<OverrideMaps> {
    let config_version = uuid::Uuid::new_v4().to_string();

    let OverrideInputs {
        important,
        lazy,
        resources,
        sub_packages,
        properties,
    } = inputs;

    let mut control_overrides = HashMap::new();
    control_overrides.insert(
        "package.version".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)),
    );
    control_overrides.insert(
        "package.group_id".to_string(),
        Document::String(package_data.package_group_id.to_string()),
    );

    if let Some(Document::Object(obj)) = config_document {
        for (key, value) in obj {
            if !key.starts_with("build.") {
                control_overrides.insert(key.clone(), value.clone());
            }
        }
    } else {
        return Err(ABError::InternalServerError(
            "Resolved config is not an object".to_string(),
        ));
    }

    let mut experimental_overrides = HashMap::new();
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
        Document::Object(HashMap::new()),
    );

    let config_properties: BTreeMap<String, Document> = req
        .config
        .properties
        .iter()
        .map(|(k, v)| (k.clone(), value_to_document(v)))
        .collect();

    for (key, value) in &config_properties {
        experimental_overrides.insert(format!("config.properties.{}", key), value.clone());
    }
    experimental_overrides.insert(
        "package.name".to_string(),
        Document::String(application.to_string()),
    );
    experimental_overrides.insert(
        "package.version".to_string(),
        Document::Number(aws_smithy_types::Number::PosInt(pkg_version as u64)),
    );
    experimental_overrides.insert(
        "package.index".to_string(),
        Document::String(primary_index.to_string()),
    );
    experimental_overrides.insert(
        "package.group_id".to_string(),
        Document::String(package_data.package_group_id.to_string()),
    );

    experimental_overrides.insert(
        "package.properties".to_string(),
        properties
            .as_ref()
            .map(value_to_document)
            .unwrap_or_else(|| Document::Object(HashMap::new())),
    );

    let imp_docs: Vec<Document> = important.iter().cloned().map(Document::String).collect();
    experimental_overrides.insert("package.important".to_string(), Document::Array(imp_docs));

    let lazy_docs: Vec<Document> = lazy.iter().cloned().map(Document::String).collect();
    experimental_overrides.insert("package.lazy".to_string(), Document::Array(lazy_docs));

    let res_docs: Vec<Document> = resources.iter().cloned().map(Document::String).collect();
    experimental_overrides.insert("resources".to_string(), Document::Array(res_docs));

    let sub_pkg_docs: Vec<Document> = sub_packages.iter().cloned().map(Document::String).collect();
    experimental_overrides.insert("sub_packages".to_string(), Document::Array(sub_pkg_docs));

    Ok(OverrideMaps {
        config_version,
        config_properties,
        control_overrides,
        experimental_overrides,
    })
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

pub async fn build_overrides(
    req: &Json<CreateReleaseRequest>,
    superposition_org_id: String,
    application: String,
    organisation: String,
    dims: HashMap<String, Value>,
    state: web::Data<AppState>,
    workspace: String,
) -> airborne_types::Result<BuildOverrides> {
    let config_document = fetch_config(&state, &workspace, &superposition_org_id, &dims).await;
    let sub_packages = &req.sub_packages.clone().unwrap_or_default();

    let info = resolve_package_info(req, &config_document)?;
    let parsed_sub_packages = parse_sub_package_keys(sub_packages)?;

    let db_data = fetch_package_db(
        &state,
        &organisation,
        &application,
        info.known_version,
        parsed_sub_packages,
    )
    .await?;

    let primary_index = validate_file_groups(
        req,
        &db_data.package_data,
        &db_data.sub_packages_data,
        db_data.pkg_version,
    )?;

    let files = fetch_release_files(
        &state,
        &organisation,
        &application,
        &req.package.important,
        &req.package.lazy,
        &req.resources,
        &primary_index,
    )
    .await?;

    let inputs = OverrideInputs {
        important: &req.package.important,
        lazy: &req.package.lazy,
        resources: &req.resources,
        sub_packages,
        properties: &req.package.properties,
    };
    let overrides = build_override_maps(
        req,
        &config_document,
        db_data.pkg_version,
        &application,
        &db_data.package_data,
        &primary_index,
        inputs,
    )?;

    let mut validation_map = serde_json::Map::new();
    validation_map.insert(
        db_data.primary_group.name.clone(),
        db_data.package_data.metadata.clone(),
    );
    for (sub_pkg, name) in db_data
        .sub_packages_data
        .iter()
        .zip(db_data.sub_package_names.iter())
    {
        validation_map.insert(name.clone(), sub_pkg.metadata.clone());
    }
    let validation_context = serde_json::Value::Object(validation_map);

    info!("Control overrides: {:?}", overrides.control_overrides);
    info!(
        "Experimental overrides: {:?}",
        overrides.experimental_overrides
    );

    Ok(BuildOverrides {
        final_important: req.package.important.clone(),
        package_data: db_data.package_data,
        is_first_release: info.is_first_release,
        final_lazy: req.package.lazy.clone(),
        final_resources: req.resources.clone(),
        config_version: overrides.config_version,
        config_properties: overrides.config_properties,
        pkg_version: db_data.pkg_version,
        files,
        final_properties: req.package.properties.clone().unwrap_or_default(),
        control_overrides: overrides.control_overrides,
        experimental_overrides: overrides.experimental_overrides,
        sub_packages: sub_packages.clone(),
        validation_context,
    })
}

pub async fn list_experiments_by_context(
    experiment_query: ListExperimentsQuery,
    state: web::Data<AppState>,
) -> airborne_types::Result<ListExperimentOutput> {
    let mut experiments_builder = state
        .superposition_client
        .list_experiment()
        .org_id(experiment_query.superposition_org_id)
        .workspace_id(experiment_query.workspace_name)
        .dimension_match_strategy(superposition_sdk::types::DimensionMatchStrategy::Exact)
        .global_experiments_only(
            experiment_query.context.is_empty() && experiment_query.strict_mode,
        )
        .sort_on(ExperimentSortOn::CreatedAt)
        .sort_by(SortBy::Desc);

    if experiment_query.all || (experiment_query.page.is_none() && experiment_query.count.is_none())
    {
        experiments_builder = experiments_builder.all(true);
    } else {
        if let Some(p) = experiment_query.page {
            experiments_builder = experiments_builder.page(p as i32);
        }
        if let Some(c) = experiment_query.count {
            experiments_builder = experiments_builder.count(c as i32);
        }
    }

    if let Some(s) = experiment_query.status {
        experiments_builder = experiments_builder.status(s);
    }

    let experiments_builder = experiments_builder.customize().mutate_request(move |req| {
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
        for (k, v) in &experiment_query.context {
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
    });

    let experiments_list = experiments_builder.send().await.map_err(|e| {
        info!("Failed to list experiments: {:?}", e);
        ABError::InternalServerError("Failed to list experiments from Superposition".to_string())
    })?;
    Ok(experiments_list)
}
