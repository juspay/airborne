use actix_web::{
    delete, error, get, patch, post, web::{self, Json, Path, Query, ReqData}, Result, Scope
};
use actix_multipart::form::{tempfile::TempFile, MultipartForm};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use sha2::{Sha256, Digest};

use crate::{
    middleware::auth::{validate_user, AuthResponse, WRITE, READ},
    types::AppState,
    utils::{
        db::{
            models::{Resource as DbResource, NewResource},
            schema::hyperotaserver::resources::dsl::*,
        },
        s3::push_file,
    },
};

#[derive(Serialize, Deserialize)]
struct ResourceRequest {
    file_path: String,
    url: String,
    version: Option<i32>,
    size: Option<i64>,
    checksum: Option<String>,
    metadata: Option<Value>,
}

#[derive(Serialize, Deserialize)]
struct BulkResourceRequest {
    resources: Vec<ResourceRequest>,
}

#[derive(Serialize, Deserialize)]
struct UpdateResourceRequest {
    url: Option<String>,
    version: Option<i32>,
    size: Option<i64>,
    checksum: Option<String>,
    metadata: Option<Value>,
}

#[derive(Serialize, Deserialize)]
struct ResourceResponse {
    pub id: String,
    pub file_path: String,
    pub url: String,
    pub version: i32,
    pub size: i64,
    pub checksum: String,
    pub metadata: Value,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
struct ResourceListResponse {
    resources: Vec<ResourceResponse>,
    total: usize,
    page: Option<u32>,
    per_page: Option<u32>,
}

#[derive(Serialize, Deserialize)]
struct BulkResourceResponse {
    created_resources: Vec<ResourceResponse>,
    total_created: usize,
}

#[derive(Deserialize)]
struct ResourceListQuery {
    page: Option<u32>,
    per_page: Option<u32>,
    search: Option<String>,
}

#[derive(MultipartForm)]
struct UploadResourceRequest {
    file: TempFile,
    file_path: actix_multipart::form::text::Text<String>,
    version: actix_multipart::form::text::Text<i32>,
}

#[derive(Serialize)]
struct SuccessResponse {
    message: String,
    success: bool,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_resource)
        .service(bulk_create_resources)
        .service(upload_resource)
        .service(list_resources)
        .service(get_resource)
        .service(update_resource)
        .service(delete_resource)
}

fn db_resource_to_response(resource: DbResource) -> ResourceResponse {
    ResourceResponse {
        id: resource.id.to_string(),
        file_path: resource.file_path,
        url: resource.url,
        version: resource.version,
        size: resource.size,
        checksum: resource.checksum,
        metadata: resource.metadata,
        created_at: resource.created_at.to_rfc3339(),
    }
}

#[post("/create")]
async fn create_resource(
    req: Json<ResourceRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ResourceResponse>, actix_web::Error> {
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
    let existing_resource = resources
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .filter(file_path.eq(&req.file_path))
        .filter(version.eq(req.version.unwrap_or(0)))
        .select(DbResource::as_select())
        .first::<DbResource>(&mut conn)
        .optional()
        .map_err(error::ErrorInternalServerError)?;

    if existing_resource.is_some() {
        return Err(error::ErrorConflict(format!(
            "Resource with file_path '{}' already exists",
            req.file_path
        )));
    }

    // Create new resource
    let new_resource = NewResource {
        app_id: application,
        org_id: organisation,
        url: req.url.clone(),
        file_path: req.file_path.clone(),
        version: req.version.unwrap_or(1),
        size: req.size.unwrap_or(0),
        checksum: req.checksum.clone().unwrap_or_default(),
        metadata: req.metadata.clone().unwrap_or_else(|| json!({})),
        created_at: Utc::now(),
    };

    let created_resource = diesel::insert_into(resources)
        .values(&new_resource)
        .returning(DbResource::as_returning())
        .get_result::<DbResource>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(db_resource_to_response(created_resource)))
}

