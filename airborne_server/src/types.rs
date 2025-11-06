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
    body::BoxBody,
    http::{header::HeaderMap, StatusCode},
    HttpRequest, HttpResponse, Responder,
};
use diesel::result::{DatabaseErrorKind, Error as DieselErr};
use google_sheets4::{hyper_rustls, hyper_util, Sheets};
use http::{HeaderName, HeaderValue};
use keycloak::KeycloakError;
use log::error;
use serde::{Deserialize, Deserializer, Serialize};
use superposition_sdk::Client;
use thiserror::Error;

use crate::{
    organisation::{application::types::OrgAppError, types::OrgError},
    utils::{db, migrations::SuperpositionDefaultConfig},
};

#[derive(Clone)]
pub struct AppState {
    pub env: Environment,
    pub db_pool: db::DbPool,
    pub s3_client: aws_sdk_s3::Client,
    pub cf_client: aws_sdk_cloudfront::Client,
    pub superposition_client: Client,
    pub sheets_hub: Option<
        Sheets<hyper_rustls::HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>>,
    >,
}

#[derive(Clone, Debug)]
pub struct Environment {
    pub public_url: String,
    pub keycloak_url: String,
    pub keycloak_external_url: String,
    pub keycloak_public_key: String,
    pub client_id: String,
    pub secret: String,
    pub realm: String,
    pub bucket_name: String,
    pub superposition_org_id: String,
    pub enable_google_signin: bool,
    pub organisation_creation_disabled: bool,
    pub google_spreadsheet_id: String,
    pub cloudfront_distribution_id: String,
    pub default_configs: Vec<SuperpositionDefaultConfig>,
}
pub trait AppError: std::error::Error + Send + Sync + 'static {
    fn code(&self) -> &'static str;
    fn status_code(&self) -> StatusCode;
    fn message(&self) -> String {
        self.to_string()
    }
}

