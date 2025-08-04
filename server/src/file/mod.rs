use std::{fs::File, io::Read};

use actix_web::{
    delete, error, get, patch, post, web::{self, Json, Path, Query, ReqData}, HttpResponse, Result, Scope
};
use actix_multipart::form::{tempfile::TempFile, MultipartForm};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::task;
use uuid::Uuid;
use chrono::Utc;
use zip::ZipArchive;
mod utils;

use crate::{
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    types::AppState,
    utils::{
        db::{
            models::{FileEntry as DbFile, NewFileEntry},
            schema::hyperotaserver::files::dsl::*,
        },
        s3::{push_file, push_file_byte_arr},
    },
};

#[derive(Serialize, Deserialize)]
struct FileRequest {
    file_path: String,
    url: String,
    version: i32,
    metadata: Option<Value>,
}

#[derive(Serialize, Deserialize)]
struct BulkFileRequest {
    files: Vec<FileRequest>,
    skip_duplicates: bool,
}

#[derive(Serialize, Deserialize)]
struct UpdateFileRequest {
    url: Option<String>,
    version: Option<i32>,
    size: Option<i64>,
    checksum: Option<String>,
    metadata: Option<Value>,
}

#[derive(Serialize, Deserialize)]
enum FileStatus {
    Pending,
    Ready,
}

impl ToString for FileStatus {
    fn to_string(&self) -> String {
        match self {
            FileStatus::Pending => "pending".to_string(),
            FileStatus::Ready => "ready".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct FileResponse {
    pub id: String,
    pub file_path: String,
    pub url: String,
    pub version: i32,
    pub size: i64,
    pub checksum: String,
    pub metadata: Value,
    pub status: FileStatus,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
struct FileListResponse {
    files: Vec<FileResponse>,
    total: usize,
    page: Option<u32>,
    per_page: Option<u32>,
}

#[derive(Serialize, Deserialize)]
struct BulkFileResponse {
    created_files: Vec<FileResponse>,
    total_created: usize,
}

#[derive(Deserialize)]
struct FileListQuery {
    page: Option<u32>,
    per_page: Option<u32>,
    search: Option<String>,
}

#[derive(MultipartForm)]
struct UploadFileRequest {
    file: TempFile,
    file_path: actix_multipart::form::text::Text<String>,
    version: actix_multipart::form::text::Text<i32>,
}

#[derive(MultipartForm)]
struct UploadBulkFilesRequest {
    file: TempFile,
    skip_duplicates: actix_multipart::form::text::Text<bool>,
}

#[derive(Deserialize)]
struct UploadBulkMapping {
    file_name: String,
    file_path: String,
    version: i32,
    metadata: Option<Value>,
}

#[derive(Serialize)]
struct BulkFileUploadResponse {
    uploaded: Vec<FileResponse>,
    skipped: Vec<String>,
}

#[derive(Serialize)]
struct SuccessResponse {
    message: String,
    success: bool,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_file)
        .service(bulk_create_files)
        .service(upload_file)
        .service(upload_bulk_files)
        .service(list_files)
        .service(get_file)
        .service(update_file)
        .service(delete_file)
}

fn db_file_to_response(file: DbFile) -> FileResponse {
    FileResponse {
        id: file.id.to_string(),
        file_path: file.file_path,
        url: file.url,
        version: file.version,
        size: file.size,
        checksum: file.checksum,
        metadata: file.metadata,
        status: if file.size > 0 {
            FileStatus::Ready
        } else {
            FileStatus::Pending
        },
        created_at: file.created_at.to_rfc3339(),
    }
}

#[post("/create")]
async fn create_file(
    req: Json<FileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<FileResponse>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Check for duplicate file_path
    let existing_file = files
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .filter(file_path.eq(&req.file_path))
        .filter(version.eq(req.version))
        .select(DbFile::as_select())
        .first::<DbFile>(&mut conn)
        .optional()
        .map_err(error::ErrorInternalServerError)?;

    if existing_file.is_some() {
        return Err(error::ErrorConflict(format!(
            "File with file_path '{}' already exists",
            req.file_path
        )));
    }

    let (file_size, file_checksum) = utils::download_and_checksum(&req.url.clone()).await?;

    // Create new file
    let new_file = NewFileEntry {
        app_id: application,
        org_id: organisation,
        url: req.url.clone(),
        file_path: req.file_path.clone(),
        version: req.version,
        size: file_size as i64,
        checksum: file_checksum,
        metadata: req.metadata.clone().unwrap_or_else(|| json!({})),
        created_at: Utc::now(),
    };

    let created_file = diesel::insert_into(files)
        .values(&new_file)
        .returning(DbFile::as_returning())
        .get_result::<DbFile>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(db_file_to_response(created_file)))
}

#[post("/bulk")]
async fn bulk_create_files(
    req: Json<BulkFileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let mut created_files = Vec::new();
    let mut new_files = Vec::new();

    // Prepare new files for bulk insert
    for file_req in &req.files {
        // Check for duplicate file_path
        let existing_file = files
            .filter(org_id.eq(&organisation))
            .filter(app_id.eq(&application))
            .filter(file_path.eq(&file_req.file_path))
            .filter(version.eq(file_req.version))
            .select(DbFile::as_select())
            .first::<DbFile>(&mut conn)
            .optional()
            .map_err(error::ErrorInternalServerError)?;

        if existing_file.is_some() {
            if req.skip_duplicates {
                continue;
            }
            return Err(error::ErrorConflict(format!(
                "A file with file_path '{}' already exists with same version '{}'",
                file_req.file_path, file_req.version
            )));
        }

        let new_file = NewFileEntry {
            app_id: application.clone(),
            org_id: organisation.clone(),
            url: file_req.url.clone(),
            file_path: file_req.file_path.clone(),
            version: file_req.version,
            size: 0,
            checksum: "".to_string(),
            metadata: file_req.metadata.clone().unwrap_or_else(|| json!({})),
            created_at: Utc::now(),
        };

        new_files.push(new_file);
    }

    // Bulk insert
    if !new_files.is_empty() {
        let inserted_files = diesel::insert_into(files)
            .values(&new_files)
            .returning(DbFile::as_returning())
            .get_results::<DbFile>(&mut conn)
            .map_err(error::ErrorInternalServerError)?;

        created_files = inserted_files
            .clone()
            .into_iter()
            .map(db_file_to_response)
            .collect();

        for res in inserted_files.iter() {
            let pool = state.db_pool.clone();
            let file_url = res.url.clone();
            let res_id = res.id;
            task::spawn(async move {
                if let Ok((file_size, file_checksum)) = utils::download_and_checksum(&file_url).await {
                    if let Ok(mut conn) = pool.get() {
                        let _ = diesel::update(files.find(res_id))
                            .set((
                                size.eq(file_size as i64),
                                checksum.eq(file_checksum),
                            ))
                            .execute(&mut conn);
                    }
                }
            });
        }
    }

    let response = BulkFileResponse {
        total_created: created_files.len(),
        created_files,
    };

    Ok(HttpResponse::Accepted().json(response))
}

#[get("/{file_id}")]
async fn get_file(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<FileResponse>, actix_web::Error> {
    let file_id = path.into_inner();
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, READ)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, READ)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Parse UUID
    let file_uuid = Uuid::parse_str(&file_id)
        .map_err(|_| error::ErrorBadRequest("Invalid file ID format"))?;

    // Get the file
    let file = files
        .filter(id.eq(file_uuid))
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .select(DbFile::as_select())
        .first::<DbFile>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("File with ID '{}' not found", file_id)))?;

    Ok(Json(db_file_to_response(file)))
}

