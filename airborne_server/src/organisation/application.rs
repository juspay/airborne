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

use actix_web::web::{Json, ReqData};
use actix_web::Scope;

use actix_web::{post, web};
use aws_smithy_types::Document;
use diesel::RunQueryDsl;
use keycloak::types::GroupRepresentation;
use keycloak::KeycloakAdmin;
use log::info;
use serde::{Deserialize, Serialize};
use superposition_sdk::operation::create_default_config::CreateDefaultConfigOutput;
use superposition_sdk::types::WorkspaceStatus;
use superposition_sdk::Client;

use crate::{
    middleware::auth::{validate_user, AuthResponse, ADMIN},
    types::{self as airborne_types, ABError, AppState},
    utils::{
        db::{
            models::{NewWorkspaceName, WorkspaceName},
            schema::hyperotaserver::workspace_names,
        },
        document::schema_doc_to_hashmap,
        keycloak::get_token,
        migrations::{migrate_superposition_workspace, SuperpositionMigrationStrategy},
        transaction_manager::TransactionManager,
    },
};

mod config;
mod dimension;
mod properties;
pub mod types;
pub mod user;

use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(add_application)
        .service(Scope::new("/config").service(config::add_routes()))
        .service(Scope::new("/dimension").service(dimension::add_routes()))
        .service(Scope::new("/user").service(user::add_routes()))
        .service(Scope::new("/properties").service(properties::add_routes()))
}