#[derive(Serialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum ABError {
    #[error(transparent)]
    OrgAppError(#[from] OrgAppError),

    #[error(transparent)]
    OrgError(#[from] OrgError),

    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    InternalServerError(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Forbidden(String),

    #[error("R2D2 error: {0}")]
    R2D2Error(#[from] r2d2::Error),
}

impl From<DieselErr> for ABError {
    fn from(err: DieselErr) -> Self {
        match err {
            DieselErr::NotFound => ABError::NotFound("not found".into()),

            DieselErr::DatabaseError(DatabaseErrorKind::UniqueViolation, info) => {
                error!("Unique violation error: {:?}", info);
                ABError::BadRequest("already exists".into())
            }

            DieselErr::DatabaseError(kind, info) => {
                error!("Database error: kind: {:?}, info: {:?}", kind, info);
                ABError::InternalServerError("service error".into())
            }

            _other => ABError::InternalServerError("service error".into()),
        }
    }
}

impl From<KeycloakError> for ABError {
    fn from(value: KeycloakError) -> Self {
        match value {
            KeycloakError::ReqwestFailure(error) => {
                error!("Keycloak request error: {}", error);
                ABError::InternalServerError("service error".into())
            }
            KeycloakError::HttpFailure { status, body, text } => {
                error!(
                    "Keycloak error: status: {:?}, body: {:?}, text: {:?}",
                    status, body, text
                );
                let message = body.and_then(|b| b.error_message).unwrap_or_default();
                match status {
                    401 => ABError::Unauthorized(message),
                    403 => ABError::Forbidden(message),
                    404 => ABError::NotFound(message),
                    400..=499 => ABError::BadRequest(message),
                    _ => ABError::InternalServerError("service error".into()),
                }
            }
        }
    }
}

impl From<jsonwebtoken::errors::Error> for ABError {
    fn from(value: jsonwebtoken::errors::Error) -> Self {
        match value.into_kind() {
            jsonwebtoken::errors::ErrorKind::InvalidToken => {
                error!("JWT Error: Invalid Token");
                ABError::Unauthorized("Invalid Token".into())
            }
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                error!("JWT Error: Expired Signature");
                ABError::Unauthorized("Token Expired".into())
            }
            jsonwebtoken::errors::ErrorKind::Base64(decode_error) => {
                error!("JWT Error: {:?}", decode_error);
                ABError::InternalServerError("service error".into())
            }
            jsonwebtoken::errors::ErrorKind::Json(error) => {
                error!("JWT Error: {:?}", error);
                ABError::InternalServerError("service error".into())
            }
            jsonwebtoken::errors::ErrorKind::Utf8(error) => {
                error!("JWT Error: {:?}", error);
                ABError::InternalServerError("service error".into())
            }
            jsonwebtoken::errors::ErrorKind::Crypto(unspecified) => {
                error!("JWT Error: {:?}", unspecified);
                ABError::InternalServerError("service error".into())
            }
            kind => {
                error!("JWT Error kind: {:?}", kind);
                ABError::InternalServerError("service error".into())
            }
        }
    }
}

impl AppError for ABError {
    fn code(&self) -> &'static str {
        match self {
            ABError::NotFound(_) => ABErrorCodes::NotFound.label(),
            ABError::InternalServerError(_) => ABErrorCodes::InternalServerError.label(),
            ABError::Unauthorized(_) => ABErrorCodes::Unauthorized.label(),
            ABError::BadRequest(_) => ABErrorCodes::BadRequest.label(),
            ABError::Forbidden(_) => ABErrorCodes::Forbidden.label(),
            ABError::R2D2Error(_) => ABErrorCodes::InternalServerError.label(),
            ABError::OrgAppError(org_app_error) => org_app_error.code(),
            ABError::OrgError(org_error) => org_error.code(),
        }
    }

    fn status_code(&self) -> StatusCode {
        match self {
            ABError::NotFound(_) => StatusCode::NOT_FOUND,
            ABError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ABError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ABError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ABError::Forbidden(_) => StatusCode::FORBIDDEN,
            ABError::R2D2Error(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ABError::OrgAppError(org_app_error) => org_app_error.status_code(),
            ABError::OrgError(org_error) => org_error.status_code(),
        }
    }

    fn message(&self) -> String {
        error!("Airborne Error: {:?}", self);
        self.to_string()
    }
}

#[macro_export]
macro_rules! impl_response_error {
    ( $( $err:ty ),+ $(,)? ) => {
        $(
            impl actix_web::ResponseError for $err {
                fn status_code(&self) -> actix_web::http::StatusCode {
                    $crate::types::AppError::status_code(self)
                }
                fn error_response(&self) -> actix_web::HttpResponse {
                    let body = $crate::types::ErrorBody {
                        code:  self.code().to_string(),
                        message: self.message(),

                    };
                    actix_web::HttpResponse::build($crate::types::AppError::status_code(self)).json(body)
                }
            }
        )+
    };
}

impl_response_error!(ABError);

impl From<std::io::Error> for ABError {
    fn from(err: std::io::Error) -> ABError {
        ABError::InternalServerError(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, ABError>;

pub trait HasLabel {
    fn label(&self) -> &'static str;
}

pub enum ABErrorCodes {
    NotFound,
    InternalServerError,
    Unauthorized,
    BadRequest,
    Forbidden,
}

impl HasLabel for ABErrorCodes {
    fn label(&self) -> &'static str {
        match self {
            ABErrorCodes::NotFound => "AB_001",
            ABErrorCodes::InternalServerError => "AB_003",
            ABErrorCodes::Unauthorized => "AB_004",
            ABErrorCodes::BadRequest => "AB_005",
            ABErrorCodes::Forbidden => "AB_006",
        }
    }
}

/// Example:
/// ```
/// let res: airborne_types::Result<T> = run_blocking!({
///     let mut conn = pool.get()?;
///     my_diesel_query(&mut conn)
/// });
/// ```
#[macro_export]
macro_rules! run_blocking {
    ($body:block) => {{
        actix_web::web::block(move || -> $crate::types::Result<_> { $body })
            .await
            .map_err(|e| {
                $crate::types::ABError::InternalServerError(format!("Blocking error: {e}"))
            })
            .and_then(|inner| inner)
    }};
}

#[derive(Serialize)]
pub struct ListResponse<T> {
    pub data: T,
}

/// Wraps any `Responder` body with extra headers and optional status.
pub struct WithHeaders<T> {
    pub body: T,
    pub headers: HeaderMap,
    pub status: Option<StatusCode>,
}

impl<T> WithHeaders<T> {
    pub fn new(body: T) -> Self {
        Self {
            body,
            headers: HeaderMap::new(),
            status: None,
        }
    }

    pub fn header(mut self, name: HeaderName, value: HeaderValue) -> Self {
        self.headers.insert(name, value);
        self
    }

    pub fn status(mut self, status: StatusCode) -> Self {
        self.status = Some(status);
        self
    }
}

impl<T> Responder for WithHeaders<T>
where
    T: Responder,
{
    type Body = BoxBody;

    fn respond_to(self, req: &HttpRequest) -> HttpResponse<Self::Body> {
        let res = self.body.respond_to(req);

        let mut res = res.map_into_boxed_body();

        if let Some(status) = self.status {
            *res.status_mut() = status;
        }

        let dst = res.headers_mut();
        for (k, v) in self.headers {
            dst.insert(k, v);
        }

        res
    }
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total_items: u64,
    pub total_pages: u32,
}

impl<T> PaginatedResponse<T> {
    pub fn all(data: Vec<T>) -> Self {
        Self {
            total_pages: 1,
            total_items: data.len() as u64,
            data,
        }
    }
}

#[derive(Debug)]
pub enum PaginatedQuery {
    All,
    Paginated { page: u32, count: u32 },
}

impl<'de> Deserialize<'de> for PaginatedQuery {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Helper {
            count: Option<u32>,
            page: Option<u32>,
            all: Option<bool>,
        }

        let helper = Helper::deserialize(deserializer)?;
        if helper.all.unwrap_or_default() && (helper.page.is_some() || helper.count.is_some()) {
            Err(serde::de::Error::custom(
                "'all' cannot be used with 'page' or 'count'".to_string(),
            ))
        } else if helper.all == Some(true) {
            Ok(Self::All)
        } else {
            let page = helper.page.unwrap_or(1);
            let count = helper.count.unwrap_or(10);

            if page < 1 {
                return Err(serde::de::Error::custom("'page' must be at least 1"));
            }
            if count < 1 {
                return Err(serde::de::Error::custom("'count' must be at least 1"));
            }

            Ok(Self::Paginated { page, count })
        }
    }
}
