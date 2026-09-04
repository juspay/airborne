pub mod types;

use std::collections::HashMap;

use actix_web::{
    get, post,
    web::{self, Json, Path, Query, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    file::file_groups::types::*,
    middleware::auth::{require_org_and_app, AuthResponse},
    release::utils::get_files_by_file_keys_async,
    run_blocking, types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse},
    utils::db::{
        models::{FileEntry, FileGroupEntry, NewFileGroupEntry},
        schema::hyperotaserver::{file_groups, files},
    },
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_file_group)
        .service(list_file_groups)
        .service(get_file_group)
        .service(create_file_group_version)
        .service(get_file_group_version)
}

fn to_group_file(file: FileEntry) -> FileGroupFile {
    FileGroupFile {
        id: format!("{}@version:{}", file.file_path, file.version),
        file_path: file.file_path,
        version: file.version,
        tag: file.tag,
        url: file.url,
        size: file.size,
        checksum: file.checksum,
    }
}

fn to_group_version(entry: &FileGroupEntry, member_files: Vec<FileEntry>) -> FileGroupVersion {
    FileGroupVersion {
        version: entry.version,
        metadata: entry.metadata.clone(),
        files: member_files.into_iter().map(to_group_file).collect(),
        created_at: entry.created_at.to_rfc3339(),
    }
}

/// The group name is its identity and appears in URLs, so it gets the same
/// shape rules as an application name.
fn validate_name(name: &str) -> airborne_types::Result<String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(ABError::BadRequest(
            "File group name cannot be empty".to_string(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(ABError::BadRequest(
            "File group name can only contain: a-z, A-Z, 0-9, -, _, .".to_string(),
        ));
    }
    Ok(name)
}

fn validate_metadata(
    metadata: Option<serde_json::Value>,
) -> airborne_types::Result<serde_json::Value> {
    match metadata {
        None => Ok(serde_json::json!({})),
        Some(v) if v.is_object() => Ok(v),
        Some(_) => Err(ABError::BadRequest(
            "Version metadata must be a JSON object".to_string(),
        )),
    }
}

/// Resolve caller-supplied file keys to rows in `files`, enforcing that a
/// group contains a file only once: the same file_path at two different
/// versions is rejected, because a group is a collection of files, not of
/// file versions.
async fn resolve_file_ids(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    keys: &[String],
) -> airborne_types::Result<Vec<Uuid>> {
    let mut deduped: Vec<String> = Vec::new();
    for key in keys {
        let key = key.trim().to_string();
        if !key.is_empty() && !deduped.contains(&key) {
            deduped.push(key);
        }
    }

    if deduped.is_empty() {
        return Ok(vec![]);
    }

    let resolved = get_files_by_file_keys_async(
        state.db_pool.clone(),
        &state.redis_cache,
        organisation.to_string(),
        application.to_string(),
        deduped.clone(),
    )
    .await?;

    if resolved.len() != deduped.len() {
        return Err(ABError::BadRequest(
            "One or more files in the group could not be found".to_string(),
        ));
    }

    let mut version_by_path: HashMap<String, i32> = HashMap::new();
    for file in &resolved {
        if let Some(prev) = version_by_path.insert(file.file_path.clone(), file.version) {
            if prev != file.version {
                let (a, b) = if prev < file.version {
                    (prev, file.version)
                } else {
                    (file.version, prev)
                };
                return Err(ABError::BadRequest(format!(
                    "A file group can contain a file only once: '{}' was given as both version {} and version {}",
                    file.file_path, a, b
                )));
            }
        }
    }

    let mut ids: Vec<Uuid> = Vec::new();
    for file in resolved {
        if !ids.contains(&file.id) {
            ids.push(file.id);
        }
    }

    Ok(ids)
}

/// Load the files referenced by a group version, ordered by path.
fn load_member_files(
    conn: &mut PgConnection,
    file_ids: &[Uuid],
) -> Result<Vec<FileEntry>, diesel::result::Error> {
    if file_ids.is_empty() {
        return Ok(vec![]);
    }
    files::table
        .filter(files::id.eq_any(file_ids))
        .order((files::file_path.asc(), files::version.asc()))
        .select(FileEntry::as_select())
        .load(conn)
}

/// All version rows of one group, newest first. Empty vec = group not found.
fn load_group_rows(
    conn: &mut PgConnection,
    organisation: &str,
    application: &str,
    name: &str,
) -> Result<Vec<FileGroupEntry>, diesel::result::Error> {
    file_groups::table
        .filter(file_groups::org_id.eq(organisation))
        .filter(file_groups::app_id.eq(application))
        .filter(file_groups::name.eq(name))
        .order(file_groups::version.desc())
        .select(FileGroupEntry::as_select())
        .load(conn)
}

#[authz(
    resource = "file_group",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("")]
