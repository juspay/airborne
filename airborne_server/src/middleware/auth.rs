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

use crate::types::AppState;
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    web::Data,
    Error, HttpMessage,
};
use futures::future::LocalBoxFuture;

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
    pub sub: String, // Canonical AuthZ subject (email)
    #[allow(dead_code)]
    pub authn_sub: String,
    #[allow(dead_code)]
    pub authn_iss: Option<String>,
    #[allow(dead_code)]
    pub authn_email: Option<String>,
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

pub fn require_scope_name(access_level: Option<AccessLevel>, scope: &str) -> ABResult<String> {
    access_level
        .map(|value| value.name)
        .ok_or_else(|| ABError::Forbidden(format!("No {} access", scope)))
}

pub fn require_org_and_app(
    organisation: Option<AccessLevel>,
    application: Option<AccessLevel>,
) -> ABResult<(String, String)> {
    let organisation = require_scope_name(organisation, "organisation")?;
    let application = require_scope_name(application, "application")?;
    Ok((organisation, application))
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
            let app_state = match req.app_data::<Data<AppState>>() {
                Some(val) => val.clone(),
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
            match auth {
                Some(access_token) => {
                    let token_data = app_state
                        .authn_provider
                        .verify_access_token(app_state.get_ref(), access_token)
                        .await?;

                    let authz_subject = app_state
                        .authz_provider
                        .subject_from_claims(&token_data.claims)?;
                    let access_context = app_state
                        .authz_provider
                        .access_for_request(app_state.get_ref(), &authz_subject, org, app)
                        .await?;

                    if org.is_some() && access_context.organisation.is_none() {
                        return Err(
                            ABError::Forbidden("No Access to Organisation".to_string()).into()
                        );
                    }
                    if app.is_some() && access_context.application.is_none() {
                        return Err(
                            ABError::Forbidden("No Access to Application".to_string()).into()
                        );
                    }

                    req.extensions_mut().insert(AuthResponse {
                        sub: authz_subject,
                        authn_sub: token_data.claims.sub.clone(),
                        authn_iss: token_data.claims.iss.clone(),
                        authn_email: token_data.claims.email.clone(),
                        organisation: access_context.organisation,
                        application: access_context.application,
                        is_super_admin: access_context.is_super_admin,
                        username: app_state
                            .authz_provider
                            .display_name_from_claims(&token_data.claims),
                    });
                    service.call(req).await
                }
                None => Err(ABError::Unauthorized("No Authorization token".to_string()).into()),
            }
        })
    }
}

impl AccessLevel {
    pub fn is_admin_or_higher(&self) -> bool {
        self.level >= ADMIN.access
    }
}
