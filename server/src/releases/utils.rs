use diesel::{pg::Pg, pg::PgConnection, prelude::*, r2d2::{ConnectionManager, PooledConnection}, sql_types::Bool, BoxableExpression};
use chrono::{DateTime, Utc};
use aws_smithy_types::{Document};
use superposition_rust_sdk::types::Variant;

use crate::{
    file::utils::parse_file_key, releases::models::*, utils::db::{
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

pub fn get_files_by_file_keys(conn: &mut PooledConnection<ConnectionManager<PgConnection>>, organisation: &String, application: &String, file_paths: &Vec<String>) -> Result<Vec<FileEntry>, actix_web::error::Error> {
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
        .expect("Package should have files");

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

pub fn dt(x: &aws_smithy_types::DateTime) -> String {
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