#[get("/list")]
async fn list_files(
    query: Query<FileListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<FileListResponse>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, READ)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, READ)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Build base query with filters
    let base_query = files
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application));

    // Apply search filter if provided
    let search_filter = if let Some(search_term) = &query.search {
        let search_pattern = format!("%{}%", search_term);
        Some((search_pattern.clone(), search_pattern))
    } else {
        None
    };

    // Get total count
    let total = if let Some((ref pattern1, ref pattern2)) = search_filter {
        base_query
            .filter(
                file_path.ilike(pattern1)
                    .or(url.ilike(pattern2))
            )
            .count()
            .get_result::<i64>(&mut conn)
            .map_err(error::ErrorInternalServerError)? as usize
    } else {
        base_query
            .count()
            .get_result::<i64>(&mut conn)
            .map_err(error::ErrorInternalServerError)? as usize
    };

    // Apply pagination
    let page = query.page.unwrap_or(1);
    let per_page = query.per_page.unwrap_or(50).min(200); // Max 200 per page
    let offset = ((page - 1) * per_page) as i64;

    // Build the final query for data
    let file_list = if let Some((ref pattern1, ref pattern2)) = search_filter {
        base_query
            .filter(
                file_path.ilike(pattern1)
                    .or(url.ilike(pattern2))
            )
            .order(created_at.desc())
            .limit(per_page as i64)
            .offset(offset)
            .select(DbFile::as_select())
            .load::<DbFile>(&mut conn)
            .map_err(error::ErrorInternalServerError)?
    } else {
        base_query
            .order(created_at.desc())
            .limit(per_page as i64)
            .offset(offset)
            .select(DbFile::as_select())
            .load::<DbFile>(&mut conn)
            .map_err(error::ErrorInternalServerError)?
    };

    let files_response = file_list
        .into_iter()
        .map(db_file_to_response)
        .collect();

    Ok(Json(FileListResponse {
        files: files_response,
        total,
        page: Some(page),
        per_page: Some(per_page),
    }))
}

