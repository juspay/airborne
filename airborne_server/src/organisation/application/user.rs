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

mod transaction;
mod types;
mod utils;

use actix_web::{
    get, post,
    web::{self, Json},
    HttpMessage, HttpRequest, Scope,
};
use log::{debug, info};

use crate::{
    middleware::auth::{
        validate_required_access, validate_user, Access, AuthResponse, ADMIN, READ,
    },
    organisation::application::{types::OrgAppError, user::types::*},
    types as airborne_types,
    types::{ABError, AppState},
    utils::keycloak::{find_org_group, find_user_by_username, prepare_user_action},
};

use self::{
    transaction::{
        add_user_with_transaction, get_user_current_role, remove_user_with_transaction,
        update_user_with_transaction,
    },
    utils::{check_role_hierarchy, is_last_admin_in_application, validate_access_level},
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(application_list_users)
        .service(application_add_user)
        .service(application_update_user)
        .service(application_remove_user)
}

/// Get application context and validate user permissions
async fn get_app_context(
    req: &HttpRequest,
    required_level: Access,
    operation: &str,
) -> airborne_types::Result<(AppContext, AuthResponse)> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth".to_string()))?;

    // For application operations, we need to check:
    // 1. User has some access to the organization (at least READ)
    // 2. User has the required access level to the application

    let (org_name, app_name) = match validate_user(auth.organisation.clone(), ADMIN) {
        Ok(org_name) => auth
            .application
            .clone()
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth.organisation.clone(), READ)
            .and_then(|org_name| {
                validate_user(auth.application.clone(), required_level)
                    .map(|app_name| (org_name, app_name))
            })
            .map_err(|e| ABError::Forbidden(e.to_string())),
    }?;

    // For application admin operations, application-level permissions take precedence
    // over organization-level permissions
    if let Some(app_access) = &auth.application {
        if app_access.level >= required_level.access {
            // User has sufficient application-level access
            return Ok((
                AppContext {
                    org_name: org_name.clone(),
                    app_name: app_name.clone(),
                    app_group_id: String::new(), // Will be filled by find_application
                },
                auth,
            ));
        }
    }

    // Fallback: check organization-level permissions for the operation
    validate_required_access(&auth, required_level.access, operation).await?;

    Ok((
        AppContext {
            org_name: org_name.clone(),
            app_name: app_name.clone(),
            app_group_id: String::new(), // Will be filled by find_application
        },
        auth,
    ))
}

/// Find a user and extract their ID
async fn find_target_user(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    username: &str,
) -> airborne_types::Result<UserContext> {
    let target_user = find_user_by_username(admin, realm, username)
        .await?
        .ok_or_else(|| OrgAppError::UserNotFound(username.to_string()))?;

    let target_user_id = target_user
        .id
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("User has no ID".to_string()))?
        .to_string();

    let username = target_user
        .username
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("User has no username".to_string()))?
        .to_string();

    Ok(UserContext {
        user_id: target_user_id,
        username,
    })
}

/// Find an application and extract its context
async fn find_application(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    org_name: &str,
    app_name: &str,
) -> airborne_types::Result<AppContext> {
    // First find the organization group
    let org_group = find_org_group(admin, realm, org_name)
        .await?
        .ok_or_else(|| OrgAppError::OrgNotFound(org_name.to_string()))?;

    let org_group_id = org_group
        .id
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("Organization group has no ID".to_string()))?
        .to_string();

    // Find the application subgroup within the organization
    let app_subgroups = admin
        .realm_groups_with_group_id_children_get(realm, &org_group_id, None, None, None, None, None)
        .await?;

    let app_group = app_subgroups
        .iter()
        .find(|group| {
            if let Some(name) = &group.name {
                name == app_name
            } else {
                false
            }
        })
        .ok_or_else(|| OrgAppError::AppNotFound(app_name.to_string()))?;

    let app_group_id = app_group
        .id
        .as_ref()
        .ok_or_else(|| ABError::InternalServerError("Application group has no ID".to_string()))?
        .to_string();

    Ok(AppContext {
        org_name: org_name.to_string(),
        app_name: app_name.to_string(),
        app_group_id,
    })
}

#[post("/create")]
async fn application_add_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let body = body.into_inner();

    // Get application context and validate requester's permissions
    let (mut app_context, auth) = get_app_context(&req, ADMIN, "add user").await?;
    let requester_id = &auth.sub;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone()).await?;

    // Validate access level (only admin, write, read for applications)
    let (role_name, _role_level) = validate_access_level(&body.access.as_str())?;

    // Find target user and application in parallel
    let (target_user, filled_app_context) = tokio::join!(
        find_target_user(&admin, &realm, &body.user),
        find_application(&admin, &realm, &app_context.org_name, &app_context.app_name)
    );

    let target_user = target_user?;
    app_context = filled_app_context?;

    // Check role hierarchy
    check_role_hierarchy(
        &admin,
        &realm,
        &app_context.app_group_id,
        requester_id,
        &target_user.user_id,
    )
    .await?;

    debug!(
        "Adding user {} to app {}/{} with access level {}",
        body.user, app_context.org_name, app_context.app_name, role_name
    );

    // Use transaction function to add user
    add_user_with_transaction(&admin, &realm, &app_context, &target_user, &role_name).await?;

    info!(
        "Successfully added user {} to app {}/{} with access level {}",
        body.user, app_context.org_name, app_context.app_name, role_name
    );

    Ok(Json(UserOperationResponse {
        user: body.user,
        success: true,
        operation: "add".to_string(),
    }))
}

