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

use crate::types::ABError;
use crate::utils::workspace::get_workspace_name_for_application;
use crate::{
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    types::AppState,
    utils::{
        db::{
            models::{PackageEntry, PackageEntryRead},
            schema::hyperotaserver::packages::{app_id, dsl::packages, org_id, version},
        },
        s3::push_file,
    },
};
use actix_multipart::form::{tempfile::TempFile, text::Text, MultipartForm};
use actix_web::{
    get, post,
    web::{self, Json, ReqData},
    Result, Scope,
};
use diesel::dsl::max;
use serde::{Deserialize, Serialize};

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(list)
        .service(create_package_json_v1)
        .service(create_json_v1_multipart)
}

#[derive(Serialize)]
struct Response {
    version: i32,
}

#[derive(Serialize)]
struct PackageList {
    packages: Vec<Package>,
}

#[derive(Serialize)]
struct Package {
    index: crate::utils::db::models::File,
    important: Vec<crate::utils::db::models::File>,
    lazy: Vec<crate::utils::db::models::File>,
    version: i32,
    id: String,
}

#[get("")]
async fn list(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
) -> Result<Json<PackageList>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, READ)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, READ)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let entries = packages
        .filter(org_id.eq(organisation).and(app_id.eq(application)))
        .load::<PackageEntryRead>(&mut conn)
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let entries = entries
        .iter()
        .map(|a| {
            let _ = a.org_id; //Suppress unused variable warning
            let important: Vec<crate::utils::db::models::File> =
                serde_json::from_value(a.important.clone()).unwrap_or_default();
            let lazy: Vec<crate::utils::db::models::File> =
                serde_json::from_value(a.lazy.clone()).unwrap_or_default();

            Package {
                index: serde_json::from_value(a.index.clone()).unwrap_or(
                    crate::utils::db::models::File {
                        url: String::new(),
                        file_path: String::new(),
                    },
                ),
                important,
                lazy,
                version: a.version,
                id: a.id.to_string(),
            }
        })
        .collect();

    Ok(Json(PackageList { packages: entries }))
}

#[derive(Debug, MultipartForm)]
struct PackageJsonV1MultipartRequest {
    #[multipart(rename = "json")]
    json: Text<String>,
    #[multipart(rename = "index")]
    index: Option<TempFile>,
}

#[derive(Debug, Deserialize, Serialize)]
pub enum ContextOperator {
    #[serde(rename = "IS")]
    Is,
}

