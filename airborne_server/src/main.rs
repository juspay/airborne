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
use url::Url;
use utils::{db, transaction_manager::start_cleanup_job};

use crate::{
    dashboard::configuration,
    middleware::{
        auth::Auth,
        request::{req_id_header_mw, WithRequestId},
    },
    provider::authn::build_authn_provider,
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_default();
    utils::init_tracing(log_format);

    dotenv().ok();

    let shared_config = aws_config::from_env().load().await;
    let aws_kms_client = aws_sdk_kms::Client::new(&shared_config);

    let app_config = AppConfig::build(&aws_kms_client)
        .await
        .expect("Failed to build AppConfig");

    let superposition_migration_strategy =
        SuperpositionMigrationStrategy::from(app_config.superposition_migration_strategy.clone());

    let migrations_to_run_on_boot: Vec<String> = app_config
        .migrations_to_run_on_boot
        .split(',')
        .map(|s| s.trim().into())
        .collect();

    let force_path_style = app_config.aws_endpoint_url.is_some();

    let aws_cloudfront_client = aws_sdk_cloudfront::Client::new(&shared_config);

    if migrations_to_run_on_boot.contains(&"db".to_string()) {
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

    let superposition_token = app_config.superposition_token.clone().unwrap_or_default();

    let cac_url = app_config.superposition_url.clone();
    let superposition_org_id_env = app_config.superposition_org_id.clone();

    let trim_trailing_slash = |value: &str| value.trim_end_matches('/').to_string();
    let normalize_external_base_url = |value: &str| {
        let trimmed = trim_trailing_slash(value);
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            trimmed
        } else {
            format!("http://{trimmed}")
        }
    };
    let authn_provider_kind = types::AuthnProviderKind::from_str(&app_config.authn_provider)
        .expect("AUTHN_PROVIDER must be one of: keycloak, oidc, okta, auth0");
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
    let auth_admin_client_id = app_config
        .auth_admin_client_id
        .clone()
        .expect("AUTH_ADMIN_CLIENT_ID must be set");
    let auth_admin_client_secret = app_config
        .auth_admin_client_secret
        .clone()
        .expect("AUTH_ADMIN_CLIENT_SECRET must be set");
    let auth_admin_token_url = app_config
        .auth_admin_token_url
        .clone()
        .expect("AUTH_ADMIN_TOKEN_URL must be set");
    let auth_admin_audience = app_config.auth_admin_audience.clone();
    let auth_admin_scopes = app_config.auth_admin_scopes.clone();
    let auth_admin_issuer = app_config
        .auth_admin_issuer
        .clone()
        .expect("AUTH_ADMIN_ISSUER must be set");

    // AuthZ continues to use Keycloak admin APIs. Derive Keycloak base URL + realm from
    // AUTH_ADMIN_ISSUER, which must point to a Keycloak realm issuer URL.
    let auth_admin_issuer = trim_trailing_slash(&auth_admin_issuer);
    let parsed_issuer =
        Url::parse(&auth_admin_issuer).expect("AUTH_ADMIN_ISSUER must be a valid absolute URL");
    let path_segments: Vec<&str> = parsed_issuer
        .path_segments()
        .map(|segments| segments.filter(|segment| !segment.is_empty()).collect())
        .unwrap_or_default();
    let realms_index = path_segments
        .iter()
        .position(|segment| *segment == "realms")
        .expect(
            "AUTH_ADMIN_ISSUER must contain '/realms/{realm}' for Keycloak-backed authorization",
        );
    let realm = path_segments
        .get(realms_index + 1)
        .expect("AUTH_ADMIN_ISSUER must include a realm segment after '/realms'")
        .to_string();
    let mut keycloak_base = format!(
        "{}://{}",
        parsed_issuer.scheme(),
        parsed_issuer
            .host_str()
            .expect("AUTH_ADMIN_ISSUER must include a host")
    );
    if let Some(port) = parsed_issuer.port() {
        keycloak_base.push_str(&format!(":{port}"));
    }
    if realms_index > 0 {
        keycloak_base.push('/');
        keycloak_base.push_str(&path_segments[..realms_index].join("/"));
    }
    let keycloak_url = trim_trailing_slash(&keycloak_base);

    let env = types::Environment {
        public_url: app_config.public_endpoint.clone(),
        authn_issuer_url,
        authn_external_issuer_url,
        authn_client_id: authn_client_id.clone(),
        authn_client_secret: authn_client_secret.clone(),
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

    let app_state = Arc::new(types::AppState {
        env: env.clone(),
        authn_provider: build_authn_provider(authn_provider_kind),
        db_pool: pool,
        s3_client: aws_s3_client,
        cf_client: aws_cloudfront_client,
        superposition_client,
        sheets_hub: hub,
    });

    // Start the background cleanup job for transaction reconciliation
    let app_state_data = web::Data::from(app_state.clone());
    let _cleanup_handle = start_cleanup_job(app_state_data.clone());
    info!("Started transaction cleanup background job");

    if migrations_to_run_on_boot.contains(&"superposition".to_string()) {
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