#[patch("/{file_id}")]
async fn update_file(
    path: Path<String>,
    req: Json<UpdateFileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<FileResponse>, actix_web::Error> {
    let file_id = path.into_inner();
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Parse UUID
    let file_uuid = Uuid::parse_str(&file_id)
        .map_err(|_| error::ErrorBadRequest("Invalid file ID format"))?;

    // Check if file exists and belongs to the user
    let _existing_file = files
        .filter(id.eq(file_uuid))
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .select(DbFile::as_select())
        .first::<DbFile>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("File with ID '{}' not found", file_id)))?;

    if req.url.is_some() || req.version.is_some() || req.size.is_some() || req.checksum.is_some() || req.metadata.is_some() {
        if let Some(new_url) = &req.url {
            let (file_size, file_checksum) = utils::download_and_checksum(new_url).await?;

            diesel::update(files.filter(id.eq(file_uuid)))
                .set((
                    url.eq(new_url),
                    size.eq(file_size as i64),
                    checksum.eq(file_checksum),
                ))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
        
        if let Some(new_metadata) = &req.metadata {
            diesel::update(files.filter(id.eq(file_uuid)))
                .set(metadata.eq(new_metadata))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
    }

    // Get updated file
    let updated_file = files
        .filter(id.eq(file_uuid))
        .select(DbFile::as_select())
        .first::<DbFile>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(db_file_to_response(updated_file)))
}

#[delete("/{file_id}")]
async fn delete_file(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<SuccessResponse>, actix_web::Error> {
    let file_id = path.into_inner();
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    // Parse UUID
    let file_uuid = Uuid::parse_str(&file_id)
        .map_err(|_| error::ErrorBadRequest("Invalid file ID format"))?;

    // Delete the file
    let deleted_rows = diesel::delete(
        files
            .filter(id.eq(file_uuid))
            .filter(org_id.eq(&organisation))
            .filter(app_id.eq(&application))
    )
    .execute(&mut conn)
    .map_err(error::ErrorInternalServerError)?;

    if deleted_rows == 0 {
        return Err(error::ErrorNotFound(format!("File with ID '{}' not found", file_id)));
    }

    Ok(Json(SuccessResponse {
        message: format!("File with ID '{}' deleted successfully", file_id),
        success: true,
    }))
}

#[post("/upload")]
async fn upload_file(
    MultipartForm(form): MultipartForm<UploadFileRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<FileResponse>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let file_path_str = form.file_path.into_inner();
    let uploaded_file = form.file;

    if file_path_str.is_empty() {
        return Err(error::ErrorBadRequest("File path cannot be empty"));
    }

    let existing_file = files
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .filter(file_path.eq(&file_path_str))
        .filter(version.eq(form.version.clone()))
        .select(DbFile::as_select())
        .first::<DbFile>(&mut conn)
        .optional()
        .map_err(error::ErrorInternalServerError)?;

    if existing_file.is_some() {
        return Err(error::ErrorConflict(format!(
            "File with file_path '{}' already exists",
            file_path_str
        )));
    }

    let new_file = NewFileEntry {
        app_id: application.clone(),
        org_id: organisation.clone(),
        url: "".to_string(),
        file_path: file_path_str.clone(),
        version: form.version.clone(),
        size: 0,
        checksum: "".to_string(),
        metadata: json!({}),
        created_at: Utc::now(),
    };

    let created_file = diesel::insert_into(files)
        .values(&new_file)
        .returning(DbFile::as_returning())
        .get_result::<DbFile>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;
    
    let file_data = tokio::fs::read(uploaded_file.file.path()).await
        .map_err(error::ErrorInternalServerError)?;
    
    let file_size = file_data.len() as i64;

    let calculated_checksum = utils::calculate_checksum(file_data.clone()).await;

    let file_name = std::path::Path::new(&file_path_str)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&file_path_str);
    
    let s3_path = utils::create_s3_file_path(
        &organisation,
        &application,
        &created_file.id.to_string(),
        &created_file.version.to_string(),
        file_name
    );

    let s3_client = &state.s3_client;
    
    match push_file(
        s3_client,
        state.env.bucket_name.clone(),
        uploaded_file,
        s3_path.clone(),
    ).await {
        Ok(obj) => {
            println!("File uploaded successfully: {:?}", obj);
            let file_url = utils::create_s3_file_url(
                &state.env.bucket_name,
                &s3_path
            );

            diesel::update(files.filter(id.eq(created_file.id)))
                .set((
                    url.eq(file_url),
                    size.eq(file_size),
                    checksum.eq(calculated_checksum),
                ))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;

            Ok(Json(db_file_to_response(created_file)))
        }
        Err(e) => {
            diesel::delete(files.filter(id.eq(created_file.id)))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;

            return Err(error::ErrorInternalServerError(format!(
                "Failed to upload file to S3: {:?}", e
            )));
        }
    }
}

