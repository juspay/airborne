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

use diesel::{pg::Pg, pg::PgConnection, prelude::*, r2d2::{ConnectionManager, PooledConnection}, sql_types::Bool, BoxableExpression};
use chrono::{DateTime, Utc};
use aws_smithy_types::{Document};
use serde_json::Value;
use superposition_sdk::types::Variant;

use crate::{
    file::utils::parse_file_key, release::types::*, utils::db::{
            models::FileEntry,
            schema::hyperotaserver::files::{
                    app_id as file_dsl_app_id, file_path as file_dsl_path, org_id as file_dsl_org_id, table as files_table, tag as file_dsl_tag, version as file_dsl_version
                },
        }
};

pub fn extract_files_from_configs(opt_obj: &Option<Document>, key: &str) -> Option<Vec<String>> {
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
}

pub fn extract_string_from_configs(opt_obj: &Option<Document>, key: &str) -> Option<String> {
    opt_obj
    .as_ref()
    .and_then(|doc| {
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

pub fn extract_integer_from_configs<T>(opt_obj: &Option<Document>, key: &str) -> T where T: Default + From<i64> + From<u32> {
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

pub fn extract_files_from_experiment(experimental_variant: &Option<&Variant>, key: &str) -> Vec<String> {
    experimental_variant
        .and_then(|v| v.overrides.as_object())
        .and_then(|obj| obj.get(key))
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
        .unwrap_or_default()
}

pub fn extract_integer_from_experiment<T>(experimental_variant: &Option<&Variant>, key: &str) -> T where T: Default + From<i32> + From<i64> + From<u32> {
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

pub fn extract_string_from_experiment(experimental_variant: &Option<&Variant>, key: &str) -> String {
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

pub fn get_files_by_file_keys(conn: &mut PooledConnection<ConnectionManager<PgConnection>>, organisation: &String, application: &String, file_paths: &Vec<String>) -> Result<Vec<FileEntry>, actix_web::error::Error> {
    if file_paths.is_empty() {
        return Ok(vec![]);
    }
    let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

    for file_id in file_paths {
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
        .unwrap_or(Box::new(file_dsl_path.eq("")));

    let files: Vec<FileEntry> = files_table
        .into_boxed::<Pg>()
        .filter(file_dsl_org_id.eq(organisation))
        .filter(file_dsl_app_id.eq(application))
        .filter(combined)
        .load(conn)
        .map_err(actix_web::error::ErrorInternalServerError)?;
    Ok(files)
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
        }.to_string(),
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
    datetime.unwrap_or_else(|| Utc::now()).format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
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
pub fn document_to_value(doc: &Document) -> Option<serde_json::Value> {
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
    distribution_id: &str) -> Result<(), aws_sdk_cloudfront::Error> {
    // Make this unique on each call
    let caller_reference = format!("invalidate-{}", Utc::now().timestamp_nanos_opt().unwrap_or(rand::random::<i64>()));

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
