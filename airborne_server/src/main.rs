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

#![deny(unused_crate_dependencies)]
use airborne_authz_macros as _;

mod authz;
mod build;
mod config;
mod dashboard;
mod docs;
mod file;
mod middleware;
mod organisation;
mod package;
mod provider;
mod release;
mod service_account;
mod token;
mod types;
mod user;
mod utils;

use actix_web::{
    web::{self, PathConfig, QueryConfig},
    App, HttpResponse, HttpServer,
};
use aws_sdk_s3::config::Builder;
use config::AppConfig;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use dotenv::dotenv;
use google_sheets4::{
    hyper_rustls, hyper_util,
    yup_oauth2::{self, ServiceAccountAuthenticator},
    Sheets,
};
use log::info;
use serde_json::json;
use std::{
    hash::{DefaultHasher, Hash, Hasher},
    str::FromStr,
    sync::Arc,
};
use superposition_sdk::config::Config as SrsConfig;
use tracing_actix_web::TracingLogger;
use utils::db;

use crate::{
    dashboard::configuration,
    middleware::{
        auth::Auth,
        request::{req_id_header_mw, WithRequestId},
    },
    provider::{
        authn::build_authn_provider,
        authz::{
            build_authz_provider,
            migration::{import_keycloak_authz_to_casbin, parse_keycloak_admin_issuer},
        },
    },
    utils::{
        interceptor::CookieIntercept,
        migrations::{
            get_default_configs_from_file, migrate_superposition, SuperpositionMigrationStrategy,
        },
    },
};

const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

