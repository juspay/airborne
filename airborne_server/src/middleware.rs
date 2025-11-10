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

pub mod auth;
pub mod request;
use crate::types::ABError;
use actix_web::{
    error::JsonPayloadError, error::PathError, error::QueryPayloadError, Error, HttpRequest,
};

pub fn json_error_handler(err: JsonPayloadError, _req: &HttpRequest) -> Error {
    Error::from(ABError::BadRequest(err.to_string()))
}

pub fn path_error_handler(err: PathError, _req: &HttpRequest) -> Error {
    Error::from(ABError::BadRequest(err.to_string()))
}

pub fn query_error_handler(err: QueryPayloadError, _req: &HttpRequest) -> Error {
    Error::from(ABError::BadRequest(err.to_string()))
}
