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

use actix_web::{
    put, web::{Data, Json, ReqData}, Scope
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{middleware::auth::{validate_user, AuthResponse, WRITE}, types::{ABError, AppState}, utils::{document::{document_to_json_value, value_to_document}, workspace::get_workspace_name_for_application}};

mod utils;
mod transaction;

#[derive(Serialize, Deserialize, Clone)]
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

struct PutPropertiesSchemaTask<T> {
    key: String,
    schema_new: Option<SchemaNode>,
    schema_old: Option<SchemaNode>,
    action: PutPropertiesSchemaTaskAction,
    task: T,
}

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

    let mut tasks: Vec<PutPropertiesSchemaTask<_>> = Vec::with_capacity(properties.len());

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
            tasks.push(PutPropertiesSchemaTask {
                key: key_for_api.clone(),
                schema_new: Some(value),
                schema_old: None,
                action: PutPropertiesSchemaTaskAction::Create,
                task: transaction::op(move || async move {
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
                }),
            });
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
            tasks.push(PutPropertiesSchemaTask {
                key: key_for_api.clone(),
                schema_new: Some(value),
                schema_old: Some(existing_value),
                action: PutPropertiesSchemaTaskAction::Update,
                task: transaction::op(move || async move {
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
                }),
            });
        } else if to_be_deleted.contains(&key_for_api) {
            let existing_value = if existing_value.is_none() {
                return Err(ABError::BadRequest(format!("Property {key_for_msg} not found")).into());
            }else{
                existing_value.unwrap()
            };

            tasks.push(PutPropertiesSchemaTask {
                key: key_for_api.clone(),
                schema_new: None,
                schema_old: Some(existing_value),
                action: PutPropertiesSchemaTaskAction::Delete,
                task: transaction::op(move || async move {
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
                }),
            });
        }
    }

    match transaction::run_fail_fast(tasks.into_iter().map(|task| task.task).collect(), rollback_config_update).await {
        Ok(values) => println!("All good: {:?}", values),
        Err(e) => eprintln!("Transaction failed: {e}"),
    }

    Ok(Json(PutPropertiesSchemaResponse {
        properties: req.properties.clone(),
    }))
}

async fn rollback_config_update(success_indices: Vec<usize>) {
    println!("Rolling back operations at indices: {:?}", success_indices);
    
}