#[post("/bulk")]
async fn bulk_create_resources(
    req: Json<BulkResourceRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<BulkResourceResponse>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let mut created_resources = Vec::new();
    let mut new_resources = Vec::new();

    // Prepare new resources for bulk insert
    for resource_req in &req.resources {
        // Check for duplicate file_path
        let existing_resource = resources
            .filter(org_id.eq(&organisation))
            .filter(app_id.eq(&application))
            .filter(file_path.eq(&resource_req.file_path))
            .select(DbResource::as_select())
            .first::<DbResource>(&mut conn)
            .optional()
            .map_err(error::ErrorInternalServerError)?;

        if existing_resource.is_some() {
            continue; // Skip duplicates in bulk operation
        }

        let new_resource = NewResource {
            app_id: application.clone(),
            org_id: organisation.clone(),
            url: resource_req.url.clone(),
            file_path: resource_req.file_path.clone(),
            version: resource_req.version.unwrap_or(1),
            size: resource_req.size.unwrap_or(0),
            checksum: resource_req.checksum.clone().unwrap_or_default(),
            metadata: resource_req.metadata.clone().unwrap_or_else(|| json!({})),
            created_at: Utc::now(),
        };

        new_resources.push(new_resource);
    }

    // Bulk insert
    if !new_resources.is_empty() {
        let inserted_resources = diesel::insert_into(resources)
            .values(&new_resources)
            .returning(DbResource::as_returning())
            .get_results::<DbResource>(&mut conn)
            .map_err(error::ErrorInternalServerError)?;

        created_resources = inserted_resources
            .into_iter()
            .map(db_resource_to_response)
            .collect();
    }

    let response = BulkResourceResponse {
        total_created: created_resources.len(),
        created_resources,
    };

    Ok(Json(response))
}

#[post("/upload")]
async fn upload_resource(
    MultipartForm(form): MultipartForm<UploadResourceRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ResourceResponse>, actix_web::Error> {
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

    // Validate file path
    if file_path_str.is_empty() {
        return Err(error::ErrorBadRequest("File path cannot be empty"));
    }

    // Check for duplicate file_path
    let existing_resource = resources
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .filter(file_path.eq(&file_path_str))
        .filter(version.eq(form.version.clone()))
        .select(DbResource::as_select())
        .first::<DbResource>(&mut conn)
        .optional()
        .map_err(error::ErrorInternalServerError)?;

    if existing_resource.is_some() {
        return Err(error::ErrorConflict(format!(
            "Resource with file_path '{}' already exists",
            file_path_str
        )));
    }

    // Read file data for checksum calculation and size
    let file_data = tokio::fs::read(uploaded_file.file.path()).await
        .map_err(error::ErrorInternalServerError)?;
    
    let file_size = file_data.len() as i64;

    // Calculate SHA-256 checksum
    let mut hasher = Sha256::new();
    hasher.update(&file_data);
    let calculated_checksum = format!("{:x}", hasher.finalize());

    // Generate S3 path
    let file_name = std::path::Path::new(&file_path_str)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&file_path_str);
    
    let s3_path = format!(
        "assets/{}/{}/resources/{}/{}/{}",
        organisation, application, file_name, form.version.clone(), file_name
    );

    // Upload to S3
    let s3_client = &state.s3_client;
    
    match push_file(
        s3_client,
        state.env.bucket_name.clone(),
        uploaded_file,
        s3_path.clone(),
    ).await {
        Ok(obj) => {
            println!("File uploaded successfully: {:?}", obj);
            // Create the URL for the uploaded file
            let file_url = format!(
                "{}/{}/{}",
                "http://localhost:7566", state.env.bucket_name, s3_path
            );

            // Create new resource in database
            let new_resource = NewResource {
                app_id: application,
                org_id: organisation,
                url: file_url,
                file_path: file_path_str,
                version: form.version.into_inner(),
                size: file_size,
                checksum: calculated_checksum,
                metadata: json!({}),
                created_at: Utc::now(),
            };

            let created_resource = diesel::insert_into(resources)
                .values(&new_resource)
                .returning(DbResource::as_returning())
                .get_result::<DbResource>(&mut conn)
                .map_err(error::ErrorInternalServerError)?;

            Ok(Json(db_resource_to_response(created_resource)))
        }
        Err(e) => {
            return Err(error::ErrorInternalServerError(format!(
                "Failed to upload file to S3: {:?}", e
            )));
        }
    }
}

