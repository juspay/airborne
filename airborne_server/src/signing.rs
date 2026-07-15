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

pub mod types;
pub mod utils;

use actix_web::{
    get,
    http::{
        header::{HeaderValue, CONTENT_DISPOSITION, CONTENT_TYPE},
        StatusCode,
    },
    patch, post,
    web::{self, Json, Path},
    Scope,
};
use airborne_authz_macros::authz;

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    signing::types::{CreateSigningKeyRequest, SigningKeyResponse, UpdateSigningKeyRequest},
    types as airborne_types,
    types::{ABError, AppState, ListResponse, WithHeaders},
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(list_signing_keys)
        .service(create_signing_key)
        .service(download_public_key)
        .service(update_signing_key)
        .service(set_default_signing_key)
}

fn filename_for(key_id: &str) -> String {
    format!("{key_id}.pem")
}

#[authz(
    resource = "signing_key",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn list_signing_keys(
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListResponse<Vec<SigningKeyResponse>>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let keys = utils::list_keys(state.db_pool.clone(), organisation, application).await?;

    Ok(Json(ListResponse {
        data: keys.into_iter().map(SigningKeyResponse::from).collect(),
    }))
}

#[authz(
    resource = "signing_key",
    action = "create",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("")]
async fn create_signing_key(
    req: Json<CreateSigningKeyRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<SigningKeyResponse>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let key_id = utils::validate_key_id(&req.into_inner().key_id)?;

    let key = utils::create_key(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        key_id,
    )
    .await?;

    // The first key an application gets becomes its default, so the cached
    // "no default key" result has to go.
    utils::invalidate_key_cache(&state, &organisation, &application, &key.name).await;

    Ok(WithHeaders::new(Json(SigningKeyResponse::from(key))).status(StatusCode::CREATED))
}

#[authz(
    resource = "signing_key",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{key_id}/public-key")]
async fn download_public_key(
    path: Path<String>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<String>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let key_id = utils::validate_key_id(&path.into_inner())?;
    let key = utils::get_key(state.db_pool.clone(), organisation, application, key_id).await?;

    let disposition = format!("attachment; filename=\"{}\"", filename_for(&key.name));
    let disposition = HeaderValue::from_str(&disposition).map_err(|e| {
        ABError::InternalServerError(format!("Failed to build content-disposition: {e}"))
    })?;

    Ok(WithHeaders::new(key.public_key)
        .header(
            CONTENT_TYPE,
            HeaderValue::from_static("application/x-pem-file"),
        )
        .header(CONTENT_DISPOSITION, disposition))
}

#[authz(
    resource = "signing_key",
    action = "update",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[patch("/{key_id}")]
async fn update_signing_key(
    path: Path<String>,
    req: Json<UpdateSigningKeyRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<SigningKeyResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let key_id = utils::validate_key_id(&path.into_inner())?;

    let key = utils::set_key_disabled(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        key_id,
        req.into_inner().disabled,
    )
    .await?;

    utils::invalidate_key_cache(&state, &organisation, &application, &key.name).await;

    Ok(Json(SigningKeyResponse::from(key)))
}

#[authz(
    resource = "signing_key",
    action = "update",
    org_roles = ["owner", "admin"],
    app_roles = ["admin"]
)]
#[post("/{key_id}/default")]
async fn set_default_signing_key(
    path: Path<String>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<SigningKeyResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let key_id = utils::validate_key_id(&path.into_inner())?;

    let key = utils::set_default_key(
        state.db_pool.clone(),
        organisation.clone(),
        application.clone(),
        key_id,
    )
    .await?;

    utils::invalidate_key_cache(&state, &organisation, &application, &key.name).await;

    Ok(Json(SigningKeyResponse::from(key)))
}