#[derive(Serialize, Deserialize)]
pub struct Application {
    pub application: String,
    pub organisation: String,
    pub access: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct ApplicationCreateRequest {
    application: String,
}

pub fn default_config<T: Clone>(
    superposition_client: Client,
    workspace_name: String,
    superposition_org: String,
) -> impl AsyncFn(String, T, String) -> airborne_types::Result<CreateDefaultConfigOutput>
where
    Document: From<T>,
{
    async move |key: String, value: T, description: String| {
        superposition_client
            .create_default_config()
            .org_id(superposition_org.clone())
            .workspace_id(workspace_name.clone())
            .key(key.clone())
            .value(Document::from(value.clone()))
            .description(description)
            .change_reason("Initial value".to_string())
            .set_schema(Some(schema_doc_to_hashmap(&get_scheme(value.clone()))))
            .send()
            .await
            .map_err(|e| {
                info!("[DEFAULT_CONFIG] Failed to create default config: {}", e);
                ABError::InternalServerError("Failed to create default configurations".to_string())
            })
    }
}

fn get_scheme<T>(v: T) -> Document
where
    Document: From<T>,
{
    let v = Document::from(v);
    Document::Object(match v {
        // Don't use JSON macro. It is too heavy
        // Change this to Value::Object + Map
        Document::String(_) => {
            let mut map = HashMap::new();
            map.insert("pattern".to_string(), Document::String(String::from(".*")));
            map.insert("type".to_string(), Document::String(String::from("string")));
            map
        }
        Document::Number(_) => {
            let mut map = HashMap::new();
            map.insert(
                "type".to_string(),
                Document::String(String::from("integer")),
            );
            map
        }
        Document::Array(_) => {
            let mut map = HashMap::new();
            map.insert("type".to_string(), Document::String(String::from("array")));
            let mut submap = HashMap::new();
            submap.insert("type".to_string(), Document::String(String::from("string")));
            map.insert("items".to_string(), Document::Object(submap));
            map
        }
        _ => {
            let mut map = HashMap::new();
            map.insert("type".to_string(), Document::String(String::from("object")));
            map
        }
    })
}

#[post("/create")]
async fn add_application(
    body: Json<ApplicationCreateRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Application>> {
    // Get organisation and application names
    let body = body.into_inner();
    let application = body.application;

    // Check if the user token is still valid
    let auth_response = auth_response.into_inner();
    let sub = &auth_response.sub;

    let organisation = auth_response.organisation;

    info!("Validating organisation: {:?}", organisation);
    let organisation = validate_user(organisation, ADMIN).map_err(|e| {
        info!("Error validating organisation: {:?}", e);
        ABError::Forbidden(format!(
            "User does not have ADMIN access to organisation: {}",
            e
        ))
    })?;
    info!("Organisation validated successfully.");

    // Create a transaction manager to track resources
    let transaction = TransactionManager::new(&application, "application_create");

    // Get DB connection
    let mut conn = state.db_pool.get()?;

    // Get Keycloak Admin Token
    let client = reqwest::Client::new();
    let admin_token = get_token(state.env.clone(), client).await.map_err(|e| {
        info!("Error retrieving Keycloak admin token: {:?}", e);
        ABError::Unauthorized(format!("Error retrieving Keycloak admin token: {}", e))
    })?;
    info!("Admin token retrieved successfully.");
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    let groups = admin
        .realm_groups_get(
            &realm,
            None,
            Some(true), // Exact Match
            None,
            Some(2), // Check only one group; Should be 5xx if more than 1
            Some(false),
            None,
            Some(organisation.clone()),
        )
        .await
        .map_err(|e| ABError::InternalServerError(format!("{}", e)))?;

    if groups.is_empty() {
        Err(ABError::NotFound(format!(
            "Organisation '{}' not found in Keycloak",
            organisation
        )))
    }
    // It is possible that application group comes up in this query; Change to path
    // else if groups.len() != 1 {
    //     return Err(error::ErrorInternalServerError(Json(json!({"Error" : "Inconsistant database entries"}))));
    // }
    else {
        // Reject if application already exists
        if groups[0]
            .sub_groups
            .clone()
            .unwrap_or_default()
            .iter()
            .any(|g| g.name == Some(application.clone()))
        {
            return Err(ABError::BadRequest(format!(
                "Application '{}' already exists in organisation '{}'",
                application, organisation
            )));
        }

        // Step 1: Create application group in Keycloak
        let parent_group_id = match admin
            .realm_groups_with_group_id_children_post(
                &realm,
                &groups[0].id.clone().unwrap_or_default().clone(),
                GroupRepresentation {
                    name: Some(application.clone()),
                    ..Default::default()
                },
            )
            .await
        {
            Ok(id) => {
                let group_id = id.unwrap_or_default();
                // Record this resource in the transaction
                transaction.add_keycloak_group(&group_id);
                info!("Created application group with ID: {}", group_id);
                group_id
            }
            Err(e) => {
                // No rollback needed yet - this is the first operation
                return Err(ABError::InternalServerError(format!(
                    "Failed to create application group: {}",
                    e
                )));
            }
        };

        // Step 2: Create role groups and add user to them
        let roles = ["read", "write", "admin"];
        for role in roles {
            match admin
                .realm_groups_with_group_id_children_post(
                    &realm,
                    &parent_group_id,
                    GroupRepresentation {
                        name: Some(role.to_string()),
                        ..Default::default()
                    },
                )
                .await
            {
                Ok(id) => {
                    let role_group_id = id.unwrap_or_default();
                    // Record this resource in the transaction
                    transaction.add_keycloak_group(&role_group_id);
                    info!("Created role group {} with ID: {}", role, role_group_id);

                    // Add the user to the role-specific group
                    match admin
                        .realm_users_with_user_id_groups_with_group_id_put(
                            &realm,
                            sub,
                            &role_group_id,
                        )
                        .await
                    {
                        Ok(_) => {
                            // Record this user-group relationship in the transaction
                            transaction.add_keycloak_resource(
                                "user_group_membership",
                                &format!("{}:{}", sub, role_group_id),
                            );
                            info!("Added user to role group: {}", role);
                        }
                        Err(e) => {
                            // Handle rollback and return error
                            if let Err(rollback_err) = transaction
                                .handle_rollback_if_needed(&admin, &realm, &state)
                                .await
                            {
                                info!("Rollback failed: {}", rollback_err);
                            }

                            return Err(ABError::InternalServerError(format!(
                                "Failed to add user to role group {}: {}",
                                role, e
                            )));
                        }
                    }
                }
                Err(e) => {
                    // Handle rollback and return error
                    if let Err(rollback_err) = transaction
                        .handle_rollback_if_needed(&admin, &realm, &state)
                        .await
                    {
                        info!("Rollback failed: {}", rollback_err);
                    }

                    return Err(ABError::InternalServerError(format!(
                        "Failed to create role group {}: {}",
                        role, e
                    )));
                }
            }
        }

        // Store workspace name in our database with a placeholder, then update to "workspace{id}"
        let new_workspace_name = NewWorkspaceName {
            organization_id: &organisation,
            application_id: &application,
            workspace_name: "pending",
        };

        let superposition_org_id_from_env = state.env.superposition_org_id.clone();
        info!(
            "Using Superposition Org ID from environment: {}",
            superposition_org_id_from_env
        );
        // Insert and get the inserted row (to get the id)
        let mut inserted_workspace: WorkspaceName = diesel::insert_into(workspace_names::table)
            .values(&new_workspace_name)
            .get_result(&mut conn)
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to store workspace name: {}", e))
            })?;

        let generated_id = inserted_workspace.id;
        let generated_workspace_name = format!("workspace{}", generated_id);
        inserted_workspace.workspace_name = generated_workspace_name.clone();

        // Update the workspace_name to "workspace{id}"
        diesel::update(workspace_names::table.filter(workspace_names::id.eq(generated_id)))
            .set(workspace_names::workspace_name.eq(&generated_workspace_name))
            .execute(&mut conn)
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to update workspace name: {}", e))
            })?;

        // Step 4: Create workspace in Superposition

        match state
            .superposition_client
            .create_workspace()
            .org_id(superposition_org_id_from_env.clone())
            .workspace_name(generated_workspace_name.clone())
            .workspace_status(WorkspaceStatus::Enabled)
            .allow_experiment_self_approval(true)
            .workspace_admin_email("pp-sdk@juspay.in".to_string())
            .send()
            .await
        {
            Ok(workspace) => {
                // Record Superposition resource using workspace name as the ID
                transaction.set_superposition_resource(&workspace.workspace_name);
                info!("Created workspace in Superposition: {:?}", workspace);
                workspace
            }
            Err(e) => {
                // Handle rollback and return error
                if let Err(rollback_err) = transaction
                    .handle_rollback_if_needed(&admin, &realm, &state)
                    .await
                {
                    info!("Rollback failed: {}", rollback_err);
                }

                return Err(ABError::InternalServerError(format!(
                    "Failed to create workspace in Superposition: {}",
                    e
                )));
            }
        };

        // Helper function to create default config with error handling
        async fn create_config_with_tx<E>(
            create_fn: impl futures::Future<Output = Result<(), E>>,
            key: &str,
            transaction: &TransactionManager,
            admin: &KeycloakAdmin,
            realm: &str,
            state: &web::Data<AppState>,
        ) -> Result<(), ABError>
        where
            E: std::fmt::Display,
        {
            match create_fn.await {
                Ok(result) => {
                    info!("Created configuration for key: {}", key);
                    Ok(result)
                }
                Err(e) => {
                    // Handle rollback
                    if let Err(rollback_err) = transaction
                        .handle_rollback_if_needed(admin, realm, state)
                        .await
                    {
                        info!("Rollback failed: {}", rollback_err);
                    }

                    Err(ABError::InternalServerError(format!(
                        "Failed to create configuration for {}: {}",
                        key, e
                    )))
                }
            }
        }

        create_config_with_tx(
            async {
                migrate_superposition_workspace(
                    &inserted_workspace,
                    &state,
                    &SuperpositionMigrationStrategy::Patch,
                )
                .await
                .map_err(|e| {
                    ABError::InternalServerError(format!("Workspace migration error: {}", e))
                })
            },
            "migrate_superposition_workspace",
            &transaction,
            &admin,
            &realm,
            &state,
        )
        .await?;

        // Mark transaction as complete since all operations have succeeded
        transaction.set_database_inserted();

        Ok(Json(Application {
            application,
            organisation,
            access: roles.iter().map(|&s| s.to_string()).collect(),
        }))
    }
}
