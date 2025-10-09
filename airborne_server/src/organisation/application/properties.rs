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

use std::collections::{BTreeMap, HashMap};

use crate::{
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ, WRITE},
    organisation::application::properties::types::ConfigProperty,
    release::utils::parse_kv_string,
    types as airborne_types,
    types::{ABError, AppState},
    utils::document::{
        document_to_json_value, dotted_docs_to_nested, hashmap_to_json_value,
        schema_doc_to_hashmap, value_to_document,
    },
};
use actix_web::{
    get,
    http::{self},
    put,
    web::{Data, Json, ReqData},
    Scope,
};
use aws_smithy_types::Document;
use http::{uri::PathAndQuery, Uri};
use log::info;
use serde_json::Value;
use std::str::FromStr;
use superposition_sdk::{
    types::{ExperimentStatusType, VariantType},
    Client,
};
use url::form_urlencoded;

mod transaction;
mod types;
mod utils;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(put_properties_schema_api)
        .service(get_properties_schema_api)
        .service(list_properties_api)
}

#[put("/schema")]
async fn put_properties_schema_api(
    req: Json<types::PutPropertiesSchemaRequest>,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> airborne_types::Result<Json<types::PutPropertiesSchemaResponse>> {
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

    let properties = req.properties.clone();
    let properties = properties
        .iter()
        .map(|(k, v)| (format!("config.properties.{}", k), v.to_owned()))
        .collect::<BTreeMap<String, types::SchemaNode>>();

    info!("Properties to be updated: {:?}", properties);

    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    info!(
        "Using org and workspace: {} / {}",
        superposition_org_id_from_env, workspace_name
    );

    let mut tasks = Vec::with_capacity(properties.len());
    let mut task_metadata: Vec<types::PutPropertiesSchemaTaskMetadata> =
        Vec::with_capacity(properties.len());

    let all_configs = state
        .superposition_client
        .list_default_configs()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .all(true)
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to get current config properties: {}", e))
        })?;

    let existing_config_properties = all_configs
        .data()
        .iter()
        .filter_map(|config| {
            if config.key.starts_with("config.properties.") {
                Some(config.key.clone())
            } else {
                None
            }
        })
        .collect::<Vec<String>>();

    let existing_config_schemas = all_configs
        .data()
        .iter()
        .filter_map(|config| {
            if config.key.starts_with("config.properties.") {
                let schema = hashmap_to_json_value(config.schema());
                let schema_node = types::SchemaNode {
                    description: config.description().to_string(),
                    default_value: document_to_json_value(config.value()),
                    schema,
                };
                Some((config.key.clone(), schema_node))
            } else {
                None
            }
        })
        .collect::<BTreeMap<String, types::SchemaNode>>();

    let to_be_deleted = utils::to_be_deleted(
        &existing_config_properties,
        &properties.keys().cloned().collect::<Vec<String>>(),
    );
    let to_be_created = utils::to_be_created(
        &existing_config_properties,
        &properties.keys().cloned().collect::<Vec<String>>(),
    );
    let to_be_updated = utils::to_be_updated(
        &existing_config_properties,
        &properties.keys().cloned().collect::<Vec<String>>(),
    );
    let all_configs: Vec<String> = to_be_created
        .iter()
        .chain(to_be_updated.iter())
        .chain(to_be_deleted.iter())
        .cloned()
        .collect();

    for key in all_configs {
        let value = properties.get(&key).cloned();
        let existing_value = existing_config_schemas.get(&key).cloned();
        let org = superposition_org_id_from_env.clone();
        let workspace = workspace_name.clone();
        let superposition_client = state.superposition_client.clone();

        let key_for_api = key.clone();
        let key_for_msg = key.clone();

        if to_be_created.contains(&key_for_api) {
            let value = value.ok_or_else(|| {
                ABError::BadRequest(format!("Property {key_for_msg} not found in request"))
            })?;

            let description = value.description.clone();
            let default_value = value.default_value.clone();
            let schema = value.schema.clone();

            task_metadata.push(types::PutPropertiesSchemaTaskMetadata {
                key: key_for_api.clone(),
                schema_new: Some(value.clone()),
                schema_old: None,
                action: types::PutPropertiesSchemaTaskAction::Create,
                org_id: org.clone(),
                workspace_id: workspace.clone(),
            });

            tasks.push(transaction::op(move || async move {
                superposition_client
                    .create_default_config()
                    .org_id(org)
                    .workspace_id(workspace)
                    .key(key_for_api)
                    .value(value_to_document(&default_value))
                    .description(description)
                    .change_reason("Create default config".to_string())
                    .set_schema(Some(schema_doc_to_hashmap(&value_to_document(&schema))))
                    .send()
                    .await
                    .map_err(|e| {
                        info!("Error in create: {:?}", e.as_service_error());
                        ABError::InternalServerError(format!("Failed to create: {}", key_for_msg))
                    })?;

                Ok::<_, ABError>(format!("Added config {key_for_msg}"))
            }));
        } else if to_be_updated.contains(&key_for_api) {
            let value = value.ok_or_else(|| {
                ABError::BadRequest(format!("Property {key_for_msg} not found in request"))
            })?;

            let existing_value = existing_value
                .ok_or_else(|| ABError::BadRequest(format!("Property {key_for_msg} not found")))?;

            let description = value.description.clone();
            let default_value = value.default_value.clone();
            let schema = value.schema.clone();

            task_metadata.push(types::PutPropertiesSchemaTaskMetadata {
                key: key_for_api.clone(),
                schema_new: Some(value.clone()),
                schema_old: Some(existing_value.clone()),
                action: types::PutPropertiesSchemaTaskAction::Update,
                org_id: org.clone(),
                workspace_id: workspace.clone(),
            });

            tasks.push(transaction::op(move || async move {
                superposition_client
                    .update_default_config()
                    .org_id(org)
                    .workspace_id(workspace)
                    .key(key_for_api)
                    .value(value_to_document(&default_value))
                    .description(description)
                    .change_reason("Update default config".to_string())
                    .set_schema(Some(schema_doc_to_hashmap(&value_to_document(&schema))))
                    .send()
                    .await
                    .map_err(|e| {
                        info!("Error in update: {:?}", e.as_service_error());
                        ABError::InternalServerError(format!(
                            "Could not modify {} as it is being used in releases",
                            key_for_msg
                        ))
                    })?;

                Ok::<_, ABError>(format!("Updated config {key_for_msg}"))
            }));
        } else if to_be_deleted.contains(&key_for_api) {
            let existing_value = existing_value
                .ok_or_else(|| ABError::BadRequest(format!("Property {key_for_msg} not found")))?;

            task_metadata.push(types::PutPropertiesSchemaTaskMetadata {
                key: key_for_api.clone(),
                schema_new: None,
                schema_old: Some(existing_value.clone()),
                action: types::PutPropertiesSchemaTaskAction::Delete,
                org_id: org.clone(),
                workspace_id: workspace.clone(),
            });

            tasks.push(transaction::op(move || async move {
                superposition_client
                    .delete_default_config()
                    .org_id(org)
                    .workspace_id(workspace)
                    .key(key_for_api)
                    .send()
                    .await
                    .map_err(|e| {
                        info!("Error in delete: {:?}", e.as_service_error());
                        ABError::InternalServerError(format!(
                            "Could not modify {} as it is being used in releases",
                            key_for_msg
                        ))
                    })?;

                Ok::<_, ABError>(format!("Deleted config {key_for_msg}"))
            }));
        }
    }

    let metadata_for_rollback = task_metadata.clone();
    match transaction::run_fail_end(tasks, move |success_indices| async move {
        rollback_config_update(
            success_indices,
            metadata_for_rollback,
            &state.superposition_client,
        )
        .await;
    })
    .await
    {
        Ok(values) => info!("All good: {:?}", values),
        Err(e) => match e {
            transaction::TxnError::Operation { source, .. } => return Err(source),
            transaction::TxnError::Join { source, .. } => {
                return Err(ABError::InternalServerError(format!(
                    "Task join error: {}",
                    source
                )));
            }
        },
    }

    Ok(Json(types::PutPropertiesSchemaResponse {
        properties: req.properties.clone(),
    }))
}

