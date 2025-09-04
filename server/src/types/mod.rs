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

use actix_web::{http::StatusCode};
use thiserror::Error;
use serde::{Deserialize, Serialize};
use superposition_sdk::Client;
use google_sheets4::{hyper_rustls, hyper_util, Sheets};

use crate::utils::db;

#[derive(Clone)]
pub struct AppState {
    pub env: Environment,
    pub db_pool: db::DbPool,
    pub s3_client: aws_sdk_s3::Client,
    pub cf_client: aws_sdk_cloudfront::Client,
    pub superposition_client: Client,
    pub sheets_hub: Option<Sheets<hyper_rustls::HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>>>
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
    pub error: String,
}

#[derive(Debug, Error)]
pub enum ABError {
    #[error("{0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    DbError(String),

    #[error("{0}")]
    InternalServerError(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Forbidden(String),
}

impl AppError for ABError {
    fn code(&self) -> &'static str {
        match self {
            ABError::NotFound(_) => ABErrorCodes::NotFound.label(),
            ABError::DbError(_)         => ABErrorCodes::DbError.label(),
            ABError::InternalServerError(_) => ABErrorCodes::InternalServerError.label(),
            ABError::Unauthorized(_) => ABErrorCodes::Unauthorized.label(),
            ABError::BadRequest(_) => ABErrorCodes::BadRequest.label(),
            ABError::Forbidden(_) => ABErrorCodes::Forbidden.label(),
        }
    }

    fn status_code(&self) -> StatusCode {
        match *self {
            ABError::NotFound(_) => StatusCode::NOT_FOUND,
            ABError::DbError(_)         => StatusCode::INTERNAL_SERVER_ERROR,
            ABError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ABError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ABError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ABError::Forbidden(_) => StatusCode::FORBIDDEN,
        }
    }
}

#[macro_export]
macro_rules! impl_response_error {
    ( $( $err:ty ),+ $(,)? ) => {
        $(
            use actix_web::{http::StatusCode as SC, HttpResponse as HR};
            use actix_web::ResponseError as RE;
            use crate::types::{AppError as AE, ErrorBody as EB};
            impl RE for $err {
                fn status_code(&self) -> SC {
                    AE::status_code(self)
                }
                fn error_response(&self) -> HR {
                    let body = EB {
                        code:  self.code().to_string(),
                        error: self.message(),
                    };
                    HR::build(AE::status_code(self)).json(body)
                }
            }
        )+
    };
}

impl_response_error!(ABError);

pub trait HasLabel {
    fn label(&self) -> &'static str;
}

pub enum ABErrorCodes {
    NotFound,
    DbError,
    InternalServerError,
    Unauthorized,
    BadRequest,
    Forbidden,
}

impl HasLabel for ABErrorCodes {
    fn label(&self) -> &'static str {
        match self {
            ABErrorCodes::NotFound => "AB_001",
            ABErrorCodes::DbError => "AB_002",
            ABErrorCodes::InternalServerError => "AB_003",
            ABErrorCodes::Unauthorized => "AB_004",
            ABErrorCodes::BadRequest => "AB_005",
            ABErrorCodes::Forbidden => "AB_006",
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct Resource {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub url: String,
}

#[derive(Serialize, Debug)]
pub struct ReleaseConfig {
    pub version: String,
    pub config: Config,
    pub package: Package,
    pub resources: Vec<Resource>,
}

#[derive(Serialize, Debug)]
pub struct Config {
    pub version: String,
    pub release_config_timeout: u32,
    pub boot_timeout: u32,
    pub properties: ConfigProperties,
}

#[derive(Serialize, Debug)]
pub struct ConfigProperties {
    pub tenant_info: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Package {
    pub name: String,
    pub version: String,
    pub properties: serde_json::Value,
    pub index: Resource,
    pub important: Vec<Resource>,
    pub lazy: Vec<Resource>,
}