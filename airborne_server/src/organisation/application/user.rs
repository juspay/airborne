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

mod types;

use actix_web::{
    get, post,
    web::{self, Json, ReqData},
    HttpMessage, HttpRequest, Scope,
};
use airborne_authz_macros::authz;
use log::info;

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    organisation::application::user::types::*,
    types as airborne_types,
    types::{ABError, AppState},
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(application_list_users)
        .service(application_add_user)
        .service(application_update_user)
        .service(application_remove_user)
        .service(list_application_roles)
        .service(list_application_permissions)
        .service(upsert_application_role)
}

async fn get_app_context(
    req: &HttpRequest,
) -> airborne_types::Result<(String, String, AuthResponse)> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    let (org_name, app_name) =
        require_org_and_app(auth.organisation.clone(), auth.application.clone())?;
    Ok((org_name, app_name, auth))
}

#[authz(
    resource = "application_user",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("/create")]
async fn application_add_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();
    let (org_name, app_name, auth) = get_app_context(&req).await?;
    let role_name = request.access.trim();

    state
        .authz_provider
        .add_application_user(
            state.get_ref(),
            &auth.sub,
            &org_name,
            &app_name,
            &request.user,
            role_name,
        )
        .await?;

    info!(
        "Added app user {} in {}/{} with role {}",
        request.user, org_name, app_name, role_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "add".to_string(),
    }))
}

#[authz(
    resource = "application_user",
    action = "update",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("/update")]
async fn application_update_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();
    let (org_name, app_name, auth) = get_app_context(&req).await?;
    let role_name = request.access.trim();

    state
        .authz_provider
        .update_application_user(
            state.get_ref(),
            &auth.sub,
            &org_name,
            &app_name,
            &request.user,
            role_name,
        )
        .await?;

    info!(
        "Updated app user {} in {}/{} to role {}",
        request.user, org_name, app_name, role_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "update".to_string(),
    }))
}

#[authz(
    resource = "application_user",
    action = "delete",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("/remove")]
async fn application_remove_user(
    req: HttpRequest,
    body: Json<RemoveUserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();
    let (org_name, app_name, auth) = get_app_context(&req).await?;

    state
        .authz_provider
        .remove_application_user(
            state.get_ref(),
            &auth.sub,
            &org_name,
            &app_name,
            &request.user,
        )
        .await?;

    info!(
        "Removed app user {} from {}/{}",
        request.user, org_name, app_name
    );

    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "remove".to_string(),
    }))
}

#[authz(
    resource = "application_user",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/list")]
async fn application_list_users(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListUsersResponse>> {
    let (org_name, app_name, _) = get_app_context(&req).await?;
    let users = state
        .authz_provider
        .list_application_users(state.get_ref(), &org_name, &app_name)
        .await?;

    Ok(Json(ListUsersResponse {
        users: users
            .into_iter()
            .map(|user| UserInfo {
                username: user.username,
                email: user.email,
                roles: user.roles,
            })
            .collect(),
    }))
}

#[authz(
    resource = "application_role",
    action = "read",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[get("/roles/list")]
async fn list_application_roles(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListRolesResponse>> {
    let (org_name, app_name, auth) = get_app_context(&req).await?;
    let roles = state
        .authz_provider
        .list_role_definitions(state.get_ref(), &auth.sub, &org_name, Some(&app_name))
        .await?;

    Ok(Json(ListRolesResponse {
        roles: roles
            .into_iter()
            .map(|role| RoleInfo {
                role: role.role,
                is_system: role.is_system,
                permissions: role
                    .permissions
                    .into_iter()
                    .map(|permission| PermissionInfo {
                        key: permission.key,
                        resource: permission.resource,
                        action: permission.action,
                    })
                    .collect(),
            })
            .collect(),
    }))
}

#[authz(
    resource = "application_role",
    action = "read",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[get("/permissions/list")]
async fn list_application_permissions(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListPermissionsResponse>> {
    let (org_name, app_name, auth) = get_app_context(&req).await?;
    let permissions = state
        .authz_provider
        .list_available_permissions(state.get_ref(), &auth.sub, &org_name, Some(&app_name))
        .await?;

    Ok(Json(ListPermissionsResponse {
        permissions: permissions
            .into_iter()
            .map(|permission| PermissionInfo {
                key: permission.key,
                resource: permission.resource,
                action: permission.action,
            })
            .collect(),
    }))
}

#[authz(
    resource = "application_role",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("/roles/upsert")]
async fn upsert_application_role(
    req: HttpRequest,
    body: Json<UpsertRoleRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    let payload = body.into_inner();
    let (org_name, app_name, auth) = get_app_context(&req).await?;
    state
        .authz_provider
        .upsert_custom_role(
            state.get_ref(),
            &auth.sub,
            &org_name,
            Some(&app_name),
            payload.role.trim(),
            &payload.permissions,
        )
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "role": payload.role.trim().to_ascii_lowercase(),
    })))
}