async fn rollback_config_update(
    success_indices: Vec<usize>,
    metadata: Vec<types::PutPropertiesSchemaTaskMetadata>,
    superposition_client: &Client,
) {
    info!("Rolling back operations at indices: {:?}", success_indices);

    for &index in &success_indices {
        if let Some(task_meta) = metadata.get(index) {
            let result: airborne_types::Result<String> = match &task_meta.action {
                types::PutPropertiesSchemaTaskAction::Create => {
                    // Rollback Create: Delete the created config
                    info!("Rolling back CREATE for key: {}", task_meta.key);
                    superposition_client
                        .delete_default_config()
                        .org_id(task_meta.org_id.clone())
                        .workspace_id(task_meta.workspace_id.clone())
                        .key(task_meta.key.clone())
                        .send()
                        .await
                        .map(|_| {
                            format!(
                                "Rolled back create for key: {} with schema: {:#?}",
                                task_meta.key, task_meta.schema_new
                            )
                        })
                        .map_err(|e| {
                            ABError::InternalServerError(format!(
                                "Failed to rollback create for {}: {}",
                                task_meta.key, e
                            ))
                        })
                }
                types::PutPropertiesSchemaTaskAction::Update => {
                    // Rollback Update: Restore the old value
                    if let Some(old_schema) = &task_meta.schema_old {
                        info!("Rolling back UPDATE for key: {}", task_meta.key);
                        superposition_client
                            .update_default_config()
                            .org_id(task_meta.org_id.clone())
                            .workspace_id(task_meta.workspace_id.clone())
                            .key(task_meta.key.clone())
                            .value(value_to_document(&old_schema.default_value))
                            .description(old_schema.description.clone())
                            .change_reason("Rollback update".to_string())
                            .set_schema(Some(schema_doc_to_hashmap(&value_to_document(
                                &old_schema.schema,
                            ))))
                            .send()
                            .await
                            .map(|_| format!("Rolled back update for {}", task_meta.key))
                            .map_err(|e| {
                                ABError::InternalServerError(format!(
                                    "Failed to rollback update for {}: {}",
                                    task_meta.key, e
                                ))
                            })
                    } else {
                        Err(ABError::InternalServerError(format!(
                            "No old schema available for rollback of {}",
                            task_meta.key
                        )))
                    }
                }
                types::PutPropertiesSchemaTaskAction::Delete => {
                    // Rollback Delete: Recreate the deleted config
                    if let Some(old_schema) = &task_meta.schema_old {
                        info!("Rolling back DELETE for key: {}", task_meta.key);
                        superposition_client
                            .create_default_config()
                            .org_id(task_meta.org_id.clone())
                            .workspace_id(task_meta.workspace_id.clone())
                            .key(task_meta.key.clone())
                            .value(value_to_document(&old_schema.default_value))
                            .description(old_schema.description.clone())
                            .change_reason("Rollback delete".to_string())
                            .set_schema(Some(schema_doc_to_hashmap(&value_to_document(
                                &old_schema.schema,
                            ))))
                            .send()
                            .await
                            .map(|_| format!("Rolled back delete for {}", task_meta.key))
                            .map_err(|e| {
                                ABError::InternalServerError(format!(
                                    "Failed to rollback delete for {}: {}",
                                    task_meta.key, e
                                ))
                            })
                    } else {
                        Err(ABError::InternalServerError(format!(
                            "No old schema available for rollback of {}",
                            task_meta.key
                        )))
                    }
                }
            };

            match result {
                Ok(msg) => info!(
                    "Successfully rolled back operation for key: {} - {}",
                    task_meta.key, msg
                ),
                Err(e) => info!(
                    "Failed to roll back operation for key: {} - {}",
                    task_meta.key, e
                ),
            }
        } else {
            return info!("No metadata found for task index: {}", index);
        }
    }
}

