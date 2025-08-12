use std::{collections::HashSet, path::Path};

use crate::{
    organisation::application::default_config, types::AppState, utils::{db::{models::WorkspaceName, schema::hyperotaserver::workspace_names::dsl::*}, keycloak::get_token}
};
use actix_web::{error, web};
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SuperpositionDefaultConfig {
    pub key: String,
    pub default: SuperpositionDefaultConfigValue,
    pub description: String,
}

/** Migration strategy for Superposition default configs.
 * PATCH: This is useful when you want to keep the existing configs intact and only add new ones.
 * PUT: This will delete any existing configs that are not present in the local file and add the new ones.
*/
#[derive(PartialEq)]
pub enum SuperpositionMigrationStrategy {
    PUT, PATCH
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

    let file_path = Path::new("./superposition-default-configs.json");
    
    let contents = std::fs::read_to_string(&file_path)?;
    
    let default_configs: Vec<SuperpositionDefaultConfig> = serde_json::from_str(&contents)?;

    let local_keys: HashSet<&String> = default_configs.iter().map(|cfg| &cfg.key).collect();

    for workspace in workspaces {
        let workspace = workspace.workspace_name;
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

        if migration_strategy == SuperpositionMigrationStrategy::PUT {
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
            }
        }
    }

    Ok(())
}