#[post("/update")]
async fn application_update_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();

    // Get application context and validate requester's permissions
    let (mut app_context, auth) = get_app_context(&req, ADMIN, "update user").await?;
    let requester_id = &auth.sub;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone()).await?;

    // Validate the requested access level
    let (role_name, _access_level) = validate_access_level(&request.access.as_str())?;

    // Find target user and application
    let target_user = find_target_user(&admin, &realm, &request.user).await?;
    app_context =
        find_application(&admin, &realm, &app_context.org_name, &app_context.app_name).await?;

    // Check if requester has permission to modify this user (hierarchy check)
    check_role_hierarchy(
        &admin,
        &realm,
        &app_context.app_group_id,
        requester_id,
        &target_user.user_id,
    )
    .await?;

    // Get the user's current role for the transaction
    let current_role =
        get_user_current_role(&admin, &realm, &app_context, &target_user.user_id).await?;

    // Check if this would demote the last admin (can't do that)
    if current_role == "admin" && role_name != "admin" {
        let is_last_admin = is_last_admin_in_application(
            &admin,
            &realm,
            &app_context.app_group_id,
            &target_user.user_id,
        )
        .await?;

        if is_last_admin {
            return Err(OrgAppError::PermissionDenied(
                "Cannot demote the last admin from the application. Applications must have at least one admin.".to_string(),
            )
            .into());
        }
    }

    // Use transaction function to update user
    update_user_with_transaction(
        &admin,
        &realm,
        &app_context,
        &target_user,
        &role_name,
        &current_role,
        &state,
    )
    .await?;

    info!(
        "Successfully updated user {} in app {}/{} to role {}",
        request.user, app_context.org_name, app_context.app_name, role_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "update".to_string(),
    }))
}

#[post("/remove")]
async fn application_remove_user(
    req: HttpRequest,
    body: Json<RemoveUserRequest>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();

    // Get application context and validate requester's permissions
    let (mut app_context, auth) = get_app_context(&req, ADMIN, "remove user").await?;
    let requester_id = &auth.sub;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state.clone()).await?;

    // Find target user and application
    let target_user = find_target_user(&admin, &realm, &request.user).await?;
    app_context =
        find_application(&admin, &realm, &app_context.org_name, &app_context.app_name).await?;

    // Check if this user is the last admin in the application (can't remove them)
    let is_last_admin = is_last_admin_in_application(
        &admin,
        &realm,
        &app_context.app_group_id,
        &target_user.user_id,
    )
    .await?;

    if is_last_admin {
        return Err(OrgAppError::PermissionDenied(
            "Cannot remove the last admin from the application. Applications must have at least one admin.".to_string(),
        )
        .into());
    }

    // Check if requester has permission to modify this user (hierarchy check)
    check_role_hierarchy(
        &admin,
        &realm,
        &app_context.app_group_id,
        requester_id,
        &target_user.user_id,
    )
    .await?;

    // Get user's current groups
    let user_groups = admin
        .realm_users_with_user_id_groups_get(&realm, &target_user.user_id, None, None, None, None)
        .await?;

    // Use transaction function to remove user
    remove_user_with_transaction(
        &admin,
        &realm,
        &app_context,
        &target_user,
        &user_groups,
        &state,
    )
    .await?;

    info!(
        "Successfully removed user {} from application {}/{}",
        request.user, app_context.org_name, app_context.app_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "remove".to_string(),
    }))
}

#[get("/list")]
async fn application_list_users(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListUsersResponse>> {
    // Get application context and validate requester's permissions
    let (app_context, _) = get_app_context(&req, READ, "list users").await?;

    // Prepare Keycloak admin client
    let (admin, realm) = prepare_user_action(&req, state).await?;

    // Find the application
    let app_context =
        find_application(&admin, &realm, &app_context.org_name, &app_context.app_name).await?;

    debug!(
        "Listing users for application: {}/{} (ID: {})",
        app_context.org_name, app_context.app_name, app_context.app_group_id
    );

    // Get all users in the realm
    let all_users = admin
        .realm_users_get(
            &realm,
            Some(true), // briefRepresentation
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await?;

    // Collect information about users in this application
    let mut user_infos = Vec::new();
    let app_path = format!("/{}/{}/", app_context.org_name, app_context.app_name);

    for user in all_users {
        if let Some(user_id) = user.id.as_ref() {
            // Get groups for this user
            let user_groups = admin
                .realm_users_with_user_id_groups_get(&realm, user_id, None, None, None, None)
                .await?;

            // Check if user is in this application
            let is_member = user_groups.iter().any(|group| {
                group
                    .path
                    .as_ref()
                    .is_some_and(|path| path.contains(&app_path))
            });

            if is_member {
                let username = user.username.as_ref().ok_or_else(|| {
                    ABError::InternalServerError("User has no username".to_string())
                })?;

                // Extract roles from group paths
                let roles = user_groups
                    .iter()
                    .filter_map(|group| {
                        if let Some(path) = &group.path {
                            if path.starts_with(&format!(
                                "/{}/{}/",
                                app_context.org_name, app_context.app_name
                            )) {
                                return path.split('/').next_back().map(String::from);
                            }
                        }
                        None
                    })
                    .collect();

                user_infos.push(UserInfo {
                    username: username.clone(),
                    email: user.email.clone(),
                    roles,
                });
            }
        }
    }

    info!(
        "Found {} users in application {}/{}",
        user_infos.len(),
        app_context.org_name,
        app_context.app_name
    );

    Ok(Json(ListUsersResponse { users: user_infos }))
}
