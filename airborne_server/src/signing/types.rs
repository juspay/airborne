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

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::utils::db::models::SigningKeyEntry;

/// API view of a signing key.
///
/// There is deliberately no private-key field here. `SigningKeyEntry` does not
/// derive `Serialize`, so this type is the only way a key reaches a response —
/// which makes leaking the private key a compile error rather than an oversight.
#[derive(Serialize)]
pub struct SigningKeyResponse {
    pub key_id: String,
    pub algorithm: String,
    pub public_key: String,
    pub is_default: bool,
    pub disabled: bool,
    pub created_at: DateTime<Utc>,
}

impl From<SigningKeyEntry> for SigningKeyResponse {
    fn from(entry: SigningKeyEntry) -> Self {
        Self {
            key_id: entry.name,
            algorithm: entry.algorithm,
            public_key: entry.public_key,
            is_default: entry.is_default,
            disabled: entry.disabled,
            created_at: entry.created_at,
        }
    }
}

#[derive(Deserialize)]
pub struct CreateSigningKeyRequest {
    pub key_id: String,
}

#[derive(Deserialize)]
pub struct UpdateSigningKeyRequest {
    pub disabled: bool,
}
