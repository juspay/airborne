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

use std::{collections::BTreeMap};

use actix_web::{
    put, web::{Data, Json, ReqData}, Scope
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use superposition_sdk::Client;

use crate::{middleware::auth::{validate_user, AuthResponse, WRITE}, types::{ABError, AppState}, utils::{document::{document_to_json_value, value_to_document}, workspace::get_workspace_name_for_application}};

mod utils;
mod transaction;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct SchemaNode {
    description: String,
    default_value: Value,
    schema: Value,
}

#[derive(Deserialize)]
struct PutPropertiesSchemaRequest {
    properties: BTreeMap<String, SchemaNode>,
}

#[derive(Serialize)]
struct PutPropertiesSchemaResponse {
    properties: BTreeMap<String, SchemaNode>,
}

#[derive(Clone, Debug)]
struct PutPropertiesSchemaTaskMetadata {
    key: String,
    schema_new: Option<SchemaNode>,
    schema_old: Option<SchemaNode>,
    action: PutPropertiesSchemaTaskAction,
    org_id: String,
    workspace_id: String,
}

#[derive(Clone, Debug)]
enum PutPropertiesSchemaTaskAction {
    Create,
    Update,
    Delete,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(put_properties_schema_api)
}

#[put("/schema")]
async fn put_properties_schema_api(
    req: Json<PutPropertiesSchemaRequest>,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> actix_web::Result<Json<PutPropertiesSchemaResponse>> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    let properties = req.properties.clone();

    let mut conn = state.db_pool.get().map_err(|_| {
        ABError::InternalServerError("Failed to get database connection".to_string())
    })?;

    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to get workspace name: {}", e))
        })?;
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    let mut tasks = Vec::with_capacity(properties.len());
    let mut task_metadata: Vec<PutPropertiesSchemaTaskMetadata> = Vec::with_capacity(properties.len());

    let all_configs = state.superposition_client
        .list_default_configs()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .all(true)
        .send()
        .await.map_err(|e| ABError::InternalServerError(format!("Failed to get current config properties: {}", e)))?;

    let existing_config_properties = all_configs.data().iter().filter_map(|config| {
        if config.key.starts_with("config.properties.") {
            Some(config.key.clone())
        } else {
            None
        }
    }).collect::<Vec<String>>();

    let existing_config_schemas = all_configs.data().iter().filter_map(|config| {
        if config.key.starts_with("config.properties.") {
            let schema = document_to_json_value(&config.schema());
            let schema_node = SchemaNode {
                description: config.description().to_string(),
                default_value: document_to_json_value(&config.value()),
                schema,
            };
            Some((config.key.clone(), schema_node))
        } else {
            None
        }
    }).collect::<BTreeMap<String, SchemaNode>>();

    let mut removed_config_properties_object = false;

    if existing_config_properties.is_empty() {
        println!("No existing config properties found.");
        let config_properties_object = all_configs.data().iter().find(|config| config.key == "config.properties").map(|config| document_to_json_value(&config.value()));
        if !config_properties_object.is_none() {
            println!("Setting config.properties for the first time, found config.properties: {:?}", config_properties_object);
            state.superposition_client
                .delete_default_config()
                .org_id(superposition_org_id_from_env.clone())
                .workspace_id(workspace_name.clone())
                .key("config.properties".to_string())
                .send()
                .await.map_err(|e| ABError::InternalServerError(format!("Failed to delete default config.properties object: {}", e)))?;
            removed_config_properties_object = true;
        }
    }

    let to_be_deleted = utils::to_be_deleted(&existing_config_properties, &properties.keys().cloned().collect::<Vec<String>>());
    let to_be_created = utils::to_be_created(&existing_config_properties, &properties.keys().cloned().collect::<Vec<String>>());
    let to_be_updated = utils::to_be_updated(&existing_config_properties, &properties.keys().cloned().collect::<Vec<String>>());
    let all_configs: Vec<String> = to_be_created.iter()
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
            let value = if value.is_none() {
                return Err(ABError::BadRequest(format!("Property {key_for_msg} not found in request")).into());
            }else{
                value.unwrap()
            };

            let description = value.description.clone();
            let default_value = value.default_value.clone();
            let schema = value.schema.clone();
            
            task_metadata.push(PutPropertiesSchemaTaskMetadata {
                key: key_for_api.clone(),
                schema_new: Some(value.clone()),
                schema_old: None,
                action: PutPropertiesSchemaTaskAction::Create,
                org_id: org.clone(),
                workspace_id: workspace.clone(),
            });
            
            tasks.push(
                transaction::op(move || async move {
                    superposition_client
                        .create_default_config()
                        .org_id(org)
                        .workspace_id(workspace)
                        .key(key_for_api)
                        .value(value_to_document(&default_value))
                        .description(description)
                        .change_reason("Create default config".to_string())
                        .schema(value_to_document(&schema))
                        .send()
                        .await
                        .map_err(|e| ABError::InternalServerError(
                            format!("Failed to update property schema: {e}")
                        ))?;

                    Ok::<_, ABError>(format!("Added config {key_for_msg}"))
                })
            );
        } else if to_be_updated.contains(&key_for_api) {
            let value = if value.is_none() {
                return Err(ABError::BadRequest(format!("Property {key_for_msg} not found in request")).into());
            }else{
                value.unwrap()
            };

            let existing_value = if existing_value.is_none() {
                return Err(ABError::BadRequest(format!("Property {key_for_msg} not found")).into());
            }else{
                existing_value.unwrap()
            };

            let description = value.description.clone();
            let default_value = value.default_value.clone();
            let schema = value.schema.clone();
            
            task_metadata.push(PutPropertiesSchemaTaskMetadata {
                key: key_for_api.clone(),
                schema_new: Some(value.clone()),
                schema_old: Some(existing_value.clone()),
                action: PutPropertiesSchemaTaskAction::Update,
                org_id: org.clone(),
                workspace_id: workspace.clone(),
            });
            
            tasks.push(
                transaction::op(move || async move {
                    superposition_client
                        .update_default_config()
                        .org_id(org)
                        .workspace_id(workspace)
                        .key(key_for_api)
                        .value(value_to_document(&default_value))
                        .description(description)
                        .change_reason("Update default config".to_string())
                        .schema(value_to_document(&schema))
                        .send()
                        .await
                        .map_err(|e| ABError::InternalServerError(
                            format!("Failed to update property schema: {e}")
                        ))?;

                    Ok::<_, ABError>(format!("Updated config {key_for_msg}"))
                })
            );
        } else if to_be_deleted.contains(&key_for_api) {
            let existing_value = if existing_value.is_none() {
                return Err(ABError::BadRequest(format!("Property {key_for_msg} not found")).into());
            }else{
                existing_value.unwrap()
            };

            task_metadata.push(PutPropertiesSchemaTaskMetadata {
                key: key_for_api.clone(),
                schema_new: None,
                schema_old: Some(existing_value.clone()),
                action: PutPropertiesSchemaTaskAction::Delete,
                org_id: org.clone(),
                workspace_id: workspace.clone(),
            });

            tasks.push(
                transaction::op(move || async move {
                    superposition_client
                        .delete_default_config()
                        .org_id(org)
                        .workspace_id(workspace)
                        .key(key_for_api)
                        .send()
                        .await
                        .map_err(|e| ABError::InternalServerError(
                            format!("Failed to update property schema: {e}")
                        ))?;

                    Ok::<_, ABError>(format!("Deleted config {key_for_msg}"))
                })
            );
        }
    }

    let metadata_for_rollback = task_metadata.clone();
    match transaction::run_fail_fast(
        tasks, 
        move |success_indices| async move {
            rollback_config_update(success_indices, metadata_for_rollback, &state.superposition_client).await;

            if removed_config_properties_object {
                println!("Restoring config.properties object as part of rollback");
                state.superposition_client
                    .create_default_config()
                    .org_id(superposition_org_id_from_env.clone())
                    .workspace_id(workspace_name.clone())
                    .key("config.properties".to_string())
                    .value(value_to_document(&Value::Object(serde_json::Map::new())))
                    .description("Restored config.properties object".to_string())
                    .change_reason("Rollback restore config.properties".to_string())
                    .schema(value_to_document(&Value::Object(serde_json::Map::new())))
                    .send()
                    .await.map_err(|e| println!("Failed to restore config.properties object during rollback: {}", e)).ok();
            }
        }
    ).await {
        Ok(values) => println!("All good: {:?}", values),
        Err(e) => {
            match e {
                transaction::TxnError::Operation { source, .. } => return Err(source.into()),
                transaction::TxnError::Join { source, .. } => {
                    return Err(ABError::InternalServerError(format!("Task join error: {}", source)).into())
                }
            }
        }
    }

    Ok(Json(PutPropertiesSchemaResponse {
        properties: req.properties.clone(),
    }))
}