async fn create_file_group(
    req: web::Json<CreateFileGroupReq>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileGroup>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let req = req.into_inner();
    let name = validate_name(&req.name)?;
    let metadata = validate_metadata(req.metadata)?;
    let file_ids = resolve_file_ids(
        &state,
        &organisation,
        &application,
        &req.files.unwrap_or_default(),
    )
    .await?;

    let pool = state.db_pool.clone();

    let created = run_blocking!({
        let mut conn = pool.get()?;

        let existing = load_group_rows(&mut conn, &organisation, &application, &name)?;
        if !existing.is_empty() {
            return Err(ABError::BadRequest(format!(
                "File group with name '{}' already exists",
                name
            )));
        }

        let created: FileGroupEntry = diesel::insert_into(file_groups::table)
            .values(&NewFileGroupEntry {
                org_id: organisation.clone(),
                app_id: application.clone(),
                name: name.clone(),
                version: 1,
                metadata: metadata.clone(),
                file_ids: file_ids.clone(),
            })
            .returning(FileGroupEntry::as_returning())
            .get_result(&mut conn)?;

        Ok(created)
    })?;

    let pool = state.db_pool.clone();
    let created_file_ids = created.file_ids.clone();
    let member_files = run_blocking!({
        let mut conn = pool.get()?;
        Ok(load_member_files(&mut conn, &created_file_ids)?)
    })?;

    Ok(Json(FileGroup {
        name: created.name.clone(),
        total_versions: 1,
        latest: Some(to_group_version(&created, member_files)),
        created_at: created.created_at.to_rfc3339(),
        updated_at: created.created_at.to_rfc3339(),
    }))
}

#[authz(
    resource = "file_group",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{name}/versions")]
async fn create_file_group_version(
    name: Path<String>,
    req: web::Json<CreateFileGroupVersionReq>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileGroupVersion>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let name = validate_name(&name.into_inner())?;
    let req = req.into_inner();
    let metadata = validate_metadata(req.metadata)?;
    let file_ids = resolve_file_ids(&state, &organisation, &application, &req.files).await?;

    let pool = state.db_pool.clone();

    let created = run_blocking!({
        let mut conn = pool.get()?;

        let result = conn.transaction::<FileGroupEntry, diesel::result::Error, _>(|conn| {
            // Postgres forbids FOR UPDATE with aggregates, so lock the
            // newest row instead of selecting max(version).
            let latest: Option<i32> = file_groups::table
                .filter(file_groups::org_id.eq(&organisation))
                .filter(file_groups::app_id.eq(&application))
                .filter(file_groups::name.eq(&name))
                .order(file_groups::version.desc())
                .select(file_groups::version)
                .for_update()
                .first(conn)
                .optional()?;

            let latest = match latest {
                Some(v) => v,
                None => return Err(diesel::result::Error::NotFound),
            };

            diesel::insert_into(file_groups::table)
                .values(&NewFileGroupEntry {
                    org_id: organisation.clone(),
                    app_id: application.clone(),
                    name: name.clone(),
                    version: latest + 1,
                    metadata: metadata.clone(),
                    file_ids: file_ids.clone(),
                })
                .returning(FileGroupEntry::as_returning())
                .get_result(conn)
        });

        match result {
            Ok(row) => Ok(row),
            Err(diesel::result::Error::NotFound) => Err(ABError::NotFound(format!(
                "File group '{}' not found",
                name
            ))),
            Err(e) => Err(e.into()),
        }
    })?;

    let pool = state.db_pool.clone();
    let created_file_ids = created.file_ids.clone();
    let member_files = run_blocking!({
        let mut conn = pool.get()?;
        Ok(load_member_files(&mut conn, &created_file_ids)?)
    })?;

    Ok(Json(to_group_version(&created, member_files)))
}

