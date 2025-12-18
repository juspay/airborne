use std::collections::HashMap;
use std::io::Write;
use std::str::FromStr;

use actix_web::web::Json;
use actix_web::{get, web, Scope};
use aws_smithy_types::Document;
use bytes::Bytes;
use diesel::prelude::*;
use http::HeaderValue;
use log::info;
use serde::Serialize;
use serde_json::Value;
use zip::write::FileOptions;
use zip::ZipWriter;

use crate::file::utils::download_file_content;
use crate::release::utils::get_files_by_file_keys_async;
use crate::types::WithHeaders;
use crate::utils::db::schema::hyperotaserver::builds::{
    application as app_column, build_version, dsl::builds, organisation as org_column,
    release_id as release_id_column,
};
use crate::utils::s3::push_file_byte_arr;
use crate::utils::semver::SemVer;
use crate::{
    release, run_blocking, types as airborne_types,
    types::{ABError, AppState},
    utils::{
        db::models::{BuildEntry, NewBuildEntry},
        workspace::get_workspace_name_for_application,
    },
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(serve_version)
        .service(serve_zip)
        .service(serve_aar)
}

#[derive(Serialize)]
struct BuildResponse {
    version: SemVer,
}

fn get_android_root_path(prefix: &String, org: &String, app: &String) -> String {
    format!("builds/{0}/{1}/{2}-airborne-assets/", prefix, org, app)
}

fn get_aar_path(prefix: &String, org: &String, app: &String, new_build_version: &SemVer) -> String {
    format!(
        "{0}{1}/{2}-airborne-assets-{1}.aar",
        get_android_root_path(prefix, org, app),
        new_build_version,
        app
    )
}

fn get_pom_path(prefix: &String, org: &String, app: &String, new_build_version: &SemVer) -> String {
    format!(
        "{0}{1}/{2}-airborne-assets-{1}.pom",
        get_android_root_path(prefix, org, app),
        new_build_version,
        app
    )
}

fn get_maven_metadata_path(prefix: &String, org: &String, app: &String) -> String {
    format!(
        "{}maven-metadata.xml",
        get_android_root_path(prefix, org, app)
    )
}

fn generate_pom_content(org: &String, app: &String, version: &SemVer) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>{0}</groupId>
    <artifactId>{1}-airborne-assets</artifactId>
    <version>{2}</version>
    <packaging>aar</packaging>
    <name>Airborne Assets</name>
    <description>Airborne assets package for {0}/{1}</description>
</project>"#,
        org, app, version
    )
}

fn parse_existing_maven_metadata(metadata_content: &str) -> airborne_types::Result<Vec<SemVer>> {
    // Simple XML parsing to extract version numbers
    let mut versions = Vec::new();

    // Look for <version>...</version> tags
    for line in metadata_content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("<version>") && trimmed.ends_with("</version>") {
            if let Some(v) = trimmed
                .strip_prefix("<version>")
                .and_then(|s| s.strip_suffix("</version>"))
            {
                if !v.is_empty() {
                    let semver = SemVer::from_str(v).map_err(|e| {
                        log::warn!("Invalid version '{}': {}", v, e);
                        ABError::BadRequest(format!("Invalid version '{}': {}", v, e))
                    })?;
                    versions.push(semver);
                }
            }
        }
    }

    versions.sort();
    Ok(versions)
}

fn generate_maven_metadata_content(org: &String, app: &String, versions: Vec<SemVer>) -> String {
    let default_version = SemVer::default();
    let latest_version = versions.last().unwrap_or(&default_version);
    let versions_xml = versions
        .iter()
        .map(|v| format!("      <version>{}</version>", v))
        .collect::<Vec<_>>()
        .join("\n");

    // Get current timestamp in the format Maven expects (YYYYMMDDHHMMSS)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Convert to a simple timestamp format
    let timestamp = format!("{}", now);

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<metadata>
    <groupId>{}</groupId>
    <artifactId>{}-airborne-assets</artifactId>
    <versioning>
        <latest>{}</latest>
        <release>{}</release>
        <versions>
{}
        </versions>
        <lastUpdated>{}</lastUpdated>
    </versioning>
</metadata>"#,
        org, app, latest_version, latest_version, versions_xml, timestamp
    )
}

fn get_zip_path(org: &String, app: &String, new_build_version: &SemVer) -> String {
    format!("builds/{}/{}/{}.zip", org, app, new_build_version)
}

