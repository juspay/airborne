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
    organisation::application::default_config,
    run_blocking,
    types::{ABError, AppState},
    utils::{
        advisory_lock::{try_acquire_lock, LockNamespace},
        db::{models::WorkspaceName, schema::hyperotaserver::workspace_names::dsl::*},
        document::value_to_document,
    },
};
use actix_web::web;
use aws_smithy_types::Document;
use diesel::{QueryDsl, RunQueryDsl, SelectableHelper};
use log::{debug, info};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use superposition_sdk::types::DefaultConfigResponse;

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
#[derive(PartialEq, Debug)]
pub enum SuperpositionMigrationStrategy {
    Put,
    Patch,
}

impl From<String> for SuperpositionMigrationStrategy {
    fn from(s: String) -> Self {
        match s.as_str() {
            "PUT" => SuperpositionMigrationStrategy::Put,
            _ => SuperpositionMigrationStrategy::Patch,
        }
    }
}

pub async fn migrate_superposition(
    state: &web::Data<AppState>,
    migration_strategy: SuperpositionMigrationStrategy,
) -> Result<(), ABError> {
    let db_pool = state.db_pool.clone();
    let workspaces = run_blocking!({
        let mut conn = db_pool.get()?;

        Ok(workspace_names
            .select(WorkspaceName::as_select())
            .get_results::<WorkspaceName>(&mut conn)?)
    })?;

    for workspace in workspaces {
        // Try to acquire a lock for this specific workspace
        let lock_guard = match try_acquire_lock(
            &state.db_pool,
            LockNamespace::SuperpositionMigration,
            &workspace.workspace_name,
        )
        .await?
        {
            Some(guard) => guard,
            None => {
                info!(
                    "Skipping workspace {} - another pod is already migrating it",
                    workspace.workspace_name
                );
                continue;
            }
        };

        let result = migrate_superposition_workspace(&workspace, state, &migration_strategy).await;

        // Release the lock explicitly to keep it async (also happens on drop)
        if let Err(e) = lock_guard.release().await {
            log::error!(
                "Failed to release lock for workspace {}: {}",
                workspace.workspace_name,
                e
            );
        }

        match result {
            Err(e) => {
                log::warn!(
                    "Failed to migrate workspace {}: {}",
                    workspace.workspace_name,
                    e
                );
            }
            Ok(_) => {
                info!(
                    "Successfully migrated workspace {}",
                    workspace.workspace_name
                );
            }
        }
    }

    Ok(())
}

pub async fn get_default_configs_from_file() -> Result<Vec<SuperpositionDefaultConfig>, ABError> {
    let file_path = Path::new("./superposition-default-configs.json");

    let contents = std::fs::read_to_string(file_path)
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let default_configs: Vec<SuperpositionDefaultConfig> =
        serde_json::from_str(&contents).map_err(|e| ABError::InternalServerError(e.to_string()))?;

    Ok(default_configs)
}

pub async fn migrate_superposition_workspace(
    workspace: &WorkspaceName,
    state: &web::Data<AppState>,
    migration_strategy: &SuperpositionMigrationStrategy,
) -> Result<(), ABError> {
    info!(
        "Migrating Superposition workspace: {}",
        workspace.workspace_name
    );
    let default_configs: Vec<SuperpositionDefaultConfig> = state.env.default_configs.clone();
    let local_keys: HashSet<&String> = default_configs.iter().map(|cfg| &cfg.key).collect();

    let workspace = workspace.workspace_name.clone();
    let superposition_org = state.env.superposition_org_id.clone();

    let all_configs = state
        .superposition_client
        .list_default_configs()
        .org_id(superposition_org.clone())
        .workspace_id(workspace.clone())
        .all(true)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let server_configs: Vec<DefaultConfigResponse> = all_configs.data.clone();

    let configs_to_be_removed: Vec<DefaultConfigResponse> = server_configs
        .clone()
        .into_iter()
        .filter(|srv| !local_keys.contains(&srv.key) && !srv.key.starts_with("config.properties."))
        .collect();

    let server_keys: HashSet<String> = server_configs
        .clone()
        .iter()
        .map(|srv| srv.key.clone())
        .collect();

    let configs_to_be_added: Vec<SuperpositionDefaultConfig> = default_configs
        .clone()
        .into_iter()
        .filter(|loc| !server_keys.contains(&loc.key))
        .collect();

    debug!(
        "Workspace: {}, Configs to be removed: {:?}, Configs to be added: {:?} and strategy: {:?}",
        workspace, configs_to_be_removed, configs_to_be_added, migration_strategy
    );

    let mut total_additions = 0;
    let mut total_removals = 0;

    if *migration_strategy == SuperpositionMigrationStrategy::Put {
        for config in configs_to_be_removed {
            state
                .superposition_client
                .delete_default_config()
                .org_id(superposition_org.clone())
                .workspace_id(workspace.clone())
                .key(config.key)
                .send()
                .await
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;
            total_removals += 1;
        }
    }

    for config in configs_to_be_added {
        match config.default {
            SuperpositionDefaultConfigValue::Str(ref value) => {
                default_config::<String>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, value.clone(), config.description)
                .await
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;
            }
            SuperpositionDefaultConfigValue::Int(ref value) => {
                default_config::<i32>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, *value, config.description)
                .await
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;
            }
            SuperpositionDefaultConfigValue::Bool(ref value) => {
                default_config::<bool>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, *value, config.description)
                .await
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;
            }
            SuperpositionDefaultConfigValue::Vec(ref value) => {
                let default_val: Vec<Document> = value.iter().map(value_to_document).collect();
                default_config::<Vec<Document>>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, default_val, config.description)
                .await
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;
            }
            SuperpositionDefaultConfigValue::Val(ref value) => {
                let default_val: Document = value_to_document(value);
                default_config::<Document>(
                    state.superposition_client.clone(),
                    workspace.clone(),
                    superposition_org.clone(),
                )(config.key, default_val, config.description)
                .await
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;
            }
        };
        total_additions += 1;
    }
    info!(
        "Completed migration for workspace: {}. Total additions: {}, Total removals: {}",
        workspace, total_additions, total_removals
    );
    Ok(())
}