#[authz(
    resource = "file_group",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn list_file_groups(
    query: Query<FileGroupsListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<FileGroup>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let pool = state.db_pool.clone();
    let query = query.into_inner();
    let pagination = query.pagination;
    let search_term = query.search.clone();

    let response = run_blocking!({
        let mut conn = pool.get()?;

        // Load every version row of every matching group, newest first, and
        // fold them into per-group summaries. Group counts are small (they
        // are curated, not machine-generated), so this stays cheap.
        let mut q = file_groups::table
            .filter(file_groups::org_id.eq(&organisation))
            .filter(file_groups::app_id.eq(&application))
            .into_boxed();

        if let Some(search) = &search_term {
            if !search.trim().is_empty() {
                q = q.filter(file_groups::name.ilike(format!("%{}%", search.trim())));
            }
        }

        let rows: Vec<FileGroupEntry> = q
            .order((file_groups::name.asc(), file_groups::version.desc()))
            .select(FileGroupEntry::as_select())
            .load(&mut conn)?;

        struct Summary {
            latest: FileGroupEntry,
            total_versions: i64,
            first_created: chrono::DateTime<chrono::Utc>,
        }
        let mut order: Vec<String> = Vec::new();
        let mut by_name: HashMap<String, Summary> = HashMap::new();
        for row in rows {
            match by_name.get_mut(&row.name) {
                Some(s) => {
                    s.total_versions += 1;
                    if row.created_at < s.first_created {
                        s.first_created = row.created_at;
                    }
                }
                None => {
                    order.push(row.name.clone());
                    by_name.insert(
                        row.name.clone(),
                        Summary {
                            first_created: row.created_at,
                            total_versions: 1,
                            latest: row,
                        },
                    );
                }
            }
        }

        let total_items = order.len() as u64;
        let (page, count) = match pagination {
            PaginatedQuery::All => (1u32, order.len().max(1) as u32),
            PaginatedQuery::Paginated { page, count } => (page, count),
        };
        let start = ((page.saturating_sub(1)) * count) as usize;
        let page_names: Vec<String> = order.into_iter().skip(start).take(count as usize).collect();

        let mut data = Vec::new();
        for name in page_names {
            let summary = by_name.remove(&name).expect("summary exists for name");
            let member_files = load_member_files(&mut conn, &summary.latest.file_ids)?;
            data.push(FileGroup {
                name,
                total_versions: summary.total_versions,
                latest: Some(to_group_version(&summary.latest, member_files)),
                created_at: summary.first_created.to_rfc3339(),
                updated_at: summary.latest.created_at.to_rfc3339(),
            });
        }

        let total_pages = if total_items == 0 {
            1u32
        } else {
            ((total_items as f64) / (count as f64)).ceil() as u32
        };

        Ok(PaginatedResponse {
            data,
            total_items,
            total_pages,
        })
    })?;

    Ok(Json(response))
}

#[authz(
    resource = "file_group",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{name}")]
async fn get_file_group(
    name: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileGroupDetail>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let name = name.into_inner();
    let pool = state.db_pool.clone();

    let detail = run_blocking!({
        let mut conn = pool.get()?;
        let rows = load_group_rows(&mut conn, &organisation, &application, &name)?;

        if rows.is_empty() {
            return Err(ABError::NotFound(format!(
                "File group '{}' not found",
                name
            )));
        }

        let first_created = rows
            .iter()
            .map(|r| r.created_at)
            .min()
            .expect("rows is non-empty");
        let updated_at = rows[0].created_at;

        let mut versions = Vec::new();
        for row in &rows {
            let member_files = load_member_files(&mut conn, &row.file_ids)?;
            versions.push(to_group_version(row, member_files));
        }

        Ok(FileGroupDetail {
            name,
            versions,
            created_at: first_created.to_rfc3339(),
            updated_at: updated_at.to_rfc3339(),
        })
    })?;

    Ok(Json(detail))
}

#[authz(
    resource = "file_group",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{name}/versions/{version}")]
async fn get_file_group_version(
    path: Path<(String, i32)>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileGroupVersion>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let (name, version_number) = path.into_inner();
    let pool = state.db_pool.clone();

    let version = run_blocking!({
        let mut conn = pool.get()?;

        let row: Option<FileGroupEntry> = file_groups::table
            .filter(file_groups::org_id.eq(&organisation))
            .filter(file_groups::app_id.eq(&application))
            .filter(file_groups::name.eq(&name))
            .filter(file_groups::version.eq(version_number))
            .select(FileGroupEntry::as_select())
            .first(&mut conn)
            .optional()?;

        let row = row.ok_or_else(|| {
            ABError::NotFound(format!(
                "Version {} of file group '{}' not found",
                version_number, name
            ))
        })?;

        let member_files = load_member_files(&mut conn, &row.file_ids)?;
        Ok(to_group_version(&row, member_files))
    })?;

    Ok(Json(version))
}