impl Default for ContextOperator {
    fn default() -> Self {
        Self::Is
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageContext {
    key: String,
    value: String,
    #[serde(default)]
    operator: ContextOperator,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageV1 {
    name: String,
    version: String,
    #[serde(flatten)]
    properties: serde_json::Value,
    index: crate::utils::db::models::File,
    important: Vec<crate::utils::db::models::File>,
    lazy: Vec<crate::utils::db::models::File>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageJsonV1Request {
    package: PackageV1,
    resources: Vec<crate::utils::db::models::File>,
    #[serde(default)]
    contexts: Vec<PackageContext>,
}

#[post("/create_package_json_v1")]
async fn create_package_json_v1(
    req: Json<PackageJsonV1Request>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to application".to_string()))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let latest_version = packages
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .select(max(version))
        .first::<Option<i32>>(&mut conn)
        .map_err(|_| ABError::DbError("".to_string()))?;

    let ver = latest_version.unwrap_or(0) + 1;

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!(
        "Using Superposition Org ID from environment for create_package_json_v1: {}",
        superposition_org_id_from_env
    );

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|_| ABError::InternalServerError("Could not get workspace".to_string()))?;
    println!(
        "Using workspace name for create_package_json_v1: {}",
        workspace_name
    );

    // Store package data with the new important and lazy structure
    diesel::insert_into(packages)
        .values(PackageEntry {
            version: ver,
            app_id: application.clone(),
            org_id: organisation.clone(),
            index: serde_json::to_value(&req.package.index)
                .map_err(|_| ABError::InternalServerError("JSON error".to_string()))?,
            important: serde_json::to_value(&req.package.important)
                .map_err(|_| ABError::InternalServerError("JSON error".to_string()))?,
            lazy: serde_json::to_value(&req.package.lazy)
                .map_err(|_| ABError::InternalServerError("JSON error".to_string()))?,
            properties: serde_json::to_value(&req.package.properties)
                .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
            resources: serde_json::to_value(&req.resources)
                .map_err(|_| ABError::InternalServerError("JSON error".to_string()))?,
        })
        .execute(&mut conn)
        .map_err(|_| ABError::DbError("".to_string()))?;

    Ok(Json(Response { version: ver }))
}

#[post("/create_json_v1_multipart")]
async fn create_json_v1_multipart(
    MultipartForm(form): MultipartForm<PackageJsonV1MultipartRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, ABError> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(|_| ABError::Unauthorized("No access to org".to_string()))?;

    // Parse the JSON request
    let mut req: PackageJsonV1Request = serde_json::from_str(&form.json.into_inner())
        .map_err(|e| ABError::BadRequest(format!("Invalid JSON: {}", e)))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| ABError::InternalServerError("Connection failure".to_string()))?;

    let latest_version = packages
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .select(max(version))
        .first::<Option<i32>>(&mut conn)
        .map_err(|_| ABError::DbError("Connection failure".to_string()))?;

    let ver = latest_version.unwrap_or(0) + 1;

    // Handle file upload if provided and not empty
    if let Some(index_file) = form.index {
        let index_name = index_file.file_name.clone().unwrap_or_default();
        if index_name.is_empty() {
            return Err(ABError::BadRequest(
                "Index file name cannot be empty".to_string(),
            ));
        }

        let s3_client = &state.s3_client;

        let s3_path = format!(
            "assets/{}/{}/{}/{}",
            organisation, application, ver, index_name
        );

        match push_file(
            s3_client,
            state.env.bucket_name.clone(),
            index_file,
            s3_path.clone(),
        )
        .await
        {
            Ok(_) => {
                req.package.index = crate::utils::db::models::File {
                    url: format!(
                        "{}/{}/{}",
                        state.env.public_url, state.env.bucket_name, s3_path
                    ),
                    file_path: index_name.clone(),
                };
            }
            Err(e) => {
                println!("S3 upload error details:");
                println!("Bucket: {}", state.env.bucket_name);
                println!("Path: {}", s3_path);
                println!("Error: {:?}", e);
                return Err(ABError::InternalServerError(
                    "Failed to upload index file".to_string(),
                ));
            }
        }
    }

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!(
        "Using Superposition Org ID from environment for create_json_v1_multipart: {}",
        superposition_org_id_from_env
    );

    // Get workspace name for this application
    let workspace_name = get_workspace_name_for_application(&application, &organisation, &mut conn)
        .await
        .map_err(|e| ABError::InternalServerError(format!("{}", e)))?;
    println!(
        "Using workspace name for create_json_v1_multipart: {}",
        workspace_name
    );

    // Store package data with the new important and lazy structure
    diesel::insert_into(packages)
        .values(PackageEntry {
            version: ver,
            app_id: application.clone(),
            org_id: organisation.clone(),
            index: serde_json::to_value(&req.package.index)
                .map_err(|_| ABError::InternalServerError("JSON Error".to_string()))?,
            important: serde_json::to_value(&req.package.important)
                .map_err(|_| ABError::InternalServerError("JSON Error".to_string()))?,
            lazy: serde_json::to_value(&req.package.lazy)
                .map_err(|_| ABError::InternalServerError("JSON Error".to_string()))?,
            properties: serde_json::to_value(&req.package.properties)
                .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
            resources: serde_json::to_value(&req.resources)
                .map_err(|_| ABError::InternalServerError("JSON Error".to_string()))?,
        })
        .execute(&mut conn)
        .map_err(|_| ABError::DbError("".to_string()))?;

    Ok(Json(Response { version: ver }))
}
