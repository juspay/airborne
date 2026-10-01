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

use actix_web::{HttpMessage, HttpRequest};

use crate::{
    middleware::auth::{require_scope_name, AuthResponse},
    types as airborne_types,
    types::ABError,
    utils::encryption::generate_random_key,
};

use super::{MAX_SERVICE_ACCOUNT_NAME_LENGTH, SERVICE_ACCOUNT_EMAIL_DOMAIN};

/// Mask an email/subject for logging
pub fn mask_email(value: &str) -> String {
    let prefix: String = value.chars().take(3).collect();
    format!("{}***", prefix)
}

pub fn validate_service_account_name(name: &str) -> airborne_types::Result<String> {
    let trimmed = name.trim().to_ascii_lowercase();

    if trimmed.is_empty() {
        return Err(ABError::BadRequest(
            "Service account name cannot be empty".to_string(),
        ));
    }

    if trimmed.len() > MAX_SERVICE_ACCOUNT_NAME_LENGTH {
        return Err(ABError::BadRequest(
            "Service account name is too long".to_string(),
        ));
    }

    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(ABError::BadRequest(
            "Service account name can only contain alphanumeric characters, hyphens, and underscores"
                .to_string(),
        ));
    }

    Ok(trimmed)
}

pub fn build_service_account_email(name: &str, organisation: &str) -> String {
    let org_sanitized = organisation.trim().to_ascii_lowercase().replace(' ', "-");
    format!(
        "{}.{}@{}",
        name, org_sanitized, SERVICE_ACCOUNT_EMAIL_DOMAIN
    )
}

pub async fn generate_random_password() -> airborne_types::Result<String> {
    generate_random_key().await
}

pub async fn get_org_context(req: &HttpRequest) -> airborne_types::Result<(String, AuthResponse)> {
    let auth = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or_else(|| ABError::Unauthorized("Missing auth context".to_string()))?;

    let org_name = require_scope_name(auth.organisation.clone(), "organisation")?;
    Ok((org_name, auth))
}
