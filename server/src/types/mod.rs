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

use serde::Serialize;
use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use thiserror::Error;
use superposition_rust_sdk::Client;
use google_sheets4::{hyper_rustls, hyper_util, Sheets};

use crate::utils::db;

#[derive(Clone)]
pub struct AppState {
    pub env: Environment,
    pub db_pool: db::DbPool,
    pub s3_client: aws_sdk_s3::Client,
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
}
pub trait AppError: std::error::Error + Send + Sync + 'static {
    fn code(&self) -> &'static str;
    fn status_code(&self) -> StatusCode;
    fn message(&self) -> String {
        self.to_string()
    }
}

#[derive(Serialize)]
struct ErrorBody {
    code: String,
    error: String,
}

#[derive(Debug, Error)]
pub enum ABError {
    #[error("{0}")]
    NotFound(String),

    #[error("Database error")]
    DbError,

    #[error("{0}")]
    InternalServerError(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Forbidden(String),
}

// impl ABError {
//     fn code(&self) -> &'static str {
//         match self {
//             ABError::NotFound(_) => "USER_NOT_FOUND",
//             ABError::DbError         => "DB_ERROR",
//             ABError::InternalServerError(_) => "INTERNAL_SERVER_ERROR",
//             ABError::Unauthorized(_) => "UNAUTHORIZED",
//             ABError::BadRequest(_) => "BAD_REQUEST",
//             ABError::Forbidden(_) => "FORBIDDEN",
//         }
//     }
// }

impl AppError for ABError {
    fn code(&self) -> &'static str {
        match self {
            ABError::NotFound(_) => "USER_NOT_FOUND",
            ABError::DbError         => "DB_ERROR",
            ABError::InternalServerError(_) => "INTERNAL_SERVER_ERROR",
            ABError::Unauthorized(_) => "UNAUTHORIZED",
            ABError::BadRequest(_) => "BAD_REQUEST",
            ABError::Forbidden(_) => "FORBIDDEN",
        }
    }

    fn status_code(&self) -> StatusCode {
        match *self {
            ABError::NotFound(_) => StatusCode::NOT_FOUND,
            ABError::DbError         => StatusCode::INTERNAL_SERVER_ERROR,
            ABError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ABError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ABError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ABError::Forbidden(_) => StatusCode::FORBIDDEN,
        }
    }
}

// impl ResponseError for ABError {
//     fn status_code(&self) -> StatusCode {
//         match *self {
//             ABError::NotFound(_) => StatusCode::NOT_FOUND,
//             ABError::DbError         => StatusCode::INTERNAL_SERVER_ERROR,
//             ABError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
//             ABError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
//             ABError::BadRequest(_) => StatusCode::BAD_REQUEST,
//             ABError::Forbidden(_) => StatusCode::FORBIDDEN,
//         }
//     }

//     fn error_response(&self) -> HttpResponse {
//         let body = ErrorBody {
//             code: self.code().to_string(),
//             error: self.to_string(),
//         };
//         HttpResponse::build(self.status_code()).json(body)
//     }
// }

impl ResponseError for ABError {
    fn status_code(&self) -> StatusCode {
        AppError::status_code(self)
    }

    fn error_response(&self) -> HttpResponse {
        let body = ErrorBody {
            code:  self.code().to_string(),
            error: self.message(),
        };
        HttpResponse::build(AppError::status_code(self)).json(body)
    }
}