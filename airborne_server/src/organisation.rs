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

use crate::organisation::application::types::Application;
use crate::types as airborne_types;
use crate::types::AppState;
use crate::{middleware::auth::AuthResponse, types::ABError};
use actix_web::{
    delete, get, post,
    web::{self, Json, Path},
    HttpMessage, HttpRequest, Scope,
};
use google_sheets4::api::ValueRange;
use serde::{Deserialize, Serialize};
use serde_json::json;

pub mod application;
pub mod user;

// Constants
const MAX_ORG_NAME_LENGTH: usize = 50;

// Routes
pub fn add_routes() -> Scope {
    Scope::new("")
        .service(request_organisation)
        .service(create_organisation)
        .service(delete_organisation)
        .service(list_organisations)
        .service(Scope::new("/applications").service(application::add_routes()))
        .service(Scope::new("/user").service(user::add_routes()))
}

// Structs
#[derive(Serialize, Deserialize)]
pub struct Organisation {
    pub name: String,
    pub applications: Vec<Application>,
    pub access: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct OrganisationCreatedRequest {
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct OrganisationRequest {
    pub organisation_name: String,
    pub name: String,
    pub email: String,
    pub play_store_link: Option<String>,
    pub app_store_link: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct OrganisationRequestResponse {
    pub organisation_name: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct OrganisationListResponse {
    pub organisations: Vec<Organisation>,
}

#[post("/request")]
async fn request_organisation(
    _req: HttpRequest,
    body: Json<OrganisationRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<OrganisationRequestResponse>> {
    let organisation_name = body.organisation_name.clone();
    let name = body.name.clone();
    let email = body.email.clone();
    let play_store_link = body.play_store_link.clone().unwrap_or("".to_string());
    let app_store_link = body.app_store_link.clone().unwrap_or("".to_string());

    // Validate organization name
    validate_organisation_name(&organisation_name)?;

    // Check if organization already exists
    if state
        .authz_provider
        .organisation_exists(state.get_ref(), &organisation_name)
        .await?
    {
        return Err(ABError::BadRequest(
            "Organisation name is taken".to_string(),
        ));
    }

    // Push the organization to Google Sheets
    let req = ValueRange {
        major_dimension: None,
        range: None,
        values: Some(vec![vec![
            serde_json::Value::String(name),
            serde_json::Value::String(email),
            serde_json::Value::String("".to_string()), // phone number
            serde_json::Value::String(organisation_name.clone()),
            serde_json::Value::String(app_store_link),
            serde_json::Value::String(play_store_link),
        ]]),
    };

    match state.sheets_hub {
        Some(ref hub) => {
            let _result = hub
                .spreadsheets()
                .values_append(req, &state.env.google_spreadsheet_id, "A1:G1000")
                .value_input_option("USER_ENTERED")
                .doit()
                .await
                .map_err(|e| {
                    ABError::InternalServerError(format!(" Google Sheet error: {:?}", e))
                })?;
        }
        None => {
            return Err(ABError::InternalServerError(
                "Google Sheets hub is not configured".to_string(),
            ));
        }
    }

    Ok(Json(OrganisationRequestResponse {
        organisation_name,
        message: "Organisation request submitted successfully".to_string(),
    }))
}

#[post("/create")]
async fn create_organisation(
    req: HttpRequest,
    body: Json<OrganisationCreatedRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Organisation>> {
    let organisation = body.name.clone();

    // Validate organization name
    validate_organisation_name(&organisation)?;

    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ABError::Unauthorized("Token Parse Failed".to_string()))?;
    let sub = &auth_response.sub;

    if state.env.organisation_creation_disabled && !auth_response.is_super_admin {
        return Err(ABError::BadRequest(
            "You do not have permission to create new organisation".to_string(),
        ));
    }

    // Check if organization already exists
    if state
        .authz_provider
        .organisation_exists(state.get_ref(), &organisation)
        .await?
    {
        return Err(ABError::BadRequest(
            "Organisation name is taken".to_string(),
        ));
    }

    state
        .authz_provider
        .create_organisation(state.get_ref(), &organisation, sub)
        .await?;

    Ok(Json(Organisation {
        name: organisation,
        applications: vec![],
        access: vec![
            "owner".to_string(),
            "admin".to_string(),
            "write".to_string(),
            "read".to_string(),
        ],
    }))
}

#[delete("/{org_name}")]
async fn delete_organisation(
    req: HttpRequest,
    path: Path<String>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    let organisation = path.into_inner();

    // Validate organization name
    validate_organisation_name(&organisation)?;

    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ABError::Unauthorized("Token Parse Failed".to_string()))?;

    // Check if organization exists
    if !state
        .authz_provider
        .organisation_exists(state.get_ref(), &organisation)
        .await?
    {
        return Err(ABError::BadRequest(
            "Organisation does not exist".to_string(),
        ));
    }

    // Check if user has permissions to delete organization
    if auth_response
        .organisation
        .as_ref()
        .is_some_and(|org| org.name == organisation && org.is_admin_or_higher())
    {
        state
            .authz_provider
            .delete_organisation(state.get_ref(), &organisation)
            .await?;

        Ok(Json(
            json!({"Success" : "Organisation deleted successfully"}),
        ))
    } else {
        Err(ABError::Forbidden(
            "You do not have permission to delete this organisation".to_string(),
        ))
    }
}

#[get("")]
async fn list_organisations(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<OrganisationListResponse>> {
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ABError::Unauthorized("Token Parse Failed".to_string()))?;
    let summary = state
        .authz_provider
        .get_user_access_summary(state.get_ref(), &auth_response.sub)
        .await?;
    let mut organisations = summary
        .organisations
        .into_iter()
        .map(|org| Organisation {
            name: org.name,
            applications: org
                .applications
                .into_iter()
                .map(|app| Application {
                    application: app.application,
                    organisation: app.organisation,
                    access: app.access,
                })
                .collect(),
            access: org.access,
        })
        .collect::<Vec<_>>();
    organisations.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(Json(OrganisationListResponse { organisations }))
}

/// Validate organization name for security and usability
pub fn validate_organisation_name(name: &str) -> airborne_types::Result<()> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(ABError::BadRequest(
            "Organisation name cannot be empty".to_string(),
        ));
    }

    if trimmed.len() > MAX_ORG_NAME_LENGTH {
        return Err(ABError::BadRequest(
            "Organisation name is too long".to_string(),
        ));
    }

    // Basic pattern matching for valid organization name
    if !trimmed
        .chars()
        .all(|c| c.is_alphanumeric() || c == ' ' || c == '-' || c == '_')
    {
        return Err(ABError::BadRequest(
            "Organisation name can only contain alphanumeric characters, spaces, hyphens, and underscores".to_string(),
        ));
    }

    Ok(())
}
