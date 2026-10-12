pub mod types;

use std::collections::HashMap;

use actix_web::{
    get, post,
    web::{self, Json, Path, Query, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use chrono::{DateTime, Utc};
use diesel::{
    dsl::{count_star, min},
    prelude::*,
};
use uuid::Uuid;

use crate::{
    file::file_sets::types::*,
    middleware::auth::{require_org_and_app, AuthResponse},
    release::utils::get_files_by_file_keys_async,
    run_blocking, types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse},
    utils::db::{
        models::{FileEntry, FileSetEntry, NewFileSetEntry},
        schema::hyperotaserver::{file_sets, files},
    },
};

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_file_set)
        .service(list_file_sets)
        .service(get_file_set)
        .service(create_file_set_version)
        .service(get_file_set_version)
}

fn to_set_file(file: FileEntry) -> FileSetFile {
    FileSetFile {
        id: format!("{}@version:{}", file.file_path, file.version),
        file_path: file.file_path,
        version: file.version,
        tag: file.tag,
        url: file.url,
        size: file.size,
        checksum: file.checksum,
    }
}

fn to_set_version(entry: &FileSetEntry, member_files: Vec<FileEntry>) -> FileSetVersion {
    FileSetVersion {
        version: entry.version,
        metadata: entry.metadata.clone(),
        files: member_files.into_iter().map(to_set_file).collect(),
        created_at: entry.created_at.to_rfc3339(),
    }
}

