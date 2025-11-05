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

use actix_web::{
    get, post,
    web::{Data, Json, Query, ReqData},
    Scope,
};
use chrono::Utc;
use diesel::prelude::*;
use diesel::sql_query;
use uuid::Uuid;

use crate::{
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ},
    run_blocking,
    types::{ABError, AppState},
    utils::db::{
        models::ApplicationSettingsEntry,
        schema::hyperotaserver::application_settings::{self, app_id, org_id, version},
        DbPool,
    },
};

use types::*;

pub mod types;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(get_settings_handler)
        .service(get_settings_history_paginated)
        .service(update_settings_handler)
}

pub async fn get_settings(
    db_pool: &DbPool,
    organisation: String,
    application: String,
) -> Result<ApplicationSettingsEntry, ABError> {
    let pool = db_pool.clone();
    let org = organisation.clone();
    let app = application.clone();
    let settings = run_blocking!({
        let mut conn = pool.get()?;
        application_settings::table
            .filter(org_id.eq(&org))
            .filter(app_id.eq(&app))
            .order(version.desc())
            .first::<ApplicationSettingsEntry>(&mut conn)
            .optional()
            .map_err(|e| ABError::InternalServerError(format!("Failed to fetch settings: {}", e)))
    })?;

    if let Some(existing) = settings {
        return Ok(existing);
    }

    let new_settings = ApplicationSettingsEntry::default(&organisation, &application);

    update_settings(
        db_pool,
        organisation.clone(),
        application.clone(),
        UpdateApplicationSettingsRequest {
            maven_namespace: Some(new_settings.maven_namespace.clone()),
            maven_artifact_id: Some(new_settings.maven_artifact_id.clone()),
            maven_group_id: Some(new_settings.maven_group_id.clone()),
        },
    )
    .await?;

    Ok(new_settings)
}

pub async fn get_settings_history(
    db_pool: &DbPool,
    organisation: String,
    application: String,
    page: Option<i32>,
    per_page: Option<i32>,
) -> Result<(Vec<ApplicationSettingsEntry>, i64), ABError> {
    let pool = db_pool.clone();
    let org = organisation.clone();
    let app = application.clone();

    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(20).clamp(1, 100);
    let offset = ((page - 1) * per_page) as i64;

    let (settings, total_count) = run_blocking!({
        let mut conn = pool.get()?;

        // Get total count
        let total: i64 = application_settings::table
            .filter(org_id.eq(&org))
            .filter(app_id.eq(&app))
            .count()
            .get_result(&mut conn)
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to count settings: {}", e))
            })?;

        // Get paginated results
        let settings: Vec<ApplicationSettingsEntry> = application_settings::table
            .filter(org_id.eq(&org))
            .filter(app_id.eq(&app))
            .order(version.desc())
            .limit(per_page as i64)
            .offset(offset)
            .load(&mut conn)
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to fetch settings history: {}", e))
            })?;

        Ok((settings, total))
    })?;

    Ok((settings, total_count))
}

#[get("")]
async fn get_settings_handler(
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> actix_web::Result<Json<ApplicationSettingsResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let settings = get_settings(&state.db_pool, organisation, application).await?;

    let response = ApplicationSettingsResponse {
        maven_namespace: settings.maven_namespace,
        maven_artifact_id: settings.maven_artifact_id,
        maven_group_id: settings.maven_group_id,
        created_at: settings.created_at,
    };

    Ok(Json(response))
}

