pub mod types;
pub mod utils;

use std::{fs::File, io::Read};

use actix_multipart::form::MultipartForm;
use actix_web::{
    error::PayloadError,
    get, patch, post,
    web::{self, Json, Path, Payload, Query, ReqData},
    Scope,
};
use aws_sdk_s3::primitives::ByteStream;
use chrono::Utc;
use diesel::dsl::{count_distinct, count_star, max};
use diesel::prelude::*;
use futures_util::StreamExt;
use http::HeaderValue;
use log::info;
use serde_json::json;
use std::str::FromStr;
use tokio::sync::mpsc;
use tokio::task;
use uuid::Uuid;
use zip::ZipArchive;

use crate::{
    file::types::*,
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ, WRITE},
    run_blocking, types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::{
        db::{
            models::{FileEntry as DbFile, NewFileEntry},
            schema::hyperotaserver::files::dsl::*,
        },
        s3::{push_file_byte_arr, stream_file},
    },
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_file)
        .service(bulk_create_files)
        .service(upload_file)
        .service(upload_bulk_files)
        .service(list_files)
        .service(get_file)
        .service(update_file)
        .service(list_versions_for_file)
}

fn db_file_to_response(file: &DbFile) -> FileResponse {
    FileResponse {
        id: format!("{}@version:{}", file.file_path, file.version),
        file_path: file.file_path.clone(),
        url: file.url.clone(),
        version: file.version,
        tag: file.tag.clone(),
        size: file.size,
        checksum: file.checksum.clone(),
        metadata: file.metadata.clone(),
        status: if file.size > 0 {
            FileStatus::Ready
        } else {
            FileStatus::Pending
        },
        created_at: file.created_at.to_rfc3339(),
    }
}

#[post("")]
async fn create_file(
    req: Json<FileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileResponse>> {
    let auth_response = auth_response.into_inner();

    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let (file_size, file_checksum) = match (&req.size, &req.checksum) {
        (Some(provided_size), Some(provided_checksum)) => {
            info!("Using provided size and checksum");

            // Validate checksum format (SHA256 hex should be 64 characters)
            if provided_checksum.len() != 64 {
                return Err(ABError::BadRequest(
                    "Checksum must be exactly 64 characters (SHA256 hex)".to_string(),
                ));
            }

            // Validate checksum is valid hexadecimal
            if !provided_checksum.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(ABError::BadRequest(
                    "Checksum must contain only hexadecimal characters (0-9, a-f, A-F)".to_string(),
                ));
            }

            if *provided_size == 0 {
                return Err(ABError::BadRequest(
                    "Size must be greater than 0".to_string(),
                ));
            }

            (*provided_size, provided_checksum.to_lowercase())
        }
        (None, None) => {
            info!("Downloading file to calculate size and checksum");
            utils::download_and_checksum(&req.url.clone())
                .await
                .map_err(|_| {
                    info!("Download or checksum calculation failed");
                    ABError::InternalServerError("Download or checksum failure".to_string())
                })?
        }
        _ => {
            return Err(ABError::BadRequest(
                "Both size and checksum must be provided together, or neither".to_string(),
            ));
        }
    };

    let pool = state.db_pool.clone();
    let request = req.into_inner();

    let created_file = run_blocking!({
        let mut conn = pool.get()?;

        let existing_file = files
            .filter(org_id.eq(&organisation))
            .filter(app_id.eq(&application))
            .filter(file_path.eq(&request.file_path))
            .filter(tag.is_not_distinct_from(&request.tag))
            .select(DbFile::as_select())
            .first::<DbFile>(&mut conn)
            .optional()?;

        if let Some(existing) = &existing_file {
            if request.tag.is_some() {
                if existing.checksum != file_checksum || existing.url != request.url {
                    return Err(ABError::BadRequest(format!(
                        "File with file_path '{}' and tag '{}' already exists with different checksum or URL",
                        request.file_path, request.tag.as_ref().unwrap()
                    )));
                }
                info!("Existing file matches request, returning existing file");
                return Ok(existing.clone());
            } else if existing.checksum == file_checksum && existing.url == request.url {
                info!("Existing file matches request (no tag), returning existing file");
                return Ok(existing.clone());
            }
        } else {
            info!("No existing file found, creating new entry");
        }

        let result = conn.transaction::<DbFile, diesel::result::Error, _>(|conn| {
            let latest_file = files
                .filter(file_path.eq(&request.file_path))
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .order(version.desc())
                .select(DbFile::as_select())
                .for_update()
                .first::<DbFile>(conn)
                .optional()?;

            let latest_version = latest_file.map_or(0, |f| f.version);

            let new_file = NewFileEntry {
                app_id: application.clone(),
                org_id: organisation.clone(),
                url: request.url.clone(),
                file_path: request.file_path.clone(),
                version: latest_version + 1,
                tag: request.tag.clone(),
                size: file_size as i64,
                checksum: file_checksum,
                metadata: request.metadata.clone().unwrap_or_else(|| json!({})),
                created_at: Utc::now(),
            };

            diesel::insert_into(files)
                .values(&new_file)
                .returning(DbFile::as_returning())
                .get_result::<DbFile>(conn)
        })?;
        Ok(result)
    })?;

    Ok(Json(db_file_to_response(&created_file)))
}