/// The set name is its identity and appears in URLs, so it gets the same
/// shape rules as an application name.
fn validate_name(name: &str) -> airborne_types::Result<String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(ABError::BadRequest(
            "File set name cannot be empty".to_string(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(ABError::BadRequest(
            "File set name can only contain: a-z, A-Z, 0-9, -, _, .".to_string(),
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

/// Trim and dedupe caller-supplied file keys, dropping blank ones. A set
/// version must contain at least one file: versions are immutable, so an
/// empty one could never be fixed.
fn normalize_file_keys(keys: &[String]) -> airborne_types::Result<Vec<String>> {
    let mut deduped: Vec<String> = Vec::new();
    for key in keys {
        let key = key.trim().to_string();
        if !key.is_empty() && !deduped.contains(&key) {
            deduped.push(key);
        }
    }

    if deduped.is_empty() {
        return Err(ABError::BadRequest(
            "A file set version must contain at least one file".to_string(),
        ));
    }
    Ok(deduped)
}

/// Resolve caller-supplied file keys to rows in `files`, enforcing that a
/// set contains a file only once: the same file_path at two different
/// versions is rejected, because a set is a collection of files, not of
/// file versions.
async fn resolve_file_ids(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    keys: &[String],
) -> airborne_types::Result<Vec<Uuid>> {
    let deduped = normalize_file_keys(keys)?;

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
            "One or more files in the set could not be found".to_string(),
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
                    "A file set can contain a file only once: '{}' was given as both version {} and version {}",
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

/// Load the files referenced by a set version, ordered by path.
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

/// All version rows of one set, newest first. Empty vec = set not found.
fn load_set_versions(
    conn: &mut PgConnection,
    organisation: &str,
    application: &str,
    name: &str,
) -> Result<Vec<FileSetEntry>, diesel::result::Error> {
    file_sets::table
        .filter(file_sets::org_id.eq(organisation))
        .filter(file_sets::app_id.eq(application))
        .filter(file_sets::name.eq(name))
        .order(file_sets::version.desc())
        .select(FileSetEntry::as_select())
        .load(conn)
}

/// Per-set aggregate row from the list query: (name, total versions,
/// first version's created_at).
type SetSummary = (String, i64, Option<DateTime<Utc>>);

/// OFFSET and LIMIT for a 1-based page. The offset saturates instead of
/// overflowing, so an absurd page just yields an empty result.
fn page_window(page: u32, count: u32) -> (i64, i64) {
    let count = count as i64;
    ((page as i64 - 1).max(0).saturating_mul(count), count)
}

/// Split one batched files query back into each set's members, ordered by
/// path then version. A file shared by several sets appears in each; ids
/// with no matching row are skipped.
fn group_member_files(
    sets: &[FileSetEntry],
    files: Vec<FileEntry>,
) -> HashMap<String, Vec<FileEntry>> {
    let by_id: HashMap<Uuid, FileEntry> = files.into_iter().map(|f| (f.id, f)).collect();
    sets.iter()
        .map(|set| {
            let mut members: Vec<FileEntry> = set
                .file_ids
                .iter()
                .filter_map(|id| by_id.get(id).cloned())
                .collect();
            members.sort_by(|a, b| {
                a.file_path
                    .cmp(&b.file_path)
                    .then(a.version.cmp(&b.version))
            });
            (set.name.clone(), members)
        })
        .collect()
}

/// Build the listing in summary (name) order from the per-set aggregates,
/// each set's latest version row and its member files.
fn assemble_file_sets(
    summaries: Vec<SetSummary>,
    latest_rows: Vec<FileSetEntry>,
    mut files_by_set: HashMap<String, Vec<FileEntry>>,
) -> Vec<FileSet> {
    let mut latest_by_name: HashMap<String, FileSetEntry> = latest_rows
        .into_iter()
        .map(|row| (row.name.clone(), row))
        .collect();
    summaries
        .into_iter()
        .filter_map(|(name, total_versions, first_created)| {
            let latest = latest_by_name.remove(&name)?;
            let member_files = files_by_set.remove(&name).unwrap_or_default();
            Some(FileSet {
                total_versions,
                created_at: first_created.unwrap_or(latest.created_at).to_rfc3339(),
                updated_at: latest.created_at.to_rfc3339(),
                latest: Some(to_set_version(&latest, member_files)),
                name,
            })
        })
        .collect()
}

#[authz(
    resource = "file_set",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("")]
async fn create_file_set(
    req: web::Json<CreateFileSetReq>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileSet>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let req = req.into_inner();
    let name = validate_name(&req.name)?;
    let metadata = validate_metadata(req.metadata)?;
    let file_ids = resolve_file_ids(&state, &organisation, &application, &req.files).await?;

    let pool = state.db_pool.clone();

    let created = run_blocking!({
        let mut conn = pool.get()?;

        let existing = load_set_versions(&mut conn, &organisation, &application, &name)?;
        if !existing.is_empty() {
            return Err(ABError::BadRequest(format!(
                "File set with name '{}' already exists",
                name
            )));
        }

        let created: FileSetEntry = diesel::insert_into(file_sets::table)
            .values(&NewFileSetEntry {
                org_id: organisation.clone(),
                app_id: application.clone(),
                name: name.clone(),
                version: 1,
                metadata: metadata.clone(),
                file_ids: file_ids.clone(),
            })
            .returning(FileSetEntry::as_returning())
            .get_result(&mut conn)?;

        Ok(created)
    })?;

    let pool = state.db_pool.clone();
    let created_file_ids = created.file_ids.clone();
    let member_files = run_blocking!({
        let mut conn = pool.get()?;
        Ok(load_member_files(&mut conn, &created_file_ids)?)
    })?;

    Ok(Json(FileSet {
        name: created.name.clone(),
        total_versions: 1,
        latest: Some(to_set_version(&created, member_files)),
        created_at: created.created_at.to_rfc3339(),
        updated_at: created.created_at.to_rfc3339(),
    }))
}

#[authz(
    resource = "file_set",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/{name}/versions")]
async fn create_file_set_version(
    name: Path<String>,
    req: web::Json<CreateFileSetVersionReq>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileSetVersion>> {
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

        let result = conn.transaction::<FileSetEntry, diesel::result::Error, _>(|conn| {
            // Postgres forbids FOR UPDATE with aggregates, so lock the
            // newest row instead of selecting max(version).
            let latest: Option<i32> = file_sets::table
                .filter(file_sets::org_id.eq(&organisation))
                .filter(file_sets::app_id.eq(&application))
                .filter(file_sets::name.eq(&name))
                .order(file_sets::version.desc())
                .select(file_sets::version)
                .for_update()
                .first(conn)
                .optional()?;

            let latest = match latest {
                Some(v) => v,
                None => return Err(diesel::result::Error::NotFound),
            };

            diesel::insert_into(file_sets::table)
                .values(&NewFileSetEntry {
                    org_id: organisation.clone(),
                    app_id: application.clone(),
                    name: name.clone(),
                    version: latest + 1,
                    metadata: metadata.clone(),
                    file_ids: file_ids.clone(),
                })
                .returning(FileSetEntry::as_returning())
                .get_result(conn)
        });

        match result {
            Ok(row) => Ok(row),
            Err(diesel::result::Error::NotFound) => {
                Err(ABError::NotFound(format!("File set '{}' not found", name)))
            }
            Err(e) => Err(e.into()),
        }
    })?;

    let pool = state.db_pool.clone();
    let created_file_ids = created.file_ids.clone();
    let member_files = run_blocking!({
        let mut conn = pool.get()?;
        Ok(load_member_files(&mut conn, &created_file_ids)?)
    })?;

    Ok(Json(to_set_version(&created, member_files)))
}

#[authz(
    resource = "file_set",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn list_file_sets(
    query: Query<FileSetsListQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<FileSet>>> {
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

        let search_pattern = match &search_term {
            Some(search) if !search.trim().is_empty() => Some(format!("%{}%", search.trim())),
            _ => None,
        };

        let mut q = file_sets::table
            .filter(file_sets::org_id.eq(&organisation))
            .filter(file_sets::app_id.eq(&application))
            .into_boxed();

        if let Some(pattern) = &search_pattern {
            q = q.filter(file_sets::name.ilike(pattern.clone()));
        }

        let total_sets: i64 = q
            .select(diesel::dsl::count(file_sets::name).aggregate_distinct())
            .first(&mut conn)?;

        // One row per set: (name, total versions, first created). Diesel
        // cannot GROUP BY an already-boxed query, so group and select
        // first, then box and add the filters.
        let mut summaries_q = file_sets::table
            .group_by(file_sets::name)
            .select((file_sets::name, count_star(), min(file_sets::created_at)))
            .order(file_sets::name.asc())
            .into_boxed()
            .filter(file_sets::org_id.eq(&organisation))
            .filter(file_sets::app_id.eq(&application));

        if let Some(pattern) = &search_pattern {
            summaries_q = summaries_q.filter(file_sets::name.ilike(pattern.clone()));
        }

        let total_items = total_sets as u64;
        let (page, count) = match pagination {
            PaginatedQuery::All => (1u32, total_items.max(1) as u32),
            PaginatedQuery::Paginated { page, count } => (page, count),
        };
        let (offset, limit) = page_window(page, count);
        let summaries: Vec<SetSummary> = summaries_q.offset(offset).limit(limit).load(&mut conn)?;

        let page_names: Vec<&String> = summaries.iter().map(|(name, _, _)| name).collect();
        let latest_rows: Vec<FileSetEntry> = if page_names.is_empty() {
            vec![]
        } else {
            file_sets::table
                .filter(file_sets::org_id.eq(&organisation))
                .filter(file_sets::app_id.eq(&application))
                .filter(file_sets::name.eq_any(page_names))
                .order((file_sets::name.asc(), file_sets::version.desc()))
                .distinct_on(file_sets::name)
                .select(FileSetEntry::as_select())
                .load(&mut conn)?
        };

        let all_ids: Vec<Uuid> = latest_rows
            .iter()
            .flat_map(|row| row.file_ids.iter().copied())
            .collect();
        let member_files = load_member_files(&mut conn, &all_ids)?;
        let files_by_set = group_member_files(&latest_rows, member_files);

        let data = assemble_file_sets(summaries, latest_rows, files_by_set);

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
    resource = "file_set",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{name}")]
async fn get_file_set(
    name: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileSetDetail>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let name = name.into_inner();
    let pool = state.db_pool.clone();

    let detail = run_blocking!({
        let mut conn = pool.get()?;
        let rows = load_set_versions(&mut conn, &organisation, &application, &name)?;

        if rows.is_empty() {
            return Err(ABError::NotFound(format!("File set '{}' not found", name)));
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
            versions.push(to_set_version(row, member_files));
        }

        Ok(FileSetDetail {
            name,
            versions,
            created_at: first_created.to_rfc3339(),
            updated_at: updated_at.to_rfc3339(),
        })
    })?;

    Ok(Json(detail))
}

#[authz(
    resource = "file_set",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/{name}/versions/{version}")]
async fn get_file_set_version(
    path: Path<(String, i32)>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileSetVersion>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let (name, version_number) = path.into_inner();
    let pool = state.db_pool.clone();

    let version = run_blocking!({
        let mut conn = pool.get()?;

        let row: Option<FileSetEntry> = file_sets::table
            .filter(file_sets::org_id.eq(&organisation))
            .filter(file_sets::app_id.eq(&application))
            .filter(file_sets::name.eq(&name))
            .filter(file_sets::version.eq(version_number))
            .select(FileSetEntry::as_select())
            .first(&mut conn)
            .optional()?;

        let row = row.ok_or_else(|| {
            ABError::NotFound(format!(
                "Version {} of file set '{}' not found",
                version_number, name
            ))
        })?;

        let member_files = load_member_files(&mut conn, &row.file_ids)?;
        Ok(to_set_version(&row, member_files))
    })?;

    Ok(Json(version))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn ts(secs: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(secs, 0).unwrap()
    }

    fn file(id: u128, path: &str, version: i32) -> FileEntry {
        FileEntry {
            id: Uuid::from_u128(id),
            app_id: "app".to_string(),
            org_id: "org".to_string(),
            version,
            tag: None,
            url: format!("https://cdn.example.com/{}", path),
            file_path: path.to_string(),
            size: 1,
            checksum: "sum".to_string(),
            metadata: serde_json::json!({}),
            created_at: ts(0),
        }
    }

    fn set_row(name: &str, version: i32, ids: &[u128], created: i64) -> FileSetEntry {
        FileSetEntry {
            id: Uuid::new_v4(),
            name: name.to_string(),
            version,
            metadata: serde_json::json!({}),
            file_ids: ids.iter().map(|i| Uuid::from_u128(*i)).collect(),
            created_at: ts(created),
        }
    }

    fn parse_query(qs: &str) -> Result<FileSetsListQuery, String> {
        Query::<FileSetsListQuery>::from_query(qs)
            .map(Query::into_inner)
            .map_err(|e| e.to_string())
    }

    // --- request params (PaginatedQuery via FileSetsListQuery) ---

    #[test]
    fn query_defaults_to_first_page_of_ten() {
        let q = parse_query("").unwrap();
        assert!(matches!(
            q.pagination,
            PaginatedQuery::Paginated { page: 1, count: 10 }
        ));
        assert!(q.search.is_none());
    }

    #[test]
    fn query_rejects_page_zero() {
        assert!(parse_query("page=0").is_err());
    }

    #[test]
    fn query_rejects_count_zero() {
        assert!(parse_query("count=0").is_err());
    }

    #[test]
    fn query_accepts_all() {
        assert!(matches!(
            parse_query("all=true").unwrap().pagination,
            PaginatedQuery::All
        ));
    }

    #[test]
    fn query_rejects_all_with_page() {
        assert!(parse_query("all=true&page=1").is_err());
    }

    #[test]
    fn query_keeps_search_with_pagination() {
        let q = parse_query("page=2&count=5&search=fonts").unwrap();
        assert!(matches!(
            q.pagination,
            PaginatedQuery::Paginated { page: 2, count: 5 }
        ));
        assert_eq!(q.search.as_deref(), Some("fonts"));
    }

    // --- normalize_file_keys ---

    fn keys(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    fn assert_rejected_as_empty(result: airborne_types::Result<Vec<String>>) {
        match result {
            Err(ABError::BadRequest(msg)) => assert!(msg.contains("at least one file"), "{}", msg),
            Err(other) => panic!("expected BadRequest, got {:?}", other),
            Ok(v) => panic!("expected rejection, got {:?}", v),
        }
    }

    #[test]
    fn empty_file_list_is_rejected() {
        assert_rejected_as_empty(normalize_file_keys(&[]));
    }

    #[test]
    fn only_blank_keys_are_rejected() {
        assert_rejected_as_empty(normalize_file_keys(&keys(&["", "  ", "\t"])));
    }

    #[test]
    fn single_file_is_accepted() {
        assert_eq!(
            normalize_file_keys(&keys(&["a.js@version:1"])).unwrap(),
            keys(&["a.js@version:1"])
        );
    }

    #[test]
    fn keys_are_trimmed_and_blanks_dropped() {
        assert_eq!(
            normalize_file_keys(&keys(&["  a.js@version:1 ", "", "b.js@tag:latest"])).unwrap(),
            keys(&["a.js@version:1", "b.js@tag:latest"])
        );
    }

    #[test]
    fn duplicate_keys_collapse_keeping_first_order() {
        assert_eq!(
            normalize_file_keys(&keys(&[
                "b.js@version:2",
                "a.js@version:1",
                " b.js@version:2"
            ]))
            .unwrap(),
            keys(&["b.js@version:2", "a.js@version:1"])
        );
    }

    // --- request bodies ---

    #[test]
    fn create_set_request_requires_files() {
        let missing = serde_json::from_str::<CreateFileSetReq>(r#"{"name": "assets"}"#);
        assert!(missing.is_err());

        let present = serde_json::from_str::<CreateFileSetReq>(
            r#"{"name": "assets", "files": ["a.js@version:1"]}"#,
        )
        .unwrap();
        assert_eq!(present.files, keys(&["a.js@version:1"]));
    }

    #[test]
    fn create_version_request_requires_files() {
        assert!(serde_json::from_str::<CreateFileSetVersionReq>(r#"{"metadata": {}}"#).is_err());
    }

    // --- page_window ---

    #[test]
    fn first_page_starts_at_zero() {
        assert_eq!(page_window(1, 10), (0, 10));
    }

    #[test]
    fn later_page_skips_previous_pages() {
        assert_eq!(page_window(3, 10), (20, 10));
    }

    #[test]
    fn huge_page_and_count_saturate_instead_of_overflowing() {
        assert_eq!(page_window(u32::MAX, u32::MAX), (i64::MAX, u32::MAX as i64));
    }

    #[test]
    fn largest_page_that_fits_is_exact() {
        let max = u32::MAX as i64;
        assert_eq!(page_window(u32::MAX, 1), (max - 1, 1));
    }

    // --- group_member_files ---

    #[test]
    fn set_without_files_gets_an_empty_list() {
        let grouped = group_member_files(&[set_row("empty", 1, &[], 0)], vec![]);
        assert_eq!(grouped.get("empty").map(Vec::len), Some(0));
    }

    #[test]
    fn members_are_sorted_by_path_then_version() {
        let sets = [set_row("s", 1, &[1, 2, 3], 0)];
        let files = vec![file(1, "b.js", 1), file(2, "a.js", 2), file(3, "a.js", 1)];
        let order: Vec<(String, i32)> = group_member_files(&sets, files)["s"]
            .iter()
            .map(|f| (f.file_path.clone(), f.version))
            .collect();
        assert_eq!(
            order,
            vec![
                ("a.js".to_string(), 1),
                ("a.js".to_string(), 2),
                ("b.js".to_string(), 1)
            ]
        );
    }

    #[test]
    fn file_shared_by_two_sets_appears_in_both() {
        let sets = [set_row("x", 1, &[1], 0), set_row("y", 1, &[1], 0)];
        let grouped = group_member_files(&sets, vec![file(1, "shared.js", 1)]);
        assert_eq!(grouped["x"].len(), 1);
        assert_eq!(grouped["y"].len(), 1);
    }

    #[test]
    fn unknown_file_id_is_skipped() {
        let sets = [set_row("s", 1, &[1, 99], 0)];
        let grouped = group_member_files(&sets, vec![file(1, "a.js", 1)]);
        assert_eq!(grouped["s"].len(), 1);
        assert_eq!(grouped["s"][0].id, Uuid::from_u128(1));
    }

    #[test]
    fn no_sets_gives_an_empty_map() {
        assert!(group_member_files(&[], vec![file(1, "a.js", 1)]).is_empty());
    }

    // --- assemble_file_sets ---

    #[test]
    fn output_follows_summary_order_not_row_order() {
        let summaries = vec![
            ("alpha".to_string(), 1, Some(ts(1))),
            ("beta".to_string(), 1, Some(ts(2))),
        ];
        let latest = vec![set_row("beta", 1, &[], 2), set_row("alpha", 1, &[], 1)];
        let names: Vec<String> = assemble_file_sets(summaries, latest, HashMap::new())
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(names, vec!["alpha", "beta"]);
    }

    #[test]
    fn fields_come_from_summary_and_latest_version() {
        let summaries = vec![("s".to_string(), 3, Some(ts(100)))];
        let latest = vec![set_row("s", 3, &[1], 300)];
        let files_by_set = HashMap::from([("s".to_string(), vec![file(1, "a.js", 1)])]);
        let sets = assemble_file_sets(summaries, latest, files_by_set);
        assert_eq!(sets.len(), 1);
        let set = &sets[0];
        assert_eq!(set.total_versions, 3);
        assert_eq!(set.created_at, ts(100).to_rfc3339());
        assert_eq!(set.updated_at, ts(300).to_rfc3339());
        let latest = set.latest.as_ref().unwrap();
        assert_eq!(latest.version, 3);
        assert_eq!(latest.files.len(), 1);
        assert_eq!(latest.files[0].id, "a.js@version:1");
    }

    #[test]
    fn page_past_the_end_is_empty() {
        assert!(assemble_file_sets(vec![], vec![], HashMap::new()).is_empty());
        // ...because the offset of page 3 lies past a 3-set listing.
        assert_eq!(page_window(3, 2), (4, 2));
    }
}
