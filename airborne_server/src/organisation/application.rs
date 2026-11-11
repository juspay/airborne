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

use diesel::SelectableHelper;
use std::collections::HashMap;

use actix_web::web::{Json, ReqData};
use actix_web::Scope;
use airborne_authz_macros::authz;

use actix_web::{post, web};
use aws_smithy_types::Document;
use diesel::{Connection, RunQueryDsl};
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

const MAX_APP_NAME_LENGTH: usize = 50;

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
    allow_app = false
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
    validate_application_name(&application)?;

    let auth_response = auth_response.into_inner();
    let sub = &auth_response.sub;
    let organisation = require_scope_name(auth_response.organisation, "organisation")?;
    info!(
        "Validated org context '{}' while creating app '{}'",
        organisation, application
    );

    // Steps run cheapest-to-undo first and the unique workspace mapping goes first, so a
    // name that is taken is refused before anything else is written. If a later step
    // fails, the earlier ones are undone: a failed create leaves no application behind.
    // The Superposition workspace is the one thing not undone (its name is never reused;
    // the orphan is left for an operator, like those of a deleted organisation).
    let mut progress = Provisioned::default();
    if let Err(error) = provision(&state, &organisation, &application, sub, &mut progress).await {
        compensate(&state, &organisation, &application, &progress).await;
        return Err(error);
    }

    Ok(Json(Application {
        application,
        organisation,
        access: vec!["read".to_string(), "write".to_string(), "admin".to_string()],
    }))
}

/// What `provision` has written so far, for `compensate`.
#[derive(Default)]
struct Provisioned {
    workspace_id: Option<i32>,
    granted: bool,
}

async fn provision(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    sub: &str,
    progress: &mut Provisioned,
) -> airborne_types::Result<()> {
    let mut conn = state.db_pool.get()?;
    let new_workspace_name = NewWorkspaceName {
        organization_id: organisation,
        application_id: application,
        workspace_name: "pending",
    };
    let mut inserted_workspace: WorkspaceName = conn.transaction::<_, ABError, _>(|conn| {
        let workspace = insert_workspace(conn, &new_workspace_name).map_err(|e| match e {
            diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _) => {
                ABError::Conflict(format!(
                    "Application '{application}' already exists in organisation '{organisation}'"
                ))
            }
            e => ABError::InternalServerError(format!("Failed to store workspace name: {e}")),
        })?;
        diesel::sql_query("INSERT INTO hyperotaserver.serving_policies(org_id,app_id,strict) VALUES($1,$2,true) ON CONFLICT DO NOTHING")
            .bind::<diesel::sql_types::Text, _>(organisation)
            .bind::<diesel::sql_types::Text, _>(application)
            .execute(conn)?;
        Ok(workspace)
    })?;
    progress.workspace_id = Some(inserted_workspace.id);
    let generated_workspace_name = format!("workspace{}", inserted_workspace.id);
    inserted_workspace.workspace_name = generated_workspace_name.clone();
    diesel::update(workspace_names::table.filter(workspace_names::id.eq(inserted_workspace.id)))
        .set(workspace_names::workspace_name.eq(&generated_workspace_name))
        .execute(&mut conn)
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to update workspace name: {}", e))
        })?;
    drop(conn);

    // Entries cached for an earlier application of this name (a deleted organisation's,
    // kept for up to a week) would send the new one to that application's workspace.
    if let Some(cache) = &state.redis_cache {
        cache.purge_scope(organisation, Some(application)).await?;
    }

    if let Err(error) = state
        .authz_provider
        .create_application(state.get_ref(), organisation, application, sub)
        .await
    {
        // "Already exists" means these grants are not ours to remove; any other failure
        // may have written some of them.
        progress.granted =
            !matches!(&error, ABError::BadRequest(m) if m.contains("already exists"));
        return Err(error);
    }
    progress.granted = true;

    state
        .superposition_client
        .create_workspace()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_name(generated_workspace_name)
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
        state,
        &SuperpositionMigrationStrategy::Patch,
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace migration error: {}", e)))?;
    Ok(())
}

/// Undo what `provision` wrote. Failures here are logged, not returned: the caller is
/// already reporting the original error.
async fn compensate(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    progress: &Provisioned,
) {
    if progress.granted {
        if let Err(e) = state
            .authz_provider
            .delete_application(state.get_ref(), organisation, application)
            .await
        {
            log::error!("Could not remove grants of half-created application {organisation}/{application}: {e}");
        }
    }
    let Some(id) = progress.workspace_id else {
        return;
    };
    let result = state
        .db_pool
        .get()
        .map_err(ABError::from)
        .and_then(|mut conn| {
            conn.transaction::<_, ABError, _>(|conn| {
                diesel::sql_query(
                    "DELETE FROM hyperotaserver.serving_policies WHERE org_id=$1 AND app_id=$2",
                )
                .bind::<diesel::sql_types::Text, _>(organisation)
                .bind::<diesel::sql_types::Text, _>(application)
                .execute(conn)?;
                diesel::delete(workspace_names::table.filter(workspace_names::id.eq(id)))
                    .execute(conn)?;
                Ok(())
            })
        });
    if let Err(e) = result {
        log::error!("Could not remove workspace mapping of half-created application {organisation}/{application}: {e}");
    }
}

fn validate_application_name(name: &str) -> airborne_types::Result<()> {
    if name.trim().is_empty() {
        return Err(ABError::BadRequest(
            "Application name cannot be empty".to_string(),
        ));
    }

    if name.len() > MAX_APP_NAME_LENGTH {
        return Err(ABError::BadRequest(
            "Application name is too long".to_string(),
        ));
    }

    if !name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_' || c == '.')
    {
        return Err(ABError::BadRequest(
            "Application name can only contain: a-z, 0-9, -, _, .".to_string(),
        ));
    }

    Ok(())
}

fn insert_workspace(
    conn: &mut diesel::PgConnection,
    new: &NewWorkspaceName<'_>,
) -> diesel::QueryResult<WorkspaceName> {
    diesel::insert_into(workspace_names::table)
        .values(new)
        .returning(WorkspaceName::as_returning())
        .get_result(conn)
}

#[cfg(test)]
mod replay_regression {
    use super::*;
    use diesel::Connection;
    #[test]
    #[ignore = "requires TEST_DATABASE_URL"]
    fn workspace_insert_returns_model_column_order() {
        let mut conn =
            diesel::PgConnection::establish(&std::env::var("TEST_DATABASE_URL").unwrap()).unwrap();
        conn.test_transaction::<_, diesel::result::Error, _>(|conn| {
            let new = NewWorkspaceName {
                organization_id: "kharcha-replay-regression",
                application_id: "scratch",
                workspace_name: "pending",
            };
            let row = insert_workspace(conn, &new)?;
            assert_eq!(row.application_id, "scratch");
            assert_eq!(row.workspace_name, "pending");
            Ok(())
        });
    }
}
