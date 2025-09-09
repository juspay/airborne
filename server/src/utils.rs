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

use crate::types::ABError;
use actix_web::{error::JsonPayloadError, Error, HttpRequest};

pub mod db;
pub mod document;
pub mod keycloak;
pub mod kms;
pub mod s3;
pub mod transaction_manager;
pub mod workspace;

pub fn json_error_handler(err: JsonPayloadError, _req: &HttpRequest) -> Error {
    let message = match &err {
        JsonPayloadError::ContentType => "Unsupported Content Type",
        JsonPayloadError::Overflow { limit: _ } | JsonPayloadError::OverflowKnownLength { .. } => {
            "Payload Too Large"
        }
        JsonPayloadError::Deserialize(_) => "Bad Input",
        _ => "Bad Request",
    };

    println!("JSON error: {}", err);

    Error::from(ABError::BadRequest(message.to_string()))
}
