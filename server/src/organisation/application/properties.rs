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

use crate::{middleware::auth::{validate_user, AuthResponse, WRITE}, types::{ABError, AppState}, utils::{document::value_to_document, workspace::get_workspace_name_for_application}};

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

    let all_configs = state.superposition_client
        .list_default_configs()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_id(workspace_name.clone())
        .all(true)
        .send()
        .await.map_err(|e| ABError::InternalServerError(format!("Failed to get current config properties: {}", e)))?;

    let existing_config_properties = all_configs.data().iter().map(|config| config.key.clone()).collect::<Vec<String>>();

    for (key, value) in properties {
        let org = superposition_org_id_from_env.clone();
        let workspace = workspace_name.clone();
        let superposition_client = state.superposition_client.clone();

        let key_for_api = key.clone();
        let key_for_msg = key;

        let description = value.description.clone();
        let default_value = value.default_value.clone();
        let schema = value.schema.clone();

        tasks.push(transaction::op(|| async move {
            superposition_client
                .create_default_config()
                .org_id(org)
                .workspace_id(workspace)
                .key(key_for_api)
                .value(value_to_document(&default_value))
                .description(description)
                .change_reason("Initial value".to_string())
                .schema(value_to_document(&schema))
                .send()
                .await
                .map_err(|e| ABError::InternalServerError(
                    format!("Failed to update property schema: {e}")
                ))?;

            Ok::<_, ABError>(format!("Added config {key_for_msg}"))
        }));
    }

    match transaction::run_fail_fast(tasks, rollback_config_update).await {
        Ok(values) => println!("All good: {:?}", values),
        Err(e) => eprintln!("Transaction failed: {e}"),
    }

    Ok(Json(PutPropertiesSchemaResponse {
        properties: req.properties.clone(),
    }))
}

async fn rollback_config_update(success_indices: Vec<usize>) {
    println!("Rolling back operations at indices: {:?}", success_indices);
    // Implement rollback logic here if necessary
}