async fn rollback_config_update(
    success_indices: Vec<usize>,
    metadata: Vec<PutPropertiesSchemaTaskMetadata>,
    superposition_client: &Client,
) {
    println!("Rolling back operations at indices: {:?}", success_indices);
    
    for &index in &success_indices {
        if let Some(task_meta) = metadata.get(index) {
            let result: Result<String, String> = match &task_meta.action {
                PutPropertiesSchemaTaskAction::Create => {
                    // Rollback Create: Delete the created config
                    println!("Rolling back CREATE for key: {}", task_meta.key);
                    superposition_client
                        .delete_default_config()
                        .org_id(task_meta.org_id.clone())
                        .workspace_id(task_meta.workspace_id.clone())
                        .key(task_meta.key.clone())
                        .send()
                        .await
                        .map(|_| format!("Rolled back create for key: {} with schema: {:#?}", task_meta.key, task_meta.schema_new))
                        .map_err(|e| format!("Failed to rollback create for {}: {}", task_meta.key, e))
                },
                PutPropertiesSchemaTaskAction::Update => {
                    // Rollback Update: Restore the old value
                    if let Some(old_schema) = &task_meta.schema_old {
                        println!("Rolling back UPDATE for key: {}", task_meta.key);
                        superposition_client
                            .update_default_config()
                            .org_id(task_meta.org_id.clone())
                            .workspace_id(task_meta.workspace_id.clone())
                            .key(task_meta.key.clone())
                            .value(value_to_document(&old_schema.default_value))
                            .description(old_schema.description.clone())
                            .change_reason("Rollback update".to_string())
                            .schema(value_to_document(&old_schema.schema))
                            .send()
                            .await
                            .map(|_| format!("Rolled back update for {}", task_meta.key))
                            .map_err(|e| format!("Failed to rollback update for {}: {}", task_meta.key, e))
                    } else {
                        Err(format!("No old schema available for rollback of {}", task_meta.key))
                    }
                },
                PutPropertiesSchemaTaskAction::Delete => {
                    // Rollback Delete: Recreate the deleted config
                    if let Some(old_schema) = &task_meta.schema_old {
                        println!("Rolling back DELETE for key: {}", task_meta.key);
                        superposition_client
                            .create_default_config()
                            .org_id(task_meta.org_id.clone())
                            .workspace_id(task_meta.workspace_id.clone())
                            .key(task_meta.key.clone())
                            .value(value_to_document(&old_schema.default_value))
                            .description(old_schema.description.clone())
                            .change_reason("Rollback delete".to_string())
                            .schema(value_to_document(&old_schema.schema))
                            .send()
                            .await
                            .map(|_| format!("Rolled back delete for {}", task_meta.key))
                            .map_err(|e| format!("Failed to rollback delete for {}: {}", task_meta.key, e))
                    } else {
                        Err(format!("No old schema available for rollback of {}", task_meta.key))
                    }
                }
            };
            
            match result {
                Ok(msg) => println!("Successfully rolled back operation for key: {} - {}", task_meta.key, msg),
                Err(e) => println!("Failed to roll back operation for key: {} - {}", task_meta.key, e),
            }
        } else {
            return println!("No metadata found for task index: {}", index);
        }
    }
}