#[post("/bulk")]
async fn bulk_create_files(
    req: Json<BulkFileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<BulkFileResponse>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let pool = state.db_pool.clone();
    let request = req.into_inner();

    let (inserted_files, skipped_files) = run_blocking!({
        let mut conn = pool.get()?;

        let mut new_files = Vec::new();
        let mut skipped_files = Vec::new();

        let result = conn.transaction::<Vec<DbFile>, diesel::result::Error, _>(|conn| {
            for file_req in &request.files {
                let existing_file = files
                    .filter(org_id.eq(&organisation))
                    .filter(app_id.eq(&application))
                    .filter(file_path.eq(&file_req.file_path))
                    .filter(tag.eq(&file_req.tag))
                    .select(DbFile::as_select())
                    .first::<DbFile>(conn)
                    .optional()?;

                if existing_file.is_some() {
                    if request.skip_duplicates {
                        skipped_files.push(file_req.file_path.clone());
                        continue;
                    }
                    return Err(diesel::result::Error::DatabaseError(
                        diesel::result::DatabaseErrorKind::UniqueViolation,
                        Box::new(format!(
                            "A file with file_path '{}' already exists with same tag ",
                            file_req.file_path
                        )),
                    ));
                }

                let latest_file = files
                    .filter(file_path.eq(&file_req.file_path))
                    .filter(org_id.eq(&organisation))
                    .filter(app_id.eq(&application))
                    .order(version.desc())
                    .select(DbFile::as_select())
                    .for_update()
                    .first::<DbFile>(conn)
                    .optional()?;

                let latest_version = latest_file.map_or(0, |f| f.version);

                let new_file = NewFileEntry {
                    app_id: application.clone(),
                    org_id: organisation.clone(),
                    url: file_req.url.clone(),
                    file_path: file_req.file_path.clone(),
                    version: latest_version + 1,
                    tag: file_req.tag.clone(),
                    size: 0,
                    checksum: "".to_string(),
                    metadata: file_req.metadata.clone().unwrap_or_else(|| json!({})),
                    created_at: Utc::now(),
                };

                new_files.push(new_file);
            }

            diesel::insert_into(files)
                .values(&new_files)
                .returning(DbFile::as_returning())
                .get_results::<DbFile>(conn)
        })?;

        Ok((result, skipped_files))
    })?;

    let created_files: Vec<FileResponse> = inserted_files
        .clone()
        .into_iter()
        .map(|f| db_file_to_response(&f))
        .collect();

    for res in inserted_files.iter() {
        let pool = state.db_pool.clone();
        let file_url = res.url.clone();
        let res_id = res.id;
        task::spawn(async move {
            if let Ok((file_size, file_checksum)) = utils::download_and_checksum(&file_url).await {
                let mut conn = pool.get()?;
                diesel::update(files.find(res_id))
                    .set((size.eq(file_size as i64), checksum.eq(file_checksum)))
                    .execute(&mut conn)?;
                Ok(())
            } else {
                Err(ABError::InternalServerError(
                    "Failed to download file".into(),
                ))
            }
        });
    }

    let response = BulkFileResponse {
        total_skipped: skipped_files.len(),
        total_created: created_files.len(),
        created_files,
        skipped_files,
    };

    Ok(WithHeaders::new(Json(response))
        .header(
            actix_web::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        )
        .status(actix_web::http::StatusCode::ACCEPTED))
}