#[get("/{resource_id}")]
async fn get_resource(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ResourceResponse>, actix_web::Error> {
    let resource_id = path.into_inner();
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
    let resource_uuid = Uuid::parse_str(&resource_id)
        .map_err(|_| error::ErrorBadRequest("Invalid resource ID format"))?;

    // Get the resource
    let resource = resources
        .filter(id.eq(resource_uuid))
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .select(DbResource::as_select())
        .first::<DbResource>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("Resource with ID '{}' not found", resource_id)))?;

    Ok(Json(db_resource_to_response(resource)))
}

#[get("/list")]
async fn list_resources(
    query: Query<ResourceListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ResourceListResponse>, actix_web::Error> {
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
    let base_query = resources
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
    let resource_list = if let Some((ref pattern1, ref pattern2)) = search_filter {
        base_query
            .filter(
                file_path.ilike(pattern1)
                    .or(url.ilike(pattern2))
            )
            .order(created_at.desc())
            .limit(per_page as i64)
            .offset(offset)
            .select(DbResource::as_select())
            .load::<DbResource>(&mut conn)
            .map_err(error::ErrorInternalServerError)?
    } else {
        base_query
            .order(created_at.desc())
            .limit(per_page as i64)
            .offset(offset)
            .select(DbResource::as_select())
            .load::<DbResource>(&mut conn)
            .map_err(error::ErrorInternalServerError)?
    };

    let resources_response = resource_list
        .into_iter()
        .map(db_resource_to_response)
        .collect();

    Ok(Json(ResourceListResponse {
        resources: resources_response,
        total,
        page: Some(page),
        per_page: Some(per_page),
    }))
}

#[patch("/{resource_id}")]
async fn update_resource(
    path: Path<String>,
    req: Json<UpdateResourceRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<ResourceResponse>, actix_web::Error> {
    let resource_id = path.into_inner();
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
    let resource_uuid = Uuid::parse_str(&resource_id)
        .map_err(|_| error::ErrorBadRequest("Invalid resource ID format"))?;

    // Check if resource exists and belongs to the user
    let _existing_resource = resources
        .filter(id.eq(resource_uuid))
        .filter(org_id.eq(&organisation))
        .filter(app_id.eq(&application))
        .select(DbResource::as_select())
        .first::<DbResource>(&mut conn)
        .map_err(|_| error::ErrorNotFound(format!("Resource with ID '{}' not found", resource_id)))?;

    // Build update values    
    if req.url.is_some() || req.version.is_some() || req.size.is_some() || req.checksum.is_some() || req.metadata.is_some() {
        // Execute updates individually
        if let Some(new_url) = &req.url {
            diesel::update(resources.filter(id.eq(resource_uuid)))
                .set(url.eq(new_url))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
        if let Some(new_version) = req.version {
            diesel::update(resources.filter(id.eq(resource_uuid)))
                .set(version.eq(new_version))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
        if let Some(new_size) = req.size {
            diesel::update(resources.filter(id.eq(resource_uuid)))
                .set(size.eq(new_size))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
        if let Some(new_checksum) = &req.checksum {
            diesel::update(resources.filter(id.eq(resource_uuid)))
                .set(checksum.eq(new_checksum))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
        if let Some(new_metadata) = &req.metadata {
            diesel::update(resources.filter(id.eq(resource_uuid)))
                .set(metadata.eq(new_metadata))
                .execute(&mut conn)
                .map_err(error::ErrorInternalServerError)?;
        }
    }

    // Get updated resource
    let updated_resource = resources
        .filter(id.eq(resource_uuid))
        .select(DbResource::as_select())
        .first::<DbResource>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(db_resource_to_response(updated_resource)))
}

#[delete("/{resource_id}")]
async fn delete_resource(
    path: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<SuccessResponse>, actix_web::Error> {
    let resource_id = path.into_inner();
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
    let resource_uuid = Uuid::parse_str(&resource_id)
        .map_err(|_| error::ErrorBadRequest("Invalid resource ID format"))?;

    // Delete the resource
    let deleted_rows = diesel::delete(
        resources
            .filter(id.eq(resource_uuid))
            .filter(org_id.eq(&organisation))
            .filter(app_id.eq(&application))
    )
    .execute(&mut conn)
    .map_err(error::ErrorInternalServerError)?;

    if deleted_rows == 0 {
        return Err(error::ErrorNotFound(format!("Resource with ID '{}' not found", resource_id)));
    }

    Ok(Json(SuccessResponse {
        message: format!("Resource with ID '{}' deleted successfully", resource_id),
        success: true,
    }))
}