use std::collections::HashMap;
use std::io::Write;

use actix_web::{get, web, HttpResponse, Scope};
use aws_smithy_types::Document;
use diesel::prelude::*;
use log::info;
use serde::Serialize;
use serde_json::Value;
use zip::write::FileOptions;
use zip::ZipWriter;

use crate::release::utils::get_files_by_file_keys_async;
use crate::utils::db::schema::hyperotaserver::builds::{
    application as app_column, dsl::*, organisation as org_column, release_id as release_id_column,
};
use crate::utils::s3::push_file_byte_arr;
use crate::{
    release, run_blocking,
    types::{ABError, AppState},
    utils::{
        db::models::{BuildEntry, NewBuildEntry},
        workspace::get_workspace_name_for_application,
    },
};

pub fn add_routes() -> Scope {
    Scope::new("").service(serve_version).service(serve_zip)
}

#[derive(Serialize)]
struct BuildResponse {
    version: String,
}

fn increment_build_version(latest_version: Option<&str>, _release_version: &str) -> String {
    match latest_version {
        Some(version) => {
            // Parse the existing version to extract the base (1.0) and increment the last number
            let parts: Vec<&str> = version.split('.').collect();
            if parts.len() == 3 {
                if let (Some(base), Ok(last_num)) = (
                    parts.get(0..2).map(|slice| slice.join(".")),
                    parts[2].parse::<u32>(),
                ) {
                    return format!("{}.{}", base, last_num + 1);
                }
            }
            // If version doesn't match expected format, start with 1.0.1
            "1.0.1".to_string()
        }
        None => {
            // No existing version, start with 1.0.1
            "1.0.1".to_string()
        }
    }
}

#[derive(Clone)]
struct Arguments {
    organisation: String,
    application: String,
    dimensions: HashMap<String, Value>,
    _force: bool,
}

async fn download_file_content(url: &str) -> Result<Vec<u8>, ABError> {
    let client = reqwest::Client::new();
    let response = client.get(url).send().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to download file from {}: {}", url, e))
    })?;

    let bytes = response.bytes().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to read file content from {}: {}", url, e))
    })?;

    Ok(bytes.to_vec())
}

struct File {
    file_path: String,
    file_url: String,
}

fn sanitize_path(path: &str, replace_with_hyphen: bool) -> String {
    let mut result = path.to_string();

    // Remove leading slash if present
    if result.starts_with('/') {
        result.remove(0);
    }

    // Replace all remaining slashes with hyphens only for iOS zip files
    if replace_with_hyphen {
        result = result.replace('/', "-");
    }

    result
}

async fn create_and_upload_build(
    org: String,
    app: String,
    new_build_version: String,
    config_document: Option<Document>,
    state: web::Data<AppState>,
) -> Result<(), ABError> {
    // Extract files from config
    let package_index =
        crate::release::utils::extract_file_from_configs(&config_document, "package.index")
            .unwrap_or_default();
    let package_important =
        crate::release::utils::extract_files_from_configs(&config_document, "package.important")
            .unwrap_or_default();
    let package_lazy =
        crate::release::utils::extract_files_from_configs(&config_document, "package.lazy")
            .unwrap_or_default();
    let resources =
        crate::release::utils::extract_files_from_configs(&config_document, "resources")
            .unwrap_or_default();

    // Combine all files to download
    let mut all_files = vec![package_index.clone()];
    all_files.extend(package_important.clone());
    all_files.extend(package_lazy.clone());
    all_files.extend(resources.clone());

    // Filter out empty file keys
    all_files.retain(|file_key| !file_key.is_empty());

    if !all_files.is_empty() {
        // Get file details from database
        let files = get_files_by_file_keys_async(
            state.db_pool.clone(),
            org.clone(),
            app.clone(),
            all_files.clone(),
        )
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to get files by keys: {}", e)))?;
        let mut files: Vec<File> = files
            .iter()
            .map(|f| File {
                file_path: f.file_path.clone(),
                file_url: f.url.clone(),
            })
            .collect();
        files.push(File {
            file_path: String::from("release_config.json"),
            file_url: format!("{}/release/{}/{}", state.env.public_url, &org, &app),
        });

        // Create a temporary zip file in memory
        let mut zip_data: Vec<u8> = Vec::new();
        let mut zip = ZipWriter::new(std::io::Cursor::new(&mut zip_data));

        // Download each file and add it to the zip
        for file_entry in files {
            let file_content = download_file_content(&file_entry.file_url).await?;

            // Add file to zip with its file path as the name
            zip.start_file::<_, ()>(
                format!(
                    "AirborneAssets/{}",
                    sanitize_path(&file_entry.file_path, true)
                ),
                FileOptions::default(),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to add file to zip: {}", e))
            })?;
            zip.write_all(&file_content).map_err(|e| {
                ABError::InternalServerError(format!("Failed to write file to zip: {}", e))
            })?;
        }

        // Finish the zip file
        zip.finish().map_err(|e| {
            ABError::InternalServerError(format!("Failed to finish zip file: {}", e))
        })?;

        // Upload zip file to S3
        let s3_path = format!("builds/{}/{}/{}.zip", org, app, new_build_version);
        push_file_byte_arr(
            &state.s3_client,
            state.env.bucket_name.clone(),
            zip_data,
            s3_path,
        )
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to upload build to S3: {}", e))
        })?;
    }

    Ok(())
}

