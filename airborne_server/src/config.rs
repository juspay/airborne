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

use crate::utils::kms::{decrypt_env, decrypt_master_key};
use aws_sdk_kms::Client;
use std::env;
use std::str::FromStr;

#[derive(Debug, Clone)]
pub struct AppConfig {
    // Server settings
    pub port: u16,
    pub keep_alive: u64,
    pub backlog: u32,
    pub num_workers: usize,
    pub server_path_prefix: String,

    // Database settings
    pub db_user: String,
    pub db_password: String,
    pub db_migration_user: String,
    pub db_migration_password: String,
    pub db_host: String,
    pub db_port: String,
    pub db_name: String,
    pub db_url: Option<String>,
    pub db_migration_url: Option<String>,
    pub database_pool_size: u32,

    // AWS settings
    pub aws_bucket: String,
    pub aws_endpoint_url: Option<String>,

    // Keycloak settings
    pub keycloak_url: String,
    pub keycloak_external_url: String,
    pub keycloak_realm: String,
    pub keycloak_client_id: String,
    pub keycloak_secret: String,
    pub keycloak_public_key: String,

    // Superposition settings
    pub superposition_url: String,
    pub superposition_org_id: String,
    pub superposition_token: Option<String>,
    pub superposition_user_token: Option<String>,
    pub superposition_org_token: Option<String>,
    pub enable_authenticated_superposition: bool,

    // Feature flags
    pub enable_google_signin: bool,
    pub organisation_creation_disabled: bool,

    // Google Sheets
    pub google_spreadsheet_id: Option<String>,
    pub gcp_service_account_path: Option<String>,
    pub google_service_account_key: Option<String>,

    // CloudFront
    pub cloudfront_distribution_id: String,

    // Public endpoint
    pub public_endpoint: String,

    // Migration settings
    pub superposition_migration_strategy: String,
    pub migrations_to_run_on_boot: String,
}

impl AppConfig {
    pub async fn build(kms_client: &Client) -> Result<Self, String> {
        fn parse_env<T: FromStr>(name: &str, default: T) -> T {
            env::var(name)
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(default)
        }

        let use_encrypted_secrets: bool = parse_env("USE_ENCRYPTED_SECRETS", true);

        let master_key = if use_encrypted_secrets {
            let enc_master_key = env::var("MASTER_KEY")
                .map_err(|_| "MASTER_KEY must be set when USE_ENCRYPTED_SECRETS=true")?;
            Some(decrypt_master_key(kms_client, &enc_master_key).await?)
        } else {
            None
        };

        let get_env = |name: &str, default: Option<&str>| -> Result<String, String> {
            match env::var(name) {
                Ok(v) if !v.is_empty() => Ok(v),
                _ => match default {
                    Some(d) => Ok(d.to_string()),
                    None => Err(format!("{} must be set", name)),
                },
            }
        };

        let get_secret = |name: &str| -> Result<String, String> {
            let value = env::var(name).map_err(|_| format!("{} must be set", name))?;

            if use_encrypted_secrets {
                let key = master_key.as_ref().ok_or("Master key not available")?;
                decrypt_env(key, &value)
            } else {
                Ok(value)
            }
        };

        let get_optional_secret = |name: &str| -> Result<Option<String>, String> {
            match env::var(name) {
                Ok(v) if !v.is_empty() => {
                    if use_encrypted_secrets {
                        let key = master_key.as_ref().ok_or("Master key not available")?;
                        Ok(Some(decrypt_env(key, &v)?))
                    } else {
                        Ok(Some(v))
                    }
                }
                _ => Ok(None),
            }
        };

        let get_optional =
            |name: &str| -> Option<String> { env::var(name).ok().filter(|v| !v.is_empty()) };

        Ok(AppConfig {
            // Server settings
            port: parse_env("PORT", 8081),
            keep_alive: parse_env("KEEP_ALIVE", 30),
            backlog: parse_env("BACKLOG", 1024),
            num_workers: parse_env("ACTIX_WORKERS", 4),
            server_path_prefix: get_env("SERVER_PATH_PREFIX", Some("api"))?,

            // Database settings
            db_user: get_env("DB_USER", None)?,
            db_password: get_secret("DB_PASSWORD")?,
            db_migration_user: get_env("DB_MIGRATION_USER", None)?,
            db_migration_password: get_secret("DB_MIGRATION_PASSWORD")?,
            db_host: get_env("DB_HOST", None)?,
            db_port: get_env("DB_PORT", None)?,
            db_name: get_env("DB_NAME", None)?,
            db_url: get_optional("DB_URL"),
            db_migration_url: get_optional("DB_MIGRATION_URL"),
            database_pool_size: parse_env("DATABASE_POOL_SIZE", 4),

            // AWS settings
            aws_bucket: get_env("AWS_BUCKET", None)?,
            aws_endpoint_url: get_optional("AWS_ENDPOINT_URL"),

            // Keycloak settings
            keycloak_url: get_env("KEYCLOAK_URL", None)?,
            keycloak_external_url: get_env("KEYCLOAK_EXTERNAL_URL", Some("localhost:8180"))?,
            keycloak_realm: get_env("KEYCLOAK_REALM", None)?,
            keycloak_client_id: get_env("KEYCLOAK_CLIENT_ID", None)?,
            keycloak_secret: get_secret("KEYCLOAK_SECRET")?,
            keycloak_public_key: get_env("KEYCLOAK_PUBLIC_KEY", None)?,

            // Superposition settings
            superposition_url: get_env("SUPERPOSITION_URL", None)?,
            superposition_org_id: get_env("SUPERPOSITION_ORG_ID", None)?,
            superposition_token: get_optional_secret("SUPERPOSITION_TOKEN")?,
            superposition_user_token: get_optional_secret("SUPERPOSITION_USER_TOKEN")?,
            superposition_org_token: get_optional_secret("SUPERPOSITION_ORG_TOKEN")?,
            enable_authenticated_superposition: parse_env(
                "ENABLE_AUTHENTICATED_SUPERPOSITION",
                false,
            ),

            // Feature flags
            enable_google_signin: parse_env("ENABLE_GOOGLE_SIGNIN", false),
            organisation_creation_disabled: parse_env("ORGANISATION_CREATION_DISABLED", false),

            // Google Sheets
            google_spreadsheet_id: get_optional("GOOGLE_SPREADSHEET_ID"),
            gcp_service_account_path: get_optional("GCP_SERVICE_ACCOUNT_PATH"),
            google_service_account_key: get_optional_secret("GOOGLE_SERVICE_ACCOUNT_KEY")?,

            // CloudFront
            cloudfront_distribution_id: get_env("CLOUDFRONT_DISTRIBUTION_ID", Some(""))?,

            // Public endpoint
            public_endpoint: get_env("PUBLIC_ENDPOINT", None)?,

            // Migration settings
            superposition_migration_strategy: get_env(
                "SUPERPOSITION_MIGRATION_STRATEGY",
                Some("PATCH"),
            )?,
            migrations_to_run_on_boot: get_env("MIGRATIONS_TO_RUN_ON_BOOT", Some(""))?,
        })
    }
}
