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
    middleware::auth::{require_scope_name, AuthResponse},
    organisation::user::types::*,
    types as airborne_types,
    types::{ABError, AppState},
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(organisation_list_users)
        .service(organisation_add_user)
        .service(organisation_update_user)
        .service(organisation_remove_user)
        .service(organisation_transfer_ownership)
        .service(list_organisation_roles)
        .service(list_organisation_permissions)
        .service(upsert_organisation_role)
}

async fn get_org_context(req: &HttpRequest) -> airborne_types::Result<(String, AuthResponse)> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    let org_name = require_scope_name(auth.organisation.clone(), "organisation")?;
    Ok((org_name, auth))
}

#[authz(
    resource = "organisation_user",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = [],
    webhook_allowed = false
)]
#[post("/create")]
async fn organisation_add_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let body = body.into_inner();
    let (organisation, auth) = get_org_context(&req).await?;
    let role_name = body.access.trim();

    state
        .authz_provider
        .add_organisation_user(
            state.get_ref(),
            &auth.sub,
            &organisation,
            &body.user,
            role_name,
        )
        .await?;

    info!(
        "Added org user {} in org {} with role {}",
        body.user, organisation, role_name
    );
    Ok(Json(UserOperationResponse {
        user: body.user,
        success: true,
        operation: "add".to_string(),
    }))
}

#[authz(
    resource = "organisation_user",
    action = "update",
    org_roles = ["owner", "admin"],
    app_roles = [],
    webhook_allowed = false
)]
#[post("/update")]
async fn organisation_update_user(
    req: HttpRequest,
    body: Json<UserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();
    let (org_name, auth) = get_org_context(&req).await?;
    let role_name = request.access.trim();

    state
        .authz_provider
        .update_organisation_user(
            state.get_ref(),
            &auth.sub,
            &org_name,
            &request.user,
            role_name,
        )
        .await?;

    info!(
        "Updated org user {} in org {} to role {}",
        request.user, org_name, role_name
    );
    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "update".to_string(),
    }))
}

#[authz(
    resource = "organisation_user",
    action = "delete",
    org_roles = ["owner", "admin"],
    app_roles = [],
    webhook_allowed = false
)]
#[post("/remove")]
async fn organisation_remove_user(
    req: HttpRequest,
    body: Json<RemoveUserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let request = body.into_inner();
    let (org_name, auth) = get_org_context(&req).await?;

    state
        .authz_provider
        .remove_organisation_user(state.get_ref(), &auth.sub, &org_name, &request.user)
        .await?;

    info!("Removed org user {} from org {}", request.user, org_name);
    Ok(Json(UserOperationResponse {
        user: request.user,
        success: true,
        operation: "remove".to_string(),
    }))
}

#[authz(
    resource = "organisation_user",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = [],
    webhook_allowed = false
)]
#[get("/list")]
async fn organisation_list_users(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListUsersResponse>> {
    let (org_name, _) = get_org_context(&req).await?;
    let users = state
        .authz_provider
        .list_organisation_users(state.get_ref(), &org_name)
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
    resource = "organisation_user",
    action = "transfer",
    org_roles = ["owner"],
    app_roles = [],
    webhook_allowed = false
)]
#[post("/transfer-ownership")]
async fn organisation_transfer_ownership(
    req: HttpRequest,
    body: Json<RemoveUserRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<UserOperationResponse>> {
    let target_user = body.user.clone();
    let (org_name, auth) = get_org_context(&req).await?;

    state
        .authz_provider
        .transfer_organisation_ownership(state.get_ref(), &auth.sub, &org_name, &target_user)
        .await?;

    Ok(Json(UserOperationResponse {
        user: target_user,
        success: true,
        operation: "Transfer Ownership".to_string(),
    }))
}

#[authz(
    resource = "organisation_role",
    action = "read",
    org_roles = ["owner", "admin"],
    app_roles = [],
    webhook_allowed = false
)]
#[get("/roles/list")]
async fn list_organisation_roles(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListRolesResponse>> {
    let (org_name, auth) = get_org_context(&req).await?;
    let roles = state
        .authz_provider
        .list_role_definitions(state.get_ref(), &auth.sub, &org_name, None)
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
    resource = "organisation_role",
    action = "read",
    org_roles = ["owner", "admin"],
    app_roles = [],
    webhook_allowed = false
)]
#[get("/permissions/list")]
async fn list_organisation_permissions(
    req: HttpRequest,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListPermissionsResponse>> {
    let (org_name, auth) = get_org_context(&req).await?;
    let permissions = state
        .authz_provider
        .list_available_permissions(state.get_ref(), &auth.sub, &org_name, None)
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
    resource = "organisation_role",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = [],
    webhook_allowed = false
)]
#[post("/roles/upsert")]
async fn upsert_organisation_role(
    req: HttpRequest,
    body: Json<UpsertRoleRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<serde_json::Value>> {
    let payload = body.into_inner();
    let (org_name, auth) = get_org_context(&req).await?;
    state
        .authz_provider
        .upsert_custom_role(
            state.get_ref(),
            &auth.sub,
            &org_name,
            None,
            payload.role.trim(),
            &payload.permissions,
        )
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "role": payload.role.trim().to_ascii_lowercase(),
    })))
}
