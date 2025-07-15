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

use std::{collections::HashSet, path::Path};

use crate::{
    organisation::application::default_config, types::AppState, utils::{db::{models::WorkspaceName, schema::hyperotaserver::workspace_names::dsl::*}, document::value_to_document, keycloak::get_token}
};
use actix_web::{error, web};
use aws_smithy_types::Document;
use diesel::RunQueryDsl;
use keycloak::{self, KeycloakAdmin};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use superposition_rust_sdk::types::DefaultConfigFull;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum SuperpositionDefaultConfigValue {
    Str(String),
    Int(i32),
    Vec(Vec<Value>),
    Bool(bool),
    Val(Value),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SuperpositionDefaultConfig {
    pub key: String,
    pub default: SuperpositionDefaultConfigValue,
    pub description: String,
}

/** Migration strategy for Superposition default configs. (Default: PATCH)
 * PATCH: This is useful when you want to keep the existing configs intact and only add new ones.
 * PUT: This will delete any existing configs that are not present in the local file and add the new ones.
*/
#[derive(PartialEq)]
pub enum SuperpositionMigrationStrategy {
    PUT, PATCH
}

impl From<String> for SuperpositionMigrationStrategy {
    fn from(s: String) -> Self {
        match s.as_str() {
            "PUT" => SuperpositionMigrationStrategy::PUT,
            _ => SuperpositionMigrationStrategy::PATCH,
        }
    }
}

pub async fn migrate_keycloak(
    state: web::Data<AppState>,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client.clone()).await?;
    let admin = KeycloakAdmin::new(&state.env.keycloak_url, admin_token, client.clone());

    let file_path = Path::new("./realm-export.json");
    
    let contents = std::fs::read_to_string(&file_path)?;

    let mut data: Value = serde_json::from_str(&contents)?;
    
    if let Value::Object(ref mut map) = data {
        map.insert("ifResourceExists".to_string(), Value::String("SKIP".to_string()));
    } else {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Expected JSON object at the top level of keycloak migration file",
        )));
    }

    admin
        .realm_partial_import_post(&state.env.realm, data)
        .await
        .map_err(|e| error::ErrorInternalServerError(format!("Keycloak import failed: {}", e)))?;

    Ok(())
}

pub async fn migrate_superposition(
    state: web::Data<AppState>,
    migration_strategy: SuperpositionMigrationStrategy,
) -> Result<(), Box<dyn std::error::Error>> {

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let workspaces: Vec<WorkspaceName> = workspace_names
        .load(&mut conn)
        .map_err(|_| error::ErrorNotFound("Workspaces not found"))?;

    for workspace in workspaces {
        let _ = migrate_superposition_workspace(&workspace, &state, &migration_strategy).await?;
    }

    Ok(())
}

pub async fn migrate_superposition_workspace(
    workspace: &WorkspaceName,
    state: &web::Data<AppState>,
    migration_strategy: &SuperpositionMigrationStrategy
) -> Result<(), Box<dyn std::error::Error>> {
    let file_path = Path::new("./superposition-default-configs.json");
    
    let contents = std::fs::read_to_string(&file_path)?;
    
    let default_configs: Vec<SuperpositionDefaultConfig> = serde_json::from_str(&contents)?;
    let local_keys: HashSet<&String> = default_configs.iter().map(|cfg| &cfg.key).collect();

    let workspace = workspace.workspace_name.clone();
    let superposition_org = state.env.superposition_org_id.clone();

    let all_configs = state.superposition_client
        .list_default_configs()
        .org_id(superposition_org.clone())
        .workspace_id(workspace.clone())
        .all(true)
        .send()
        .await?;

    let server_configs: Vec<DefaultConfigFull> = all_configs
        .data
        .clone() 
        .unwrap_or_default();

    let configs_to_be_removed: Vec<DefaultConfigFull> = server_configs.clone()
        .into_iter()
        .filter(|srv| !local_keys.contains(&srv.key))
        .collect();

    let server_keys: HashSet<String> = server_configs.clone()
        .iter()
        .map(|srv| srv.key.clone())
        .collect();

    let configs_to_be_added: Vec<SuperpositionDefaultConfig> = default_configs.clone()
        .into_iter()
        .filter(|loc| !server_keys.contains(&loc.key))
        .collect();

    if *migration_strategy == SuperpositionMigrationStrategy::PUT {
        for config in configs_to_be_removed {
            state.superposition_client
                .delete_default_config()
                .org_id(superposition_org.clone())
                .workspace_id(workspace.clone())
                .key(config.key)
                .send()
                .await?;
        }
    }

    for config in configs_to_be_added {
        match config.default {
            SuperpositionDefaultConfigValue::Str(ref value) => {
                default_config::<String>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, value.clone(), config.description).await?;
            }
            SuperpositionDefaultConfigValue::Int(ref value) => {
                default_config::<i32>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, *value, config.description).await?;
            }
            SuperpositionDefaultConfigValue::Bool(ref value) => {
                default_config::<bool>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, *value, config.description).await?;
            }
            SuperpositionDefaultConfigValue::Vec(ref value) => {
                let default_val: Vec<Document> = value.iter().map(value_to_document).collect();
                default_config::<Vec<Document>>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, default_val, config.description).await?;
            }
            SuperpositionDefaultConfigValue::Val(ref value) => {
                let default_val: Document = value_to_document(&value);
                default_config::<Document>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, default_val, config.description).await?;
            }
        }
    }
    Ok(())
}