fn increment_build_version(latest_version: Option<SemVer>) -> SemVer {
    match latest_version {
        Some(mut version) => {
            // Increment the patch version
            version.patch += 1;
            version
        }
        None => {
            // No existing version, start with 1.0.1
            SemVer::default()
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
    new_build_version: &SemVer,
    config_document: Option<Document>,
    state: web::Data<AppState>,
) -> airborne_types::Result<()> {
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
        let files: Vec<File> = files
            .iter()
            .map(|f| File {
                file_path: f.file_path.clone(),
                file_url: f.url.clone(),
            })
            .collect();

        // Create a temporary zip file in memory
        let mut zip_data: Vec<u8> = Vec::new();
        let mut zip_builder = ZipWriter::new(std::io::Cursor::new(&mut zip_data));
        let mut aar_data: Vec<u8> = Vec::new();
        let mut aar_builder = ZipWriter::new(std::io::Cursor::new(&mut aar_data));

        // Download each file and add it to the zip
        for file_entry in files {
            let file_content = download_file_content(&file_entry.file_url).await?;

            // Add file to zip with its file path as the name
            zip_builder
                .start_file::<_, ()>(
                    format!(
                        "AirborneAssets/{}",
                        sanitize_path(&file_entry.file_path, true)
                    ),
                    FileOptions::default(),
                )
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to add file to zip: {}", e))
                })?;
            zip_builder.write_all(&file_content).map_err(|e| {
                ABError::InternalServerError(format!("Failed to write file to zip: {}", e))
            })?;

            aar_builder
                .start_file::<_, ()>(
                    format!(
                        "assets/{}/{}/app/package/{}",
                        &org, &app, &file_entry.file_path
                    ),
                    FileOptions::default(),
                )
                .map_err(|e| {
                    ABError::InternalServerError(format!("Failed to add file to zip: {}", e))
                })?;

            aar_builder.write_all(&file_content).map_err(|e| {
                ABError::InternalServerError(format!("Failed to write file to aar: {}", e))
            })?;
        }

        let file_content = download_file_content(&format!(
            "{}/release/{}/{}",
            state.env.public_url, &org, &app
        ))
        .await?;

        zip_builder
            .start_file::<_, ()>(
                "AirborneAssets/release_config.json".to_string(),
                FileOptions::default(),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to add file to zip: {}", e))
            })?;
        zip_builder.write_all(&file_content).map_err(|e| {
            ABError::InternalServerError(format!("Failed to write file to zip: {}", e))
        })?;

        aar_builder
            .start_file::<_, ()>(
                format!("assets/{}/{}/app/release_config.json", &org, &app),
                FileOptions::default(),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to add file to zip: {}", e))
            })?;

        aar_builder.write_all(&file_content).map_err(|e| {
            ABError::InternalServerError(format!("Failed to write file to aar: {}", e))
        })?;

        // Finish the zip file
        zip_builder.finish().map_err(|e| {
            ABError::InternalServerError(format!("Failed to finish zip file: {}", e))
        })?;

        // Minimal AndroidManifest.xml
        aar_builder
            .start_file::<_, ()>(
                "AndroidManifest.xml",
                FileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to create manifest file: {}", e))
            })?;

        aar_builder
            .write_all(
                format!(
                    r#"<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{}.{}.assets" />"#,
                    &org.replace("-", "."),
                    &app.replace("-", ".")
                )
                .as_bytes(),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to write manifest file: {}", e))
            })?;

        // Empty classes.jar as a proper zip file
        let mut jar_data: Vec<u8> = Vec::new();
        {
            let jar_builder = ZipWriter::new(std::io::Cursor::new(&mut jar_data));
            jar_builder.finish().map_err(|e| {
                ABError::InternalServerError(format!("Failed to create empty jar: {}", e))
            })?;
        }

        aar_builder
            .start_file::<_, ()>(
                "classes.jar",
                FileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to create classes.jar file: {}", e))
            })?;

        aar_builder.write_all(&jar_data).map_err(|e| {
            ABError::InternalServerError(format!("Failed to write classes.jar file: {}", e))
        })?;

        // String resource for asset version
        let strings_xml = format!(
            r#"<resources>
    <string name="airborne_asset_version">{}</string>
</resources>"#,
            &new_build_version
        );
        aar_builder
            .start_file::<_, ()>(
                "res/values/strings.xml",
                FileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to create strings file: {}", e))
            })?;
        aar_builder.write_all(strings_xml.as_bytes()).map_err(|e| {
            ABError::InternalServerError(format!("Failed to write strings file: {}", e))
        })?;

        // Add R.txt file
        let r_txt_content = "int string airborne_asset_version 0x7f0e0001\n".to_string();
        aar_builder
            .start_file::<_, ()>(
                "R.txt",
                FileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to create R.txt file: {}", e))
            })?;
        aar_builder
            .write_all(r_txt_content.as_bytes())
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to write R.txt file: {}", e))
            })?;

        // Add keep file in res/raw to prevent string resource removal
        let keep_content = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<resources xmlns:tools=\"http://schemas.android.com/tools\"\ntools:keep=\"@string/airborne_asset_version\" />";
        aar_builder
            .start_file::<_, ()>(
                "res/raw/airborne_keep.xml",
                FileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to create keep file: {}", e))
            })?;
        aar_builder
            .write_all(keep_content.as_bytes())
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to write keep file: {}", e))
            })?;

        aar_builder.finish().map_err(|e| {
            ABError::InternalServerError(format!("Failed to finish aar file: {}", e))
        })?;

        // Upload zip file to S3
        let s3_path = get_zip_path(&org, &app, new_build_version);
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

        let aar_path = get_aar_path(&String::from("hyper-sdk"), &org, &app, new_build_version);
        push_file_byte_arr(
            &state.s3_client,
            state.env.bucket_name.clone(),
            aar_data,
            aar_path,
        )
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to upload build to S3: {}", e))
        })?;

        // Generate and upload POM file
        let pom_content = generate_pom_content(&org, &app, new_build_version);
        let pom_path = get_pom_path(&String::from("hyper-sdk"), &org, &app, new_build_version);
        push_file_byte_arr(
            &state.s3_client,
            state.env.bucket_name.clone(),
            pom_content.into_bytes(),
            pom_path,
        )
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to upload POM to S3: {}", e)))?;

        // Get existing Maven metadata from S3 and merge with new version
        let maven_metadata_path = get_maven_metadata_path(&String::from("hyper-sdk"), &org, &app);
        let existing_versions = match state
            .s3_client
            .get_object()
            .bucket(state.env.bucket_name.clone())
            .key(&maven_metadata_path)
            .send()
            .await
        {
            Ok(resp) => {
                let data = resp
                    .body
                    .collect()
                    .await
                    .map_err(|e| {
                        ABError::InternalServerError(format!(
                            "Failed to read existing Maven metadata: {}",
                            e
                        ))
                    })?
                    .into_bytes();

                let metadata_content = String::from_utf8(data.to_vec()).map_err(|e| {
                    ABError::InternalServerError(format!(
                        "Failed to parse Maven metadata as UTF-8: {}",
                        e
                    ))
                })?;

                parse_existing_maven_metadata(&metadata_content).unwrap_or_else(|e| {
                    log::warn!("Failed to parse maven metadata: {}", e);
                    Vec::new()
                })
            }
            Err(_) => {
                // No existing metadata, start with empty list
                Vec::new()
            }
        };

        // Merge existing versions with new version
        let mut versions = existing_versions;
        if !versions.contains(new_build_version) {
            versions.push(new_build_version.clone());
            versions.sort();
        }

        // Generate and upload Maven metadata
        let maven_metadata_content = generate_maven_metadata_content(&org, &app, versions);
        let maven_metadata_path = get_maven_metadata_path(&String::from("hyper-sdk"), &org, &app);
        push_file_byte_arr(
            &state.s3_client,
            state.env.bucket_name.clone(),
            maven_metadata_content.into_bytes(),
            maven_metadata_path,
        )
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to upload Maven metadata to S3: {}", e))
        })?;
    }

    Ok(())
}