/// Retrieves a file by its Key.
/// The Key is expected to be in the format "$file_path@version:$version_number" or "$file_path@tag:$tag".
#[get("")]
async fn get_file(
    query: Query<GetFileQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileResponse>> {
    let file_id = query.file_key.clone();
    if file_id.is_empty() {
        return Err(ABError::BadRequest("File key cannot be empty".to_string()));
    }

    let (input_file_path, file_version, mut file_tag) = utils::parse_file_key(&file_id);

    if input_file_path.is_empty() {
        return Err(ABError::BadRequest("File path cannot be empty".to_string()));
    }

    if file_tag.is_none() && file_version.is_none() {
        file_tag = Some("latest".to_string());
    }

    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let pool = state.db_pool.clone();

    let file = run_blocking!({
        let mut conn = pool.get()?;

        let result = if let Some(f_version) = file_version {
            files
                .filter(file_path.eq(&input_file_path))
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .filter(version.eq(f_version))
                .select(DbFile::as_select())
                .first::<DbFile>(&mut conn)
                .map_err(|_| ABError::NotFound(format!("File with ID '{}' not found", file_id)))?
        } else if let Some(f_tag) = file_tag {
            files
                .filter(file_path.eq(&input_file_path))
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .filter(tag.eq(f_tag))
                .select(DbFile::as_select())
                .first::<DbFile>(&mut conn)
                .map_err(|_| ABError::NotFound(format!("File with ID '{}' not found", file_id)))?
        } else {
            return Err(ABError::BadRequest(
                "File key must contain a version or tag".to_string(),
            ));
        };
        Ok(result)
    })?;

    Ok(Json(db_file_to_response(&file)))
}

#[get("/list")]
async fn list_files(
    pagination_query: Query<PaginatedQuery>,
    file_query: Query<FileListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<FileListItem>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let pool = state.db_pool.clone();

    let search_term = file_query.search.clone();

    let response = run_blocking!({
        let mut conn = pool.get()?;

        let build_base_query = || {
            let mut base_query = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .group_by(file_path)
                .select((file_path, max(version).assume_not_null(), count_star()))
                .order_by(file_path.asc())
                .into_boxed();

            if let Some(ref term) = search_term {
                let pattern = format!("%{}%", term);
                base_query = base_query.filter(
                    file_path
                        .ilike(pattern.clone())
                        .or(url.ilike(pattern.clone())),
                );
            }

            base_query
        };

        match *pagination_query {
            PaginatedQuery::All => {
                let results: Vec<FileSummary> =
                    build_base_query().load::<FileSummary>(&mut conn)?;

                let data = results
                    .into_iter()
                    .map(|file| FileListItem {
                        id: format!("{}@version:{}", file.file_path, file.latest_version),
                        file_path: file.file_path,
                        latest_version: file.latest_version,
                        total_versions: file.total_versions,
                    })
                    .collect();

                Ok(PaginatedResponse::all(data))
            }
            PaginatedQuery::Paginated { page, count } => {
                let mut count_query = files
                    .filter(org_id.eq(&organisation))
                    .filter(app_id.eq(&application))
                    .into_boxed();

                if let Some(ref term) = search_term {
                    let pattern = format!("%{}%", term);
                    count_query = count_query.filter(
                        file_path
                            .ilike(pattern.clone())
                            .or(url.ilike(pattern.clone())),
                    );
                }

                let total_count: i64 = count_query
                    .select(count_distinct(file_path))
                    .first::<i64>(&mut conn)?;

                let page = page as i64;
                let count = count as i64;
                let offset = (page - 1) * count;

                let results: Vec<FileSummary> = build_base_query()
                    .offset(offset)
                    .limit(count)
                    .load::<FileSummary>(&mut conn)?;

                let data = results
                    .into_iter()
                    .map(|file| FileListItem {
                        id: format!("{}@version:{}", file.file_path, file.latest_version),
                        file_path: file.file_path,
                        latest_version: file.latest_version,
                        total_versions: file.total_versions,
                    })
                    .collect();
                let total_pages = (total_count + count - 1) / count;
                Ok(PaginatedResponse {
                    data,
                    total_items: total_count as u64,
                    total_pages: total_pages as u32,
                })
            }
        }
    })?;

    Ok(Json(response))
}

/// Updates a file's tag
/// File Key is expected to be in the format "$file_path@version:$version_number" or "$file_path@tag:$tag".
#[patch("/{file_key}")]
async fn update_file(
    path: Path<String>,
    req: Json<UpdateFileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileResponse>> {
    let file_id = path.into_inner();
    let (input_file_path, file_version, file_tag) = utils::parse_file_key(&file_id);

    if input_file_path.is_empty() {
        return Err(ABError::BadRequest("File path cannot be empty".to_string()));
    }

    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let pool = state.db_pool.clone();
    let request = req.into_inner();

    let file = run_blocking!({
        let mut conn = pool.get()?;

        let result = conn.transaction::<DbFile, diesel::result::Error, _>(|conn| {
            let file_in_db = if let Some(f_version) = file_version {
                files
                    .filter(file_path.eq(&input_file_path))
                    .filter(org_id.eq(&organisation))
                    .filter(app_id.eq(&application))
                    .filter(version.eq(f_version))
                    .select(DbFile::as_select())
                    .first::<DbFile>(conn)?
            } else if let Some(f_tag) = file_tag {
                files
                    .filter(file_path.eq(&input_file_path))
                    .filter(org_id.eq(&organisation))
                    .filter(app_id.eq(&application))
                    .filter(tag.eq(f_tag))
                    .select(DbFile::as_select())
                    .first::<DbFile>(conn)?
            } else {
                return Err(diesel::result::Error::NotFound);
            };

            diesel::update(files.filter(id.eq(file_in_db.id)))
                .set(tag.eq(&request.tag))
                .execute(conn)?;

            files
                .filter(id.eq(file_in_db.id))
                .select(DbFile::as_select())
                .first::<DbFile>(conn)
        })?;

        Ok(result)
    })?;

    Ok(Json(db_file_to_response(&file)))
}

#[post("/upload")]
async fn upload_file(
    req: actix_web::HttpRequest,
    mut payload: Payload,
    query: Query<UploadFileQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileResponse>> {
    let auth_response = auth_response.into_inner();

    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let file_path_str = query.file_path.clone();
    let tag_str = query.tag.clone();

    let file_size = req
        .headers()
        .get("Content-Length")
        .ok_or_else(|| ABError::BadRequest("Missing Content-Length header".to_string()))?
        .to_str()
        .map_err(|_| ABError::BadRequest("Invalid Content-Length header".to_string()))?
        .parse::<i64>()
        .map_err(|_| ABError::BadRequest("Content-Length is not a valid number".to_string()))?;

    let b64_file_checksum = req
        .headers()
        .get("x-checksum")
        .ok_or_else(|| ABError::BadRequest("Missing x-checksum header".to_string()))?
        .to_str()
        .map_err(|_| ABError::BadRequest("Invalid x-checksum header".to_string()))?
        .to_string();

    if file_path_str.is_empty() {
        info!("Rejected upload: empty file_path");
        return Err(ABError::BadRequest("File path cannot be empty".to_string()));
    }

    let pool = state.db_pool.clone();

    let existing_file = {
        let pool_clone = pool.clone();
        let org = organisation.clone();
        let app = application.clone();
        let fp = file_path_str.clone();
        let tg = tag_str.clone();
        let b64_fc = b64_file_checksum.clone();
        let fc = utils::base64_to_hex(&b64_fc);

        let file = run_blocking!({
            let mut conn = pool_clone.get()?;

            info!("Checking for existing file in DB");

            let existing_file = files
                .filter(org_id.eq(&org))
                .filter(app_id.eq(&app))
                .filter(file_path.eq(&fp))
                .filter(tag.is_not_distinct_from(&tg))
                .select(DbFile::as_select())
                .first::<DbFile>(&mut conn)
                .optional()
                .map_err(|e| {
                    info!("DB query failed: {:?}", e);
                    ABError::InternalServerError("DB Error".to_string())
                })?;

            match &existing_file {
                Some(file) => {
                    info!(
                        "Found existing file in DB: id={}, checksum={}",
                        file.file_path, file.checksum
                    );
                    if tg.is_some() {
                        if file.checksum != fc {
                            info!(
                            "Checksum mismatch for file_path '{}' and tag '{}': existing={} vs incoming={}",
                            fp,
                            tg.as_ref().unwrap(),
                            file.checksum,
                            fc
                        );
                            return Err(ABError::BadRequest(format!(
                            "File with file_path '{}' and tag '{}' already exists with different checksum or URL",
                            fp,
                            tg.as_ref().unwrap()
                        )));
                        }
                        info!("Checksum matches for tagged file, returning existing");
                        return Ok(Some(file.clone()));
                    } else if file.checksum == fc {
                        info!("Checksum matches for untagged file, returning existing");
                        return Ok(Some(file.clone()));
                    } else {
                        info!("Checksum differs for untagged file, will create new version");
                    }
                }
                None => info!("No existing file found in DB"),
            }

            Ok(None)
        })?;
        file
    };

    if let Some(existing_file) = existing_file {
        info!("Returning existing file: id={}", existing_file.id);
        return Ok(Json(db_file_to_response(&existing_file)));
    }

    let created_file = {
        let pool_clone = pool.clone();
        let org = organisation.clone();
        let app = application.clone();
        let fp = file_path_str.clone();
        let tg = tag_str.clone();

        let file = run_blocking!({
            let mut conn = pool_clone.get()?;

            info!("Starting DB transaction for new file creation");
            let created_file = conn
                .transaction::<DbFile, diesel::result::Error, _>(|conn| {
                    let latest_file = files
                        .filter(file_path.eq(&fp))
                        .filter(org_id.eq(&org))
                        .filter(app_id.eq(&app))
                        .order(version.desc())
                        .select(DbFile::as_select())
                        .for_update()
                        .first::<DbFile>(conn)
                        .optional()?;

                    let next_version = latest_file.map_or(1, |f| f.version + 1);

                    let new_file = NewFileEntry {
                        app_id: app.clone(),
                        org_id: org.clone(),
                        url: "".to_string(),
                        file_path: fp.clone(),
                        tag: tg.clone(),
                        version: next_version,
                        size: 0,
                        checksum: "".to_string(),
                        metadata: json!({}),
                        created_at: Utc::now(),
                    };

                    diesel::insert_into(files)
                        .values(&new_file)
                        .returning(DbFile::as_returning())
                        .get_result::<DbFile>(conn)
                })
                .map_err(|_| {
                    ABError::InternalServerError("DBError: Failed to create file".to_string())
                })?;

            Ok(created_file)
        })?;
        file
    };

    let s3_path = utils::create_s3_file_path(
        &organisation,
        &application,
        &created_file.id.to_string(),
        &created_file.version.to_string(),
        &file_path_str,
    );

    let s3_path_clone = s3_path.clone();
    let (tx, rx) = mpsc::unbounded_channel::<types::ReadResult>();
    let byte_stream = ByteStream::from_body_1_x(types::FileStream(rx));
    let bucket_name = state.env.bucket_name.clone();
    let s3_client = state.s3_client.clone();
    let b64_fc = b64_file_checksum.clone();
    let handle = tokio::spawn(async move {
        info!("Starting S3 streaming task");
        stream_file(
            &s3_client,
            bucket_name,
            byte_stream,
            s3_path_clone,
            file_size,
            b64_fc.clone(),
        )
        .await
    });

    while let Some(result) = payload.next().await {
        match result {
            Ok(chunk) => {
                let _ = tx.send(Ok(chunk));
            }
            Err(PayloadError::Overflow) => {
                info!("Payload overflow during upload");
            }
            Err(e) => {
                info!("Error while reading upload payload: {:?}", e);
                let _ = tx.send(Err(e));
            }
        }
    }

    let full_url = format!("{}/{}", &state.env.public_url, &s3_path);

    let result = handle.await;
    match result {
        Ok(inner_result) => match inner_result {
            Ok(_) => {
                info!("✅ Upload to S3 completed successfully");
                let checksum_hex = utils::base64_to_hex(&b64_file_checksum);

                let updated_file = run_blocking!({
                    let mut conn = pool.get()?;
                    let updated_file = diesel::update(files.filter(id.eq(created_file.id)))
                        .set((
                            url.eq(full_url),
                            size.eq(file_size),
                            checksum.eq(checksum_hex),
                        ))
                        .get_result::<DbFile>(&mut conn)
                        .map_err(|_| ABError::InternalServerError("DB Error".to_string()))?;
                    Ok(updated_file)
                })?;

                Ok(Json(db_file_to_response(&updated_file)))
            }
            Err(e) => {
                info!("❌ Upload to S3 failed: {:?}", e);
                run_blocking!({
                    let mut conn = pool.get()?;
                    diesel::delete(files.filter(id.eq(created_file.id)))
                        .execute(&mut conn)
                        .map_err(|_| ABError::InternalServerError("DB Error".to_string()))?;
                    Ok(())
                })?;
                Err(ABError::InternalServerError(format!(
                    "Failed to upload file to S3: {:?}",
                    e
                )))
            }
        },
        Err(e) => {
            info!("❌ Upload task join error: {:?}", e);
            let file_id = created_file.id;
            let _ = run_blocking!({
                let mut conn = pool.get()?;
                diesel::delete(files.filter(id.eq(file_id))).execute(&mut conn)?;
                Ok(())
            });
            Err(ABError::InternalServerError(format!(
                "Failed to upload file to S3: {:?}",
                e
            )))
        }
    }
}

#[post("/bulk_upload")]
async fn upload_bulk_files(
    MultipartForm(req): MultipartForm<UploadBulkFilesRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<BulkFileUploadResponse>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let tmp_path = std::env::temp_dir().join(format!("bulk-{}.zip", Uuid::new_v4()));
    tokio::fs::copy(req.file.file.path(), &tmp_path)
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    let file = File::open(&tmp_path).map_err(|e| ABError::InternalServerError(e.to_string()))?;
    let mut archive = ZipArchive::new(file).map_err(|e| ABError::BadRequest(e.to_string()))?;

    let mappings: Vec<UploadBulkMapping> = {
        let mut map_file = archive
            .by_name("mappings.json")
            .map_err(|e| ABError::BadRequest(format!("`mappings.json` not found: {:?}", e)))?;

        let mut map_contents = String::new();
        map_file
            .read_to_string(&mut map_contents)
            .map_err(|e| ABError::InternalServerError(e.to_string()))?;
        serde_json::from_str(&map_contents).map_err(|e| ABError::BadRequest(e.to_string()))?
    };

    let pool = state.db_pool.clone();
    let skip_duplicates = *req.skip_duplicates;

    let db_org = organisation.clone();
    let db_app = application.clone();
    let (inserted_files, to_be_uploaded, skipped) = run_blocking!({
        let mut conn = pool.get()?;

        let mut to_be_uploaded = Vec::new();
        let mut skipped = Vec::new();

        for m in mappings {
            let existing_file = files
                .filter(org_id.eq(&db_org))
                .filter(app_id.eq(&db_app))
                .filter(file_path.eq(&m.file_path))
                .filter(version.eq(&m.version))
                .select(DbFile::as_select())
                .first::<DbFile>(&mut conn)
                .optional()?;

            if existing_file.is_some() {
                if skip_duplicates {
                    skipped.push(m.file_path.clone());
                    continue;
                }
                return Err(ABError::BadRequest(format!(
                    "A file with file_path '{}' already exists with same version '{}'",
                    m.file_path, m.version
                )));
            }

            let new_file = NewFileEntry {
                app_id: db_app.clone(),
                org_id: db_org.clone(),
                url: "".to_string(),
                file_path: m.file_path.clone(),
                version: m.version,
                size: 0,
                tag: None,
                checksum: "".to_string(),
                metadata: m.metadata.clone().unwrap_or_else(|| json!({})),
                created_at: Utc::now(),
            };
            to_be_uploaded.push((m, new_file));
        }

        let inserted_files = if !to_be_uploaded.is_empty() {
            diesel::insert_into(files)
                .values(
                    to_be_uploaded
                        .iter()
                        .map(|(_, file)| file)
                        .collect::<Vec<_>>(),
                )
                .returning(DbFile::as_returning())
                .get_results::<DbFile>(&mut conn)?
        } else {
            Vec::new()
        };

        Ok((inserted_files, to_be_uploaded, skipped))
    })?;
    let mut uploaded = Vec::new();

    if !to_be_uploaded.is_empty() {
        for mapping in to_be_uploaded.iter().map(|(m, _)| m) {
            let created_file = inserted_files
                .iter()
                .find(|f| f.file_path == mapping.file_path && f.version == mapping.version)
                .ok_or_else(|| {
                    ABError::InternalServerError("File not found after insert".to_string())
                })?;

            let mut entry = archive.by_name(&mapping.file_name).map_err(|_| {
                ABError::BadRequest(format!("{} not in archive", mapping.file_name))
            })?;

            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| ABError::InternalServerError(e.to_string()))?;

            let file_checksum = utils::calculate_checksum(buf.clone()).await;
            let file_size = buf.len() as i64;

            let file_name = std::path::Path::new(&created_file.file_path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(&created_file.file_path);

            let s3_path = utils::create_s3_file_path(
                &organisation,
                &application,
                &created_file.id.to_string(),
                &created_file.version.to_string(),
                file_name,
            );

            match push_file_byte_arr(
                &state.s3_client,
                state.env.bucket_name.clone(),
                buf,
                s3_path.clone(),
            )
            .await
            {
                Ok(_) => {
                    let file_url = format!("{}/{}", &state.env.public_url, &s3_path,);
                    let pool = state.db_pool.clone();
                    let file_id = created_file.id;

                    run_blocking!({
                        let mut conn = pool.get()?;
                        diesel::update(files.filter(id.eq(file_id)))
                            .set((
                                url.eq(file_url),
                                size.eq(file_size),
                                checksum.eq(file_checksum),
                            ))
                            .execute(&mut conn)?;
                        Ok(())
                    })?;

                    uploaded.push(db_file_to_response(created_file));
                }
                Err(e) => {
                    let pool = state.db_pool.clone();
                    let file_id = created_file.id;

                    let _ = run_blocking!({
                        let mut conn = pool.get()?;
                        diesel::delete(files.filter(id.eq(file_id))).execute(&mut conn)?;
                        Ok(())
                    });

                    return Err(ABError::InternalServerError(format!(
                        "Failed to upload file to S3: {:?}",
                        e
                    )));
                }
            }
        }
    }

    Ok(Json(BulkFileUploadResponse { uploaded, skipped }))
}

#[get("/{filepath}/versions")]
async fn list_versions_for_file(
    path: Path<String>,
    pagination_query: Query<PaginatedQuery>,
    version_query: Query<FileVersionListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<FileVersionListItem>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let decoded_path = urlencoding::decode(&path.into_inner())
        .map_err(|_| ABError::BadRequest("Invalid URL encoding".into()))?
        .into_owned();

    let pool = state.db_pool.clone();
    let search = version_query.search.clone();
    let response: PaginatedResponse<FileVersionListItem> = run_blocking!({
        let mut conn = pool.get()?;

        let build_base_query = || {
            let mut base_query = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .filter(file_path.eq(&decoded_path))
                .into_boxed();

            if let Some(ref search_str) = search {
                let normalized = search_str.trim();
                if !normalized.is_empty() {
                    let mut normalized = normalized.to_string();
                    if let Some(stripped) = normalized.strip_prefix(|c| c == 'v' || c == 'V') {
                        normalized = stripped.to_string();
                    }
                    let pattern = format!("%{}%", normalized);
                    if let Ok(num) = i32::from_str(&normalized) {
                        // Match either numeric version or tag (including null-safe)
                        base_query = base_query.filter(version.eq(num).or(tag.ilike(pattern)));
                    } else {
                        base_query = base_query.filter(tag.ilike(pattern));
                    }
                }
            }
            base_query
        };

        match *pagination_query {
            PaginatedQuery::All => {
                let results = build_base_query()
                    .select((version, tag, created_at))
                    .order_by(version.desc())
                    .load::<FileVersionDBQuery>(&mut conn)?;

                let data = results
                    .into_iter()
                    .map(|row| FileVersionListItem {
                        id: format!("{}@version:{}", decoded_path, row.version),
                        version: row.version,
                        tag: row.tag,
                        created_at: row.created_at.to_string(),
                    })
                    .collect();

                Ok(PaginatedResponse::all(data))
            }
            PaginatedQuery::Paginated { page, count } => {
                let total_count: i64 = build_base_query()
                    .select(count_star())
                    .first::<i64>(&mut conn)?;
                let page = page as i64;
                let count = count as i64;
                let offset = (page - 1) * count;

                let results = build_base_query()
                    .offset(offset)
                    .limit(count)
                    .select((version, tag, created_at))
                    .order_by(version.desc())
                    .load::<FileVersionDBQuery>(&mut conn)?;

                let total_pages = (total_count + count - 1) / count;
                let data = results
                    .into_iter()
                    .map(|row| FileVersionListItem {
                        id: format!("{}@version:{}", decoded_path, row.version),
                        version: row.version,
                        tag: row.tag,
                        created_at: row.created_at.to_string(),
                    })
                    .collect();

                Ok(PaginatedResponse {
                    data,
                    total_items: total_count as u64,
                    total_pages: total_pages as u32,
                })
            }
        }
    })?;

    Ok(Json(response))
}