async fn build(
    org: String,
    app: String,
    release_version: String,
    config_document: Option<Document>,
    state: web::Data<AppState>,
) -> Result<String, ABError> {
    println!(
        "Starting build for {}/{} with release version {}",
        org, app, release_version
    );

    let pool = state.db_pool.clone();
    let org_clone = org.clone();
    let app_clone = app.clone();
    let latest_build_version = run_blocking!({
        let mut conn = pool.get()?;
        // Get the latest build version for this org/app to increment
        builds
            .filter(org_column.eq(&org_clone))
            .filter(app_column.eq(&app_clone))
            .order(build_version.desc())
            .select(build_version)
            .first::<String>(&mut conn)
            .optional()
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to query latest build version: {}", e))
            })
    })?;

    // Generate new semver version by incrementing the last part
    let new_build_version =
        increment_build_version(latest_build_version.as_deref(), &release_version);
    println!("Creating new build: {}", new_build_version);

    let new_build = NewBuildEntry {
        build_version: new_build_version.clone(),
        organisation: org.clone(),
        application: app.clone(),
        release_id: release_version,
    };

    // Create and upload build in a separate task
    let state_clone = state.clone();
    let new_build_version_clone = new_build_version.clone();

    create_and_upload_build(
        org,
        app,
        new_build_version_clone,
        config_document,
        state_clone,
    )
    .await?;

    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::insert_into(builds)
            .values(&new_build)
            .execute(&mut conn)
            .map_err(|e| ABError::InternalServerError(format!("Failed to insert new build: {}", e)))
    })?;

    Ok(new_build_version)
}

async fn extract_args(
    path: web::Path<(String, String)>,
    state: web::Data<AppState>,
    req: actix_web::HttpRequest,
) -> Result<Arguments, ABError> {
    let _conn = state
        .db_pool
        .get()
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let (org, app) = path.into_inner();
    let context: HashMap<String, Value> = req
        .headers()
        .get("x-dimension")
        .and_then(|val| val.to_str().ok())
        .map(release::utils::parse_kv_string)
        .unwrap_or_default();

    let force = req
        .headers()
        .get("x-force")
        .and_then(|val| val.to_str().ok())
        .map(String::from)
        .unwrap_or_default()
        == "true";

    Ok(Arguments {
        organisation: org,
        application: app,
        dimensions: context,
        _force: force,
    })
}