pub async fn update_settings(
    db_pool: &DbPool,
    organisation: String,
    application: String,
    request: UpdateApplicationSettingsRequest,
) -> Result<ApplicationSettingsEntry, ABError> {
    let pool = db_pool.clone();
    let new_settings = run_blocking!({
        let mut conn = pool.get()?;

        // Use PostgreSQL advisory lock to prevent race conditions
        let lock_id: i64 = {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            format!("{}-{}-settings", organisation, application).hash(&mut hasher);
            hasher.finish() as i64
        };

        let result = conn.transaction::<ApplicationSettingsEntry, ABError, _>(|conn| {
            // Acquire advisory lock
            sql_query("SELECT pg_advisory_xact_lock($1)")
                .bind::<diesel::sql_types::BigInt, _>(lock_id)
                .execute(conn)
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to acquire lock: {}", e))
                })?;

            // Get the latest version number
            let latest_version: i32 = application_settings::table
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .select(version)
                .order(version.desc())
                .first::<i32>(conn)
                .optional()
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to get latest version: {}", e))
                })?
                .unwrap_or(0);

            // Get current settings to use as defaults for unspecified fields
            let current_settings = application_settings::table
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .order(version.desc())
                .first::<ApplicationSettingsEntry>(conn)
                .optional()
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to get current settings: {}", e))
                })?;

            let new_entry = ApplicationSettingsEntry {
                id: Uuid::new_v4(),
                version: latest_version + 1,
                org_id: organisation.clone(),
                app_id: application.clone(),
                maven_namespace: request.maven_namespace.clone().unwrap_or_else(|| {
                    current_settings
                        .as_ref()
                        .map(|s| s.maven_namespace.clone())
                        .unwrap_or_default()
                }),
                maven_artifact_id: request.maven_artifact_id.clone().unwrap_or_else(|| {
                    current_settings
                        .as_ref()
                        .map(|s| s.maven_artifact_id.clone())
                        .unwrap_or_default()
                }),
                maven_group_id: request.maven_group_id.clone().unwrap_or_else(|| {
                    current_settings
                        .as_ref()
                        .map(|s| s.maven_group_id.clone())
                        .unwrap_or_default()
                }),
                created_at: Utc::now(),
            };

            diesel::insert_into(application_settings::table)
                .values(&new_entry)
                .execute(conn)
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to insert settings: {}", e))
                })?;

            Ok(new_entry)
        });

        result
    })?;

    Ok(new_settings)
}

#[post("")]
async fn update_settings_handler(
    req: Json<UpdateApplicationSettingsRequest>,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> actix_web::Result<Json<ApplicationSettingsResponse>, ABError> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), ADMIN)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let request = req.into_inner();
    let new_settings = update_settings(&state.db_pool, organisation, application, request).await?;

    Ok(Json(ApplicationSettingsResponse {
        maven_namespace: new_settings.maven_namespace,
        maven_artifact_id: new_settings.maven_artifact_id,
        maven_group_id: new_settings.maven_group_id,
        created_at: new_settings.created_at,
    }))
}

#[get("/history")]
async fn get_settings_history_paginated(
    query: Query<SettingsHistoryQuery>,
    auth_response: ReqData<AuthResponse>,
    state: Data<AppState>,
) -> actix_web::Result<Json<ApplicationSettingsHistoryResponse>, ABError> {
    let auth_response = auth_response.into_inner();

    if !auth_response.is_super_admin {
        return Err(ABError::Forbidden(
            "Super admin access required for settings history".to_string(),
        ));
    }

    let (organisation, application) = match validate_user(auth_response.organisation.clone(), READ)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => {
            return Err(ABError::Unauthorized("No organization access".to_string()));
        }
    }?;

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 100);

    // Get paginated settings history using the existing function
    let (paginated_settings, total_count) = get_settings_history(
        &state.db_pool,
        organisation.clone(),
        application.clone(),
        Some(page),
        Some(per_page),
    )
    .await?;

    let total_pages = ((total_count + per_page as i64 - 1) / per_page as i64) as i32;

    let history_entries: Vec<ApplicationSettingsHistoryEntry> = paginated_settings
        .into_iter()
        .map(|entry| ApplicationSettingsHistoryEntry {
            version: entry.version,
            maven_namespace: entry.maven_namespace,
            maven_artifact_id: entry.maven_artifact_id,
            maven_group_id: entry.maven_group_id,
            created_at: entry.created_at,
        })
        .collect();

    Ok(Json(ApplicationSettingsHistoryResponse {
        org_id: organisation,
        app_id: application,
        settings: history_entries,
        total: total_count,
        page,
        per_page,
        total_pages,
    }))
}
