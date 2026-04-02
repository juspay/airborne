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
use airborne_authz_macros::authz;

use actix_web::{post, web};
use aws_smithy_types::Document;
use diesel::RunQueryDsl;
use log::info;
use serde::{Deserialize, Serialize};
use superposition_sdk::operation::create_default_config::CreateDefaultConfigOutput;
use superposition_sdk::types::WorkspaceStatus;
use superposition_sdk::Client;

use crate::{
    middleware::auth::{require_scope_name, AuthResponse},
    types::{self as airborne_types, ABError, AppState},
    utils::{
        db::{
            models::{NewWorkspaceName, WorkspaceName},
            schema::hyperotaserver::workspace_names,
        },
        document::schema_doc_to_hashmap,
        migrations::{migrate_superposition_workspace, SuperpositionMigrationStrategy},
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

#[authz(
    resource = "application",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = [],
    allow_org = true,
    allow_app = false,
    webhook_allowed = false
)]
#[post("/create")]
async fn add_application(
    body: Json<ApplicationCreateRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Application>> {
    // Get organisation and application names
    let body = body.into_inner();
    let application = body.application;

    let auth_response = auth_response.into_inner();
    let sub = &auth_response.sub;
    let organisation = require_scope_name(auth_response.organisation, "organisation")?;
    info!(
        "Validated org context '{}' while creating app '{}'",
        organisation, application
    );

    state
        .authz_provider
        .create_application(state.get_ref(), &organisation, &application, sub)
        .await?;

    let mut conn = state.db_pool.get()?;
    let new_workspace_name = NewWorkspaceName {
        organization_id: &organisation,
        application_id: &application,
        workspace_name: "pending",
    };

    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    let mut inserted_workspace: WorkspaceName = diesel::insert_into(workspace_names::table)
        .values(&new_workspace_name)
        .get_result(&mut conn)
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to store workspace name: {}", e))
        })?;

    let generated_id = inserted_workspace.id;
    let generated_workspace_name = format!("workspace{}", generated_id);
    inserted_workspace.workspace_name = generated_workspace_name.clone();

    diesel::update(workspace_names::table.filter(workspace_names::id.eq(generated_id)))
        .set(workspace_names::workspace_name.eq(&generated_workspace_name))
        .execute(&mut conn)
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to update workspace name: {}", e))
        })?;

    state
        .superposition_client
        .create_workspace()
        .org_id(superposition_org_id_from_env.clone())
        .workspace_name(generated_workspace_name.clone())
        .workspace_status(WorkspaceStatus::Enabled)
        .allow_experiment_self_approval(true)
        .workspace_admin_email("pp-sdk@juspay.in".to_string())
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!(
                "Failed to create workspace in Superposition: {}",
                e
            ))
        })?;

    migrate_superposition_workspace(
        &inserted_workspace,
        &state,
        &SuperpositionMigrationStrategy::Patch,
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace migration error: {}", e)))?;

    Ok(Json(Application {
        application,
        organisation,
        access: vec!["read".to_string(), "write".to_string(), "admin".to_string()],
    }))
}