async fn generate(
    arguments: Arguments,
    state: web::Data<AppState>,
) -> Result<BuildResponse, ABError> {
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();

    // Get workspace name (similar to serve_release)
    let workspace_name = get_workspace_name_for_application(
        state.db_pool.clone(),
        arguments.application.clone(),
        arguments.organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Failed to get workspace name: {}", e)))?;

    // Get resolved config from Superposition (similar to serve_release)
    let resolved_config_builder = arguments.dimensions.iter().fold(
        state
            .superposition_client
            .get_resolved_config()
            .workspace_id(workspace_name.clone())
            .org_id(superposition_org_id_from_env.clone())
            .set_context(Some(HashMap::new())),
        |builder, (key, value)| {
            builder.context(
                key.clone(),
                Document::String(value.as_str().unwrap_or("").to_string()),
            )
        },
    );

    let resolved_config = resolved_config_builder.send().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to get resolved config: {}", e))
    })?;

    let config_document = resolved_config.config;

    // Extract release version from config (similar to serve_release)
    let release_version =
        release::utils::extract_string_from_configs(&config_document, "config.version")
            .unwrap_or_default();

    println!("release_version: {}", release_version);

    if release_version.is_empty() {
        return Err(ABError::InternalServerError(
            "Failed to extract release version from config".to_string(),
        ));
    }

    let pool = state.db_pool.clone();
    let org = arguments.organisation.clone();
    let app = arguments.application.clone();
    let release_version_interal = release_version.clone();
    // Check if build already exists for this release version
    let existing_build = run_blocking!({
        let mut conn = pool.get()?;
        builds
            .filter(org_column.eq(&org))
            .filter(app_column.eq(&app))
            .filter(release_id_column.eq(&release_version_interal))
            .first::<BuildEntry>(&mut conn)
            .optional()
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to query existing builds: {}", e))
            })
    })?;

    match existing_build {
        Some(build_entry) => {
            // Return existing build version
            info!(
                "Found existing build entry for org: {} app: {} as version: {}",
                &arguments.organisation, &arguments.application, &build_entry.build_version
            );
            Ok(BuildResponse {
                version: build_entry.build_version,
            })
        }
        None => {
            let pool = state.db_pool.clone();
            let org = arguments.organisation.clone();
            let app = arguments.application.clone();
            // Check what is latest available version for the current application
            let latest_build = run_blocking!({
                let mut conn = pool.get()?;
                builds
                    .filter(org_column.eq(&org))
                    .filter(app_column.eq(&app))
                    .order(build_version.desc())
                    .first::<BuildEntry>(&mut conn)
                    .optional()
                    .map_err(|e| {
                        ABError::InternalServerError(format!("Failed to query latest build: {}", e))
                    })
            })?;

            match latest_build {
                Some(build_entry) => {
                    // Spawn build thread only if build entry is present
                    let build_args = arguments.clone();
                    let release_version_clone = release_version.clone();
                    let config_document_clone = config_document.clone();
                    let state_clone = state.clone();
                    tokio::spawn(async move {
                        println!("Here?");
                        tracing::info!("Here?");
                        if let Err(e) = build(
                            build_args.organisation.clone(),
                            build_args.application.clone(),
                            release_version_clone,
                            config_document_clone,
                            state_clone,
                        )
                        .await
                        {
                            tracing::error!(?e, "Background build task failed");
                        } else {
                            tracing::info!("Background build task completed successfully");
                        }
                    });

                    // Return existing latest build version
                    println!(
                        "Returning latest available build: {}",
                        build_entry.build_version
                    );
                    Ok(BuildResponse {
                        version: build_entry.build_version,
                    })
                }
                None => {
                    let config_document_clone = config_document.clone();
                    let state_clone = state.clone();
                    let new_build_version =
                        // Run build function synchronously if no builds exist and return the new version
                        build(
                            arguments.organisation.clone(),
                            arguments.application.clone(),
                            release_version.clone(),
                            config_document_clone,
                            state_clone
                        ).await?;

                    println!("Created new build version: {}", new_build_version);

                    Ok(BuildResponse {
                        version: new_build_version,
                    })
                }
            }
        }
    }
}

#[get("{organisation}/{application}")]
async fn serve_version(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ABError> {
    // Where do I save the last updated aar / zip?
    // S3 can just dump to archive/org/app/zip/release-id.zip?
    // S3 can just dump to archive/org/app/aar/version.aar/pom/hashes,
    // Assuming release id is unique to dimension
    // Do I have a table. What do I store in the table
    // Ideally release id with dimension override

    // Resolve latest release for this set of dimensions
    let state_clone = state.clone();
    let _args = extract_args(path, state_clone, req).await?;
    let build_response = generate(_args, state.clone()).await?;

    Ok(actix_web::HttpResponse::Ok()
        .insert_header((
            actix_web::http::header::CACHE_CONTROL,
            "public, s-maxage=86400, max-age=0",
        ))
        .insert_header((actix_web::http::header::CONTENT_TYPE, "application/json"))
        .json(build_response))
}

#[get("{organisation}/{application}/zip")]
async fn serve_zip(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ABError> {
    // Extract args
    let _args = extract_args(path, state.clone(), req).await?;
    let org_id = _args.organisation.clone();
    let app_id = _args.application.clone();
    let build_response = generate(_args, state.clone()).await?;

    let key = format!(
        "builds/{}/{}/{}.zip",
        org_id, app_id, build_response.version
    );

    // Fetch the full object from S3
    let resp = state
        .s3_client
        .get_object()
        .bucket(state.env.bucket_name.clone())
        .key(&key)
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to get object from S3: {}", e))
        })?;

    // Collect the object body into a Vec<u8>
    let data = resp
        .body
        .collect()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to read S3 object: {}", e)))?
        .into_bytes();

    // Return it as the HTTP response
    Ok(HttpResponse::Ok()
        .insert_header((actix_web::http::header::CONTENT_TYPE, "application/zip"))
        .insert_header((
            actix_web::http::header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}.zip\"", build_response.version),
        ))
        .body(data))
}