#[post("/bulk_upload")]
async fn upload_bulk_files(
    MultipartForm(req): MultipartForm<UploadBulkFilesRequest>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, actix_web::Error> {

    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let tmp_path = std::env::temp_dir().join(format!("bulk-{}.zip", Uuid::new_v4()));
    tokio::fs::copy(req.file.file.path(), &tmp_path)
        .await
        .map_err(|e| error::ErrorInternalServerError(e))?;

    let file = File::open(&tmp_path).map_err(error::ErrorInternalServerError)?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| error::ErrorBadRequest(e.to_string()))?;

    let mappings: Vec<UploadBulkMapping> = {
        let mut map_file = archive
            .by_name("mappings.json")
            .map_err(|e| error::ErrorBadRequest(format!("`mappings.json` not found: {:?}", e)))?;
        
        let mut map_contents = String::new();
        map_file
            .read_to_string(&mut map_contents)
            .map_err(|e| error::ErrorInternalServerError(e))?;
        serde_json::from_str(&map_contents).map_err(error::ErrorBadRequest)?
    };

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let mut to_be_uploaded = Vec::new();
    let mut skipped = Vec::new();
    let mut uploaded = Vec::new();

    for m in mappings {
        let existing_file = files
            .filter(org_id.eq(&organisation))
            .filter(app_id.eq(&application))
            .filter(file_path.eq(&m.file_path))
            .filter(version.eq(&m.version))
            .select(DbFile::as_select())
            .first::<DbFile>(&mut conn)
            .optional()
            .map_err(error::ErrorInternalServerError)?;

        if existing_file.is_some() {
            if *req.skip_duplicates {
                skipped.push(m.file_path.clone());
                continue;
            }
            return Err(error::ErrorConflict(format!(
                "A file with file_path '{}' already exists with same version '{}'",
                m.file_path, m.version
            )));
        }

        let new_file = NewFileEntry {
            app_id: application.clone(),
            org_id: organisation.clone(),
            url: "".to_string(),
            file_path: m.file_path.clone(),
            version: m.version.clone(),
            size: 0,
            checksum: "".to_string(),
            metadata: m.metadata.clone().unwrap_or_else(|| json!({})),
            created_at: Utc::now(),
        };
        to_be_uploaded.push((m, new_file));
    }

    if !to_be_uploaded.is_empty() {
        let inserted_files = diesel::insert_into(files)
            .values(to_be_uploaded.iter().map(|(_, file)| file).collect::<Vec<_>>())
            .returning(DbFile::as_returning())
            .get_results::<DbFile>(&mut conn)
            .map_err(error::ErrorInternalServerError)?;

        for mapping in to_be_uploaded.iter().map(|(m, _)| m) {

            let created_file = inserted_files
                .iter()
                .find(|f| f.file_path == mapping.file_path && f.version == mapping.version)
                .ok_or_else(|| error::ErrorInternalServerError("File not found after insert"))?;

            let mut entry = archive
                .by_name(&mapping.file_name)
                .map_err(|_| error::ErrorBadRequest(format!("{} not in archive", mapping.file_name)))?;

            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(error::ErrorInternalServerError)?;

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
                file_name
            );
            
            match push_file_byte_arr(
                &state.s3_client,
                state.env.bucket_name.clone(),
                buf,
                s3_path.clone(),
            ).await {
                Ok(_) => {
                    let file_url = utils::create_s3_file_url(
                        &state.env.bucket_name,
                        &s3_path
                    );

                    diesel::update(files.filter(id.eq(created_file.id)))
                        .set((
                            url.eq(file_url),
                            size.eq(file_size),
                            checksum.eq(file_checksum),
                        ))
                        .execute(&mut conn)
                        .map_err(error::ErrorInternalServerError)?;

                    uploaded.push(db_file_to_response(created_file.clone()));
                }
                Err(e) => {
                    diesel::delete(files.filter(id.eq(created_file.id)))
                        .execute(&mut conn)
                        .map_err(error::ErrorInternalServerError)?;
                    return Err(error::ErrorInternalServerError(format!(
                        "Failed to upload file to S3: {:?}", e
                    )));
                }
            }
        }
    }

    Ok(HttpResponse::Ok().json(BulkFileUploadResponse{ uploaded, skipped }))
}