pub fn calculate_bucket_index(identifier: &str, group_id: &i64) -> usize {
    let mut hasher = DefaultHasher::new();
    (identifier, group_id).hash(&mut hasher);
    (hasher.finish() % 100) as usize
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StartupCommand {
    Serve,
    ImportKeycloakAuthz { apply: bool },
}

fn parse_startup_command() -> Result<StartupCommand, String> {
    let mut args = std::env::args().skip(1);
    let Some(command) = args.next() else {
        return Ok(StartupCommand::Serve);
    };

    if command != "authz-import-keycloak" {
        return Ok(StartupCommand::Serve);
    }

    let mut apply = false;
    let mut dry_run = false;
    for arg in args {
        match arg.as_str() {
            "--apply" => apply = true,
            "--dry-run" => dry_run = true,
            unknown => {
                return Err(format!(
                    "Unknown argument '{}'. Supported flags: --dry-run, --apply",
                    unknown
                ));
            }
        }
    }

    if apply && dry_run {
        return Err("Use either --apply or --dry-run, not both".to_string());
    }

    Ok(StartupCommand::ImportKeycloakAuthz { apply })
}

fn trim_trailing_slash(value: &str) -> String {
    value.trim_end_matches('/').to_string()
}

fn normalize_external_base_url(value: &str) -> String {
    let trimmed = trim_trailing_slash(value);
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed
    } else {
        format!("http://{trimmed}")
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_default();
    utils::init_tracing(log_format);

    dotenv().ok();
    let startup_command = parse_startup_command().expect(
        "Invalid startup command. Use 'authz-import-keycloak [--dry-run|--apply]' or run without arguments",
    );

    let shared_config = aws_config::from_env().load().await;
    let aws_kms_client = aws_sdk_kms::Client::new(&shared_config);

    let app_config = AppConfig::build(&aws_kms_client)
        .await
        .expect("Failed to build AppConfig");

    let migrations_to_run_on_boot: Vec<String> = app_config
        .migrations_to_run_on_boot
        .split(',')
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let superposition_migration_strategy =
        SuperpositionMigrationStrategy::from(app_config.superposition_migration_strategy.clone());

    let force_path_style = app_config.aws_endpoint_url.is_some();

    let aws_cloudfront_client = aws_sdk_cloudfront::Client::new(&shared_config);

    let should_run_db_migrations = migrations_to_run_on_boot.iter().any(|m| m == "db");
    let should_run_keycloak_to_casbin = migrations_to_run_on_boot
        .iter()
        .any(|m| m == "keycloaktocasbin");

    if should_run_db_migrations || should_run_keycloak_to_casbin {
        info!("Running pending database migrations");
        let mut conn = db::establish_connection(&app_config).await;
        conn.run_pending_migrations(MIGRATIONS)
            .expect("Failed to run pending migrations");
    }

    let organisation_creation_disabled = app_config.organisation_creation_disabled;

    let spreadsheet_id = if organisation_creation_disabled {
        Some(
            app_config
                .google_spreadsheet_id
                .clone()
                .expect("GOOGLE_SPREADSHEET_ID must be set if ORGANISATION_CREATION_DISABLED=true"),
        )
    } else {
        None
    };

    let server_path_prefix = app_config.server_path_prefix.clone();

    let gsa_creds: Option<yup_oauth2::ServiceAccountKey> = if organisation_creation_disabled {
        let creds_from_path = app_config
            .gcp_service_account_path
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .and_then(|content| serde_json::from_str(&content).ok());

        let creds_from_env = app_config
            .google_service_account_key
            .as_ref()
            .and_then(|json_str| serde_json::from_str(json_str).ok());

        creds_from_path.or(creds_from_env)
    } else {
        None
    };

    // Initialize DB pool
    info!("Creating db pool");
    let pool = db::establish_pool(&app_config).await;

    if let StartupCommand::ImportKeycloakAuthz { apply } = startup_command {
        info!("Running Keycloak -> Casbin import (apply={})", apply);
        let mut conn = db::establish_connection(&app_config).await;
        conn.run_pending_migrations(MIGRATIONS)
            .expect("Failed to run pending migrations before import");
        import_keycloak_authz_to_casbin(&app_config, pool.clone(), apply)
            .await
            .expect("Failed to complete Keycloak -> Casbin import");
        return Ok(());
    }

    if should_run_keycloak_to_casbin {
        info!("Running Keycloak -> Casbin import from MIGRATIONS_TO_RUN_ON_BOOT");
        import_keycloak_authz_to_casbin(&app_config, pool.clone(), true)
            .await
            .expect("Failed to complete Keycloak -> Casbin import");
    }

    let superposition_token = app_config.superposition_token.clone().unwrap_or_default();

    let cac_url = app_config.superposition_url.clone();
    let superposition_org_id_env = app_config.superposition_org_id.clone();

    let authn_provider_kind = types::AuthnProviderKind::from_str(&app_config.authn_provider)
        .expect("AUTHN_PROVIDER must be one of: keycloak, oidc, okta, auth0");
    let authz_provider_kind = types::AuthzProviderKind::from_str(&app_config.authz_provider)
        .expect("AUTHZ_PROVIDER must be one of: casbin");
    let issuer = app_config
        .oidc_issuer_url
        .clone()
        .expect("OIDC_ISSUER_URL must be set");
    let external_issuer = app_config
        .oidc_external_issuer_url
        .clone()
        .unwrap_or_else(|| issuer.clone());
    let authn_issuer_url = trim_trailing_slash(&issuer);
    let authn_external_issuer_url = normalize_external_base_url(&external_issuer);
    let authn_client_id = app_config
        .oidc_client_id
        .clone()
        .expect("OIDC_CLIENT_ID must be set");
    let authn_client_secret = app_config
        .oidc_client_secret
        .clone()
        .expect("OIDC_CLIENT_SECRET must be set");
    let authn_clock_skew_secs = app_config.oidc_clock_skew_secs;
    let authz_bootstrap_super_admins = app_config
        .authz_bootstrap_super_admins
        .clone()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .collect::<Vec<_>>();
    let authz_casbin_auto_load_secs = app_config.authz_casbin_auto_load_secs;
    let auth_admin_client_id = app_config.auth_admin_client_id.clone().unwrap_or_default();
    let auth_admin_client_secret = app_config
        .auth_admin_client_secret
        .clone()
        .unwrap_or_default();
    let auth_admin_token_url = app_config.auth_admin_token_url.clone().unwrap_or_default();
    let auth_admin_audience = app_config.auth_admin_audience.clone();
    let auth_admin_scopes = app_config.auth_admin_scopes.clone();
    let (keycloak_url, realm) = app_config
        .auth_admin_issuer
        .as_deref()
        .map(parse_keycloak_admin_issuer)
        .transpose()
        .expect("Invalid AUTH_ADMIN_ISSUER format")
        .unwrap_or_else(|| ("".to_string(), "".to_string()));

    if authn_provider_kind == types::AuthnProviderKind::Keycloak {
        if auth_admin_client_id.trim().is_empty() {
            panic!("AUTH_ADMIN_CLIENT_ID must be set when AUTHN_PROVIDER=keycloak");
        }
        if auth_admin_client_secret.trim().is_empty() {
            panic!("AUTH_ADMIN_CLIENT_SECRET must be set when AUTHN_PROVIDER=keycloak");
        }
        if auth_admin_token_url.trim().is_empty() {
            panic!("AUTH_ADMIN_TOKEN_URL must be set when AUTHN_PROVIDER=keycloak");
        }
        if keycloak_url.trim().is_empty() || realm.trim().is_empty() {
            panic!("AUTH_ADMIN_ISSUER must be set when AUTHN_PROVIDER=keycloak");
        }
    }

    let env = types::Environment {
        public_url: app_config.public_endpoint.clone(),
        authn_issuer_url,
        authn_external_issuer_url,
        authn_client_id: authn_client_id.clone(),
        authn_client_secret: authn_client_secret.clone(),
        authn_clock_skew_secs,
        auth_admin_client_id,
        auth_admin_client_secret,
        auth_admin_token_url,
        auth_admin_audience,
        auth_admin_scopes,
        keycloak_url,
        realm,
        bucket_name: app_config.aws_bucket.clone(),
        superposition_org_id: app_config.superposition_org_id.clone(),
        enabled_oidc_idps: app_config.enabled_oidc_idps.clone(),
        organisation_creation_disabled: app_config.organisation_creation_disabled,
        google_spreadsheet_id: spreadsheet_id.clone().unwrap_or_default(),
        cloudfront_distribution_id: app_config.cloudfront_distribution_id.clone(),
        default_configs: get_default_configs_from_file()
            .await
            .expect("Failed to load superposition default configs from file"),
    };

    // Create an S3 client with path-style enforced (for localstack)
    let s3_config = Builder::from(&shared_config)
        .force_path_style(force_path_style)
        .build();

    let aws_s3_client = aws_sdk_s3::Client::from_conf(s3_config);

    // Configure Google Sheets
    let mut hub = None;
    if organisation_creation_disabled {
        rustls::crypto::ring::default_provider()
            .install_default()
            .expect("Failed to install rustls crypto provider");

        let gcp_auth = ServiceAccountAuthenticator::builder(gsa_creds.expect("You need to have valid value for env GOOGLE_SERVICE_ACCOUNT_KEY or GCP_SERVICE_ACCOUNT_PATH if ORGANISATION_CREATION_DISABLED=true"))
            .build()
            .await
            .expect("There was an error, trying to build connection with gcp authenticator");

        let client =
            hyper_util::client::legacy::Client::builder(hyper_util::rt::TokioExecutor::new())
                .build(
                    hyper_rustls::HttpsConnectorBuilder::new()
                        .with_native_roots()
                        .unwrap()
                        .https_or_http()
                        .enable_http1()
                        .build(),
                );
        hub = Some(Sheets::new(client, gcp_auth));
    }

    let superposition_client = if app_config.enable_authenticated_superposition {
        let superposition_user_token = app_config.superposition_user_token.clone().expect(
            "SUPERPOSITION_USER_TOKEN must be set when ENABLE_AUTHENTICATED_SUPERPOSITION=true",
        );
        let superposition_org_token = app_config.superposition_org_token.clone().expect(
            "SUPERPOSITION_ORG_TOKEN must be set when ENABLE_AUTHENTICATED_SUPERPOSITION=true",
        );

        // Inject Auth cookie for Superposition SDK calls
        let cookie_interceptor = CookieIntercept::new(format!(
            "user={}; org_{}={}",
            superposition_user_token, superposition_org_id_env, superposition_org_token,
        ));

        superposition_sdk::Client::from_conf(
            SrsConfig::builder()
                .endpoint_url(cac_url.clone())
                .behavior_version_latest()
                .bearer_token(superposition_token.into())
                .interceptor(cookie_interceptor)
                .build(),
        )
    } else {
        superposition_sdk::Client::from_conf(
            SrsConfig::builder()
                .endpoint_url(cac_url.clone())
                .behavior_version_latest()
                .bearer_token(superposition_token.into())
                .build(),
        )
    };

    let authz_provider = build_authz_provider(
        authz_provider_kind,
        authz_bootstrap_super_admins.clone(),
        pool.clone(),
        authz_casbin_auto_load_secs,
    )
    .await
    .expect("Failed to initialize AuthZ provider");

    let app_state = Arc::new(types::AppState {
        env: env.clone(),
        authn_provider: build_authn_provider(authn_provider_kind),
        authz_provider,
        db_pool: pool,
        s3_client: aws_s3_client,
        cf_client: aws_cloudfront_client,
        superposition_client,
        sheets_hub: hub,
    });
    app_state
        .authz_provider
        .bootstrap(app_state.as_ref())
        .await
        .expect("Failed to bootstrap AuthZ provider");

    // Start the background cleanup job for transaction reconciliation
    let app_state_data = web::Data::from(app_state.clone());

    if migrations_to_run_on_boot
        .iter()
        .any(|m| m == "superposition")
    {
        let superposition_migration =
            migrate_superposition(&app_state_data, superposition_migration_strategy).await;
        if superposition_migration.is_err() {
            panic!(
                "Superposition migration failed: {:?}",
                superposition_migration.err()
            );
        } else {
            println!("Superposition migration completed successfully");
        }
    }

    let num_workers = app_config.num_workers;
    let keep_alive = app_config.keep_alive;
    let backlog = app_config.backlog;
    let port = app_config.port;

    HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::<WithRequestId>::new())
            .wrap(actix_web::middleware::from_fn(req_id_header_mw))
            .app_data(web::Data::from(app_state.clone()))
            .app_data(PathConfig::default().error_handler(middleware::path_error_handler))
            .app_data(QueryConfig::default().error_handler(middleware::query_error_handler))
            .app_data(web::JsonConfig::default().error_handler(middleware::json_error_handler))
            .wrap(actix_web::middleware::Compress::default())
            .wrap(actix_web::middleware::Logger::default())
            .service(docs::add_routes())
            .service(web::scope("/release").service(release::add_public_routes()))
            .service(web::scope("/build").service(build::add_routes()))
            .service(
                web::scope(&server_path_prefix)
                    .service(
                        web::resource("/health").route(
                            web::get().to(|| async {
                                HttpResponse::Ok().json(json!({ "status": "ok" }))
                            }),
                        ),
                    )
                    .service(
                        web::scope("/dashboard/configuration").service(configuration::add_routes()),
                    )
                    .service(web::scope("/authz").wrap(Auth).service(authz::add_routes()))
                    .service(
                        web::scope("/organisations")
                            .wrap(Auth)
                            .service(organisation::add_routes()),
                    )
                    .service(
                        web::scope("/organisation/user")
                            .wrap(Auth)
                            .service(organisation::user::add_routes()),
                    )
                    .service(user::add_routes("users"))
                    .service(token::add_scopes("token"))
                    .service(
                        web::scope("/service-accounts")
                            .wrap(Auth)
                            .service(service_account::add_routes()),
                    )
                    .service(web::scope("/file").wrap(Auth).service(file::add_routes()))
                    .service(
                        web::scope("/packages")
                            .wrap(Auth)
                            .service(package::add_routes()),
                    )
                    .service(release::add_routes("releases")),
            )
    })
    .workers(num_workers)
    .keep_alive(std::time::Duration::from_secs(keep_alive))
    .backlog(backlog)
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