async fn build(
    org: String,
    app: String,
    release_id: String,
    config_document: Option<Document>,
    state: web::Data<AppState>,
) -> airborne_types::Result<SemVer> {
    info!(
        "Starting build for {}/{} with release id {}",
        org, app, release_id
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
            .first::<SemVer>(&mut conn)
            .optional()
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to query latest build version: {}", e))
            })
    })?;

    // Generate new semver version by incrementing the last part
    let new_build_version = increment_build_version(latest_build_version);
    info!("Creating new build: {}", new_build_version);

    let new_build = NewBuildEntry {
        build_version: new_build_version.clone(),
        organisation: org.clone(),
        application: app.clone(),
        release_id,
    };

    // Create and upload build in a separate task
    let state_clone = state.clone();

    create_and_upload_build(org, app, &new_build_version, config_document, state_clone).await?;

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
) -> airborne_types::Result<Arguments> {
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
) -> airborne_types::Result<BuildResponse> {
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
    let release_id =
        release::utils::extract_string_from_configs(&config_document, "config.version")
            .unwrap_or_default();

    info!("release_id: {}", release_id);

    if release_id.is_empty() {
        return Err(ABError::InternalServerError(
            "Failed to extract release version from config".to_string(),
        ));
    }

    let pool = state.db_pool.clone();
    let org = arguments.organisation.clone();
    let app = arguments.application.clone();
    let release_id_interal = release_id.clone();
    // Check if build already exists for this release version
    let existing_build = run_blocking!({
        let mut conn = pool.get()?;
        builds
            .filter(org_column.eq(&org))
            .filter(app_column.eq(&app))
            .filter(release_id_column.eq(&release_id_interal))
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
                "Found existing build entry for org: {} app: {}, dimensions: {} as version: {}",
                &arguments.organisation,
                &arguments.application,
                serde_json::to_string(&arguments.dimensions).unwrap_or_default(),
                &build_entry.build_version
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
                    let release_id_clone = release_id.clone();
                    let config_document_clone = config_document.clone();
                    let state_clone = state.clone();
                    tokio::spawn(async move {
                        if let Err(e) = build(
                            build_args.organisation.clone(),
                            build_args.application.clone(),
                            release_id_clone,
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
                    info!(
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
                            release_id.clone(),
                            config_document_clone,
                            state_clone
                        ).await?;

                    info!("Created new build version: {}", new_build_version);

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
) -> airborne_types::Result<WithHeaders<Json<BuildResponse>>> {
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

    Ok(WithHeaders::new(Json(build_response))
        .header(
            actix_web::http::header::CACHE_CONTROL,
            HeaderValue::from_static("public, s-maxage=86400, max-age=0"),
        )
        .header(
            actix_web::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )
        .status(actix_web::http::StatusCode::OK))
}

#[get("{organisation}/{application}/zip")]
async fn serve_zip(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Bytes>> {
    // Extract args
    let _args = extract_args(path, state.clone(), req).await?;
    let org_id = _args.organisation.clone();
    let app_id = _args.application.clone();
    let build_response = generate(_args, state.clone()).await?;

    let key = get_zip_path(&org_id, &app_id, &build_response.version);

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

    Ok(WithHeaders::new(data)
        .header(
            actix_web::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/zip"),
        )
        .header(
            actix_web::http::header::CONTENT_DISPOSITION,
            HeaderValue::from_str(&format!(
                "attachment; filename=\"Assets-{}.zip\"",
                build_response.version
            ))
            .map_err(|e| {
                ABError::InternalServerError(format!(
                    "Failed to create content disposition header: {}",
                    e
                ))
            })?,
        )
        .status(actix_web::http::StatusCode::OK))
}

#[get("{organisation}/{application}/aar")]
async fn serve_aar(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Bytes>> {
    // Extract args
    let _args = extract_args(path, state.clone(), req).await?;
    let org_id = _args.organisation.clone();
    let app_id = _args.application.clone();
    let build_response = generate(_args, state.clone()).await?;

    let aar_path = get_aar_path(
        &String::from("hyper-sdk"),
        &org_id,
        &app_id,
        &build_response.version,
    );

    // Fetch the full object from S3
    let resp = state
        .s3_client
        .get_object()
        .bucket(state.env.bucket_name.clone())
        .key(&aar_path)
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

    Ok(WithHeaders::new(data)
        .header(
            actix_web::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/zip"),
        )
        .header(
            actix_web::http::header::CONTENT_DISPOSITION,
            HeaderValue::from_str(&format!(
                "attachment; filename=\"{}-airborne-assets-{}.aar\"",
                app_id, build_response.version
            ))
            .map_err(|e| {
                ABError::InternalServerError(format!(
                    "Failed to create content disposition header: {}",
                    e
                ))
            })?,
        )
        .status(actix_web::http::StatusCode::OK))
}
