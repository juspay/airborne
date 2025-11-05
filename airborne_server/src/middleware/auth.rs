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

use std::{
    future::{ready, Ready},
    rc::Rc,
};

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    web::Data,
    Error, HttpMessage,
};
use futures::future::LocalBoxFuture;
use keycloak::{KeycloakAdmin, KeycloakAdminToken};
use reqwest::Client;

use crate::{
    types::AppState,
    utils::keycloak::{decode_jwt_token, get_token},
};

use crate::types::{ABError, Result as ABResult};

// There are two steps in middleware processing.
// 1. Middleware initialization, middleware factory gets called with
//    next service in chain as parameter.
// 2. Middleware's call method gets called with normal request.
pub struct Auth;

// Middleware factory is `Transform` trait
// `S` - type of the next service
// `B` - type of response's body
impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware {
            service: Rc::new(service),
        }))
    }
}

pub struct AuthMiddleware<S> {
    service: Rc<S>,
}

#[derive(Clone, Debug)]
pub struct AccessLevel {
    pub name: String,
    pub level: u8,
}

#[derive(Clone, Debug)]
pub struct AuthResponse {
    pub sub: String,
    pub admin_token: KeycloakAdminToken, // This is holding token and not admin since admin deos not have clone
    pub organisation: Option<AccessLevel>,
    pub application: Option<AccessLevel>,
    pub is_super_admin: bool,
    pub username: String,
}

#[derive(Copy, Clone)]
pub struct Access {
    pub access: u8,
}

pub const OWNER: Access = Access { access: 4 };
pub const ADMIN: Access = Access { access: 3 };
pub const WRITE: Access = Access { access: 2 };
pub const READ: Access = Access { access: 1 };
pub const ROLES: [&str; 4] = ["owner", "admin", "write", "read"];

pub fn validate_user(access_level: Option<AccessLevel>, access: Access) -> ABResult<String> {
    if let Some(access_level) = access_level {
        if access_level.level >= access.access {
            Ok(access_level.name)
        } else {
            Err(ABError::Unauthorized("Access Level too low".to_string()))
        }
    } else {
        Err(ABError::Unauthorized("Missing header".to_string()))
    }
}

fn get_access_level(user_groups: &[String], path: &str) -> Option<usize> {
    static ACCESS_LIST: [&str; 4] = ["owner", "admin", "write", "read"];
    ACCESS_LIST.iter().enumerate().find_map(|(i, role)| {
        let full_path = format!("/{}/{}", path, role); // match format of a
        if user_groups.contains(&full_path) {
            Some(ACCESS_LIST.len() - i)
        } else {
            None
        }
    })
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        Box::pin(async move {
            let env = match req.app_data::<Data<AppState>>() {
                Some(val) => val.env.clone(),
                None => {
                    log::error!("app state not set");
                    Err(ABError::InternalServerError("Env not found".to_string()))?
                }
            };
            let header_value = req.headers().clone();
            let auth_header = header_value.get("Authorization");
            if auth_header.is_none() {
                return Err(ABError::Unauthorized("No Authorization Header".to_string()).into());
            }
            let org_header = header_value.get("x-organisation");
            let app_header = header_value.get("x-application");
            let auth = auth_header
                .and_then(|auth_header| auth_header.to_str().ok())
                .and_then(|auth_str| auth_str.strip_prefix("Bearer "));
            let org = org_header.and_then(|org_header| org_header.to_str().ok());
            let app = app_header.and_then(|app_header| app_header.to_str().ok());
            let token = get_token(env.clone(), Client::new()).await;
            match token {
                Ok(token) => match auth {
                    Some(auth) => {
                        let token_data = decode_jwt_token(
                            auth,
                            &env.keycloak_public_key.clone(),
                            &env.client_id.clone(),
                        );
                        match token_data {
                            Ok(token_data) => {
                                let mut organisation = None;
                                let mut application = None;

                                // Fetch user groups from Keycloak
                                let client = reqwest::Client::new();
                                let admin = KeycloakAdmin::new(
                                    &env.keycloak_url.clone(),
                                    token.clone(),
                                    client,
                                );
                                let user_groups: Vec<keycloak::types::GroupRepresentation> = admin
                                    .realm_users_with_user_id_groups_get(
                                        &env.realm.clone(),
                                        &token_data.claims.sub,
                                        None,
                                        None,
                                        None,
                                        None,
                                    )
                                    .await
                                    .map_err(|e| ABError::Unauthorized(e.to_string()))?;

                                let user_groups: Vec<String> = user_groups
                                    .iter()
                                    .filter_map(|group| group.path.clone())
                                    .collect();

                                // Check super admin status
                                let is_super_admin =
                                    user_groups.contains(&"/super_admin".to_string());

                                // Check organization and application access if org header is present
                                if let Some(org) = org {
                                    if let Some(app) = app {
                                        let access = get_access_level(
                                            &user_groups,
                                            &format!("{}/{}", org, app),
                                        );
                                        match access {
                                            Some(level) => {
                                                application = Some(AccessLevel {
                                                    name: app.to_string(),
                                                    level: level as u8,
                                                });
                                            }
                                            None => {
                                                return Err(ABError::Forbidden(
                                                    "No Access to Application".to_string(),
                                                )
                                                .into())
                                            }
                                        };
                                    }
                                    let access = get_access_level(&user_groups, org);
                                    match access {
                                        Some(level) => {
                                            organisation = Some(AccessLevel {
                                                name: org.to_string(),
                                                level: level as u8,
                                            });
                                        }
                                        None => {
                                            return Err(ABError::Forbidden(
                                                "No Access to Organisation".to_string(),
                                            )
                                            .into());
                                        }
                                    };
                                }

                                req.extensions_mut().insert(AuthResponse {
                                    sub: token_data.claims.sub,
                                    admin_token: token,
                                    organisation,
                                    application,
                                    is_super_admin,
                                    username: token_data
                                        .claims
                                        .preferred_username
                                        .clone()
                                        .ok_or_else(|| {
                                            ABError::Unauthorized(
                                                "No username in token".to_string(),
                                            )
                                        })?,
                                });
                                service.call(req).await
                            }
                            Err(e) => Err(e.into()),
                        }
                    }
                    None => Err(ABError::Unauthorized("No AdminToken".to_string()).into()),
                },
                Err(e) => Err(ABError::Unauthorized(format!("{:?}", e)).into()),
            }
        })
    }
}

impl AccessLevel {
    pub fn is_admin_or_higher(&self) -> bool {
        self.level >= ADMIN.access
    }
}

pub async fn validate_required_access(
    auth: &AuthResponse,
    required_level: u8,
    operation: &str,
) -> ABResult<()> {
    if let Some(access) = &auth.organisation {
        if access.level >= required_level {
            Ok(())
        } else {
            Err(ABError::Forbidden(format!(
                "Insufficient permissions for {}",
                operation
            )))
        }
    } else {
        Err(ABError::Forbidden("No organisation access".to_string()))
    }
}