#[get("/schema")]
async fn get_properties_schema_api(
    req: actix_web::HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> airborne_types::Result<Json<types::GetPropertiesSchemaResponse>> {
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

    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(parse_kv_string)
        .unwrap_or_default();

    info!("context: {:?}", context);

    info!(
        "Using org and workspace: {} / {}",
        superposition_org_id_from_env, workspace_name
    );

    let toss = 1;

    let applicable_variants = context.iter().fold(
        state
            .superposition_client
            .applicable_variants()
            .workspace_id(workspace_name.clone())
            .org_id(superposition_org_id_from_env.clone())
            .identifier(toss.to_string()),
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

    info!("applicable_variants: {:?}", applicable_variants);

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

    let opt_rc_config_properties = resolved_config.config.as_ref().and_then(|doc| {
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

    let rc_config_properties = opt_rc_config_properties.unwrap_or_default();

    info!("config from superposition: {:?}", resolved_config);

    let all_configs = state
        .superposition_client
        .list_default_configs()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .all(true)
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to get current config properties: {}", e))
        })?;

    let existing_config_schemas = all_configs
        .data()
        .iter()
        .filter_map(|config| {
            if config.key.starts_with("config.properties.") {
                let key = config
                    .key
                    .strip_prefix("config.properties.")
                    .unwrap_or(&config.key);
                let schema = hashmap_to_json_value(config.schema());
                let default_value = rc_config_properties
                    .get(key)
                    .cloned()
                    .unwrap_or(config.value.clone());
                let schema_node = types::SchemaNode {
                    description: config.description().to_string(),
                    default_value: document_to_json_value(&default_value),
                    schema,
                };
                Some((key.to_string(), schema_node))
            } else {
                None
            }
        })
        .collect::<BTreeMap<String, types::SchemaNode>>();

    Ok(Json(types::GetPropertiesSchemaResponse {
        properties: existing_config_schemas,
    }))
}

#[get("/list")]
async fn list_properties_api(
    auth_response: ReqData<AuthResponse>,
    req: actix_web::HttpRequest,
    state: Data<AppState>,
) -> airborne_types::Result<Json<types::ListPropertiesResponse>> {
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

    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(parse_kv_string)
        .unwrap_or_default();

    info!(
        "Using org and workspace: {} / {}",
        superposition_org_id_from_env, workspace_name
    );

    let default_configs = state
        .superposition_client
        .list_default_configs()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .all(true)
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to get current config properties: {}", e))
        })?;

    let default_config_version = default_configs
        .data()
        .iter()
        .find(|config| config.key == "config.version")
        .map(|config| config.value().as_string().unwrap_or_default().to_string())
        .unwrap_or_default();

    let experiments_list = state
        .superposition_client
        .list_experiment()
        .org_id(superposition_org_id_from_env)
        .workspace_id(workspace_name)
        .customize()
        .mutate_request(move |req| {
            if context.is_empty() {
                return;
            }
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
            ABError::InternalServerError(format!("Failed to get experiments list: {}", e))
        })?;

    let mut config_properties: Vec<ConfigProperty> = vec![];

    for exp in experiments_list.data() {
        let variant = if *exp.status() == ExperimentStatusType::Concluded {
            if exp.chosen_variant().is_none() {
                None
            } else {
                exp.variants()
                    .iter()
                    .filter(|&variant| variant.id == exp.chosen_variant().unwrap())
                    .next_back()
            }
        } else {
            exp.variants()
                .iter()
                .filter(|&variant| *variant.variant_type() == VariantType::Experimental)
                .next_back()
        };

        if variant.is_none() {
            continue;
        }

        let variant_overrides = variant.unwrap().overrides.as_object();
        if variant_overrides.is_none() {
            continue;
        }

        let variant_overrides = variant_overrides
            .unwrap()
            .iter()
            .filter_map(|(k, v)| {
                if k.starts_with("config.properties.") {
                    let key = k
                        .strip_prefix("config.properties.")
                        .unwrap_or(k)
                        .to_string();
                    info!("Found variant override for {}: {:?}", key, v);
                    Some((key, v.clone()))
                } else {
                    None
                }
            })
            .collect::<HashMap<String, Document>>();

        info!("Variant overrides {:?}", variant_overrides);

        let mut exp = ConfigProperty {
            dimensions: exp
                .context()
                .iter()
                .map(|(k, v)| (k.clone(), document_to_json_value(v)))
                .collect::<BTreeMap<String, Value>>(),
            experiment_id: exp.id().to_string(),
            status: exp.status().to_string(),
            properties: dotted_docs_to_nested(variant_overrides.clone()).map_err(|e| {
                info!("Error in app properties: {:?}", e);
                ABError::InternalServerError("Error in app properties".to_string())
            })?,
        };

        if variant_overrides.contains_key("config.version") {
            let config_version = variant_overrides
                .get("config.version")
                .and_then(|v| v.as_string())
                .unwrap_or_default()
                .to_string();
            if config_version == default_config_version {
                exp.status = "DEFAULT".to_string();
            }
        }

        config_properties.push(exp);
    }

    Ok(Json(types::ListPropertiesResponse {
        properties: config_properties,
    }))
}
