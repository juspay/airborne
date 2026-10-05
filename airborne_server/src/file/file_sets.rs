pub mod types;

use std::collections::{HashMap, HashSet};

use actix_web::{
    get, post,
    web::{self, Json, Path, Query, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use chrono::{DateTime, Utc};
use diesel::{
    dsl::{count_star, max, min},
    prelude::*,
};

use crate::{
    file::{file_sets::types::*, groups::escape_like_pattern, utils::parse_file_key},
    middleware::auth::{require_org_and_app, AuthResponse},
    release::utils::get_files_by_file_keys_async,
    run_blocking, types as airborne_types,
    types::{ABError, AppState, PaginatedQuery, PaginatedResponse},
    utils::db::{
        models::{FileEntry, FileSetEntry, NewFileSetEntry},
        schema::hyperotaserver::file_sets,
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

fn file_key(file_path: &str, version: i32) -> String {
    format!("{}@version:{}", file_path, version)
}

fn to_set_version(entry: &FileSetEntry, file_keys: Vec<String>) -> FileSetVersion {
    FileSetVersion {
        version: entry.version,
        metadata: entry.metadata.clone(),
        files: file_keys,
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
    // Names like `.` and `..` would be collapsed out of the URL.
    if !name.starts_with(|c: char| c.is_ascii_alphanumeric()) {
        return Err(ABError::BadRequest(
            "File set name must start with a letter or digit".to_string(),
        ));
    }
    Ok(name)
}

fn validate_metadata(
    metadata: Option<serde_json::Value>,
) -> airborne_types::Result<serde_json::Value> {
    let not_an_object =
        || ABError::BadRequest("Version metadata must be a JSON object".to_string());
    match metadata {
        None => Ok(serde_json::json!({})),
        Some(v) if v.is_object() => Ok(v),
        // The generated CLI sends document fields as a JSON string; accept
        // it when the string holds an object.
        Some(serde_json::Value::String(text)) => {
            match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(v) if v.is_object() => Ok(v),
                _ => Err(not_an_object()),
            }
        }
        Some(_) => Err(not_an_object()),
    }
}

/// Which write a database error came from, so a constraint violation can
/// be reported in the caller's terms.
#[derive(Clone, Copy, Debug)]
enum FileSetWrite {
    CreateSet,
    CreateVersion,
}

/// Turn a failed file-set insert into the API error the client should see.
fn map_file_set_write_error(err: diesel::result::Error, name: &str, op: FileSetWrite) -> ABError {
    use diesel::result::{DatabaseErrorKind, Error as DieselError};
    match (err, op) {
        // Two concurrent creates of the same name: the unique index rejects
        // the second.
        (
            DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _),
            FileSetWrite::CreateSet,
        ) => ABError::BadRequest(format!("File set with name '{}' already exists", name)),
        // Two concurrent new versions computed the same version number.
        (
            DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _),
            FileSetWrite::CreateVersion,
        ) => ABError::Conflict(format!(
            "Another version of file set '{}' was created at the same time; retry the request",
            name
        )),
        (DieselError::NotFound, _) => ABError::NotFound(format!("File set '{}' not found", name)),
        (other, _) => other.into(),
    }
}

/// The requested keys that no resolved file answers to: `path@version:N`
/// needs that path at that version, `path@tag:T` that path carrying tag T.
fn unresolved_keys<'a>(keys: &'a [String], files: &[FileEntry]) -> Vec<&'a str> {
    keys.iter()
        .filter(|key| {
            let (path, version, tag) = parse_file_key(key);
            !files.iter().any(|f| {
                f.file_path == path
                    && match (version, &tag) {
                        (Some(v), _) => f.version == v,
                        (None, Some(t)) => f.tag.as_deref() == Some(t.as_str()),
                        (None, None) => false,
                    }
            })
        })
        .map(|key| key.as_str())
        .collect()
}

/// ILIKE pattern for a name search, with `%`, `_` and `\` matched
/// literally. `None` for no (or a blank) search.
fn name_search_pattern(search: Option<&str>) -> Option<String> {
    match search.map(str::trim) {
        Some(search) if !search.is_empty() => Some(format!("%{}%", escape_like_pattern(search))),
        _ => None,
    }
}

/// Trim and dedupe caller-supplied file keys, dropping blank ones. A set
/// version must contain at least one file: versions are immutable, so an
/// empty one could never be fixed.
fn normalize_file_keys(keys: &[String]) -> airborne_types::Result<Vec<String>> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut deduped: Vec<String> = Vec::new();
    for key in keys {
        let key = key.trim().to_string();
        if !key.is_empty() && seen.insert(key.clone()) {
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
/// file versions. Returns the resolved rows (one per file), so callers can
/// both store their ids and build the response without fetching them again.
async fn resolve_set_files(
    state: &web::Data<AppState>,
    organisation: &str,
    application: &str,
    keys: &[String],
) -> airborne_types::Result<Vec<FileEntry>> {
    let deduped = normalize_file_keys(keys)?;

    let resolved = get_files_by_file_keys_async(
        state.db_pool.clone(),
        &state.redis_cache,
        organisation.to_string(),
        application.to_string(),
        deduped.clone(),
    )
    .await?;

    // Two keys (e.g. `@version:N` and a tag) can name the same row, so
    // check each key rather than comparing counts.
    let missing = unresolved_keys(&deduped, &resolved);
    if !missing.is_empty() {
        return Err(ABError::BadRequest(format!(
            "These files could not be found: {}",
            missing.join(", ")
        )));
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

    let mut seen_ids: HashSet<uuid::Uuid> = HashSet::new();
    let files: Vec<FileEntry> = resolved
        .into_iter()
        .filter(|f| seen_ids.insert(f.id))
        .collect();

    Ok(files)
}

/// A set's version count, first version's created_at and latest version's
/// created_at.
type SetVersionsSummary = (i64, Option<DateTime<Utc>>, Option<DateTime<Utc>>);

/// Summarise one set's versions. A count of 0 means the set doesn't exist.
fn set_summary(
    conn: &mut PgConnection,
    organisation: &str,
    application: &str,
    name: &str,
) -> Result<SetVersionsSummary, diesel::result::Error> {
    file_sets::table
        .filter(file_sets::org_id.eq(organisation))
        .filter(file_sets::app_id.eq(application))
        .filter(file_sets::name.eq(name))
        .select((
            count_star(),
            min(file_sets::created_at),
            max(file_sets::created_at),
        ))
        .first(conn)
}

/// One page of a set's versions, newest first.
fn set_versions_page_query<'a>(
    organisation: &'a str,
    application: &'a str,
    name: &'a str,
    offset: i64,
    limit: i64,
) -> file_sets::BoxedQuery<'a, diesel::pg::Pg> {
    file_sets::table
        .filter(file_sets::org_id.eq(organisation))
        .filter(file_sets::app_id.eq(application))
        .filter(file_sets::name.eq(name))
        .order(file_sets::version.desc())
        .offset(offset)
        .limit(limit)
        .into_boxed()
}

/// Per-set aggregate row from the list query: (name, total versions,
/// first version's created_at, latest version number, latest version's
/// created_at).
type SetSummary = (
    String,
    i64,
    Option<DateTime<Utc>>,
    Option<i32>,
    Option<DateTime<Utc>>,
);

/// OFFSET and LIMIT for a 1-based page. The offset saturates instead of
/// overflowing, so an absurd page just yields an empty result.
fn page_window(page: u32, count: u32) -> (i64, i64) {
    let count = count as i64;
    ((page as i64 - 1).max(0).saturating_mul(count), count)
}

/// Page and page size for a query over `total` rows; `all` is one page
/// holding every row.
fn page_and_count(pagination: PaginatedQuery, total: u64) -> (u32, u32) {
    match pagination {
        PaginatedQuery::All => (1, total.max(1) as u32),
        PaginatedQuery::Paginated { page, count } => (page, count),
    }
}

/// Number of pages for `total_items` at `count` per page; no items is
/// still one page.
fn total_pages(total_items: u64, count: u32) -> u32 {
    if total_items == 0 {
        1
    } else {
        ((total_items as f64) / (count as f64)).ceil() as u32
    }
}

/// Order a set version's member files by path, then version.
fn sort_member_files(mut files: Vec<FileEntry>) -> Vec<FileEntry> {
    files.sort_by(|a, b| {
        a.file_path
            .cmp(&b.file_path)
            .then(a.version.cmp(&b.version))
    });
    files
}

/// File keys of resolved files, ordered by path then version — the form a
/// set version stores (tag keys are already resolved to a version here).
fn keys_of(files: Vec<FileEntry>) -> Vec<String> {
    sort_member_files(files)
        .iter()
        .map(|f| file_key(&f.file_path, f.version))
        .collect()
}

/// Build the listing (in the query's name order) from the per-set aggregates.
fn summaries_to_file_sets(summaries: Vec<SetSummary>) -> Vec<FileSet> {
    summaries
        .into_iter()
        .filter_map(
            |(name, total_versions, first_created, latest_version, last_created)| {
                // A group always has rows, so the aggregates are never NULL.
                let latest_version = latest_version?;
                let last_created = last_created?;
                Some(FileSet {
                    name,
                    total_versions,
                    latest_version,
                    created_at: first_created.unwrap_or(last_created).to_rfc3339(),
                    updated_at: last_created.to_rfc3339(),
                })
            },
        )
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
    let set_files = resolve_set_files(&state, &organisation, &application, &req.files).await?;
    let file_keys = keys_of(set_files);

    let pool = state.db_pool.clone();

    let created = run_blocking!({
        let mut conn = pool.get()?;

        let (existing, _, _) = set_summary(&mut conn, &organisation, &application, &name)?;
        if existing > 0 {
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
                file_keys: file_keys.clone(),
            })
            .returning(FileSetEntry::as_returning())
            .get_result(&mut conn)
            .map_err(|e| map_file_set_write_error(e, &name, FileSetWrite::CreateSet))?;

        Ok(created)
    })?;

    Ok(Json(FileSet {
        name: created.name.clone(),
        total_versions: 1,
        latest_version: created.version,
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
    let set_files = resolve_set_files(&state, &organisation, &application, &req.files).await?;
    let file_keys = keys_of(set_files);

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
                    file_keys: file_keys.clone(),
                })
                .returning(FileSetEntry::as_returning())
                .get_result(conn)
        });

        result.map_err(|e| map_file_set_write_error(e, &name, FileSetWrite::CreateVersion))
    })?;

    // The stored keys are the version's members; no need to fetch them again.
    Ok(Json(to_set_version(&created, created.file_keys.clone())))
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

        let search_pattern = name_search_pattern(search_term.as_deref());

        let mut q = file_sets::table
            .filter(file_sets::org_id.eq(&organisation))
            .filter(file_sets::app_id.eq(&application))
            .into_boxed();

        if let Some(pattern) = &search_pattern {
            q = q.filter(file_sets::name.ilike(pattern.clone()).escape('\\'));
        }

        let total_sets: i64 = q
            .select(diesel::dsl::count_distinct(file_sets::name))
            .first(&mut conn)?;

        // One row per set with everything the list shows: (name, total
        // versions, first created, latest version, last created). Diesel
        // cannot GROUP BY an already-boxed query, so group and select
        // first, then box and add the filters.
        let mut summaries_q = file_sets::table
            .group_by(file_sets::name)
            .select((
                file_sets::name,
                count_star(),
                min(file_sets::created_at),
                max(file_sets::version),
                max(file_sets::created_at),
            ))
            .order(file_sets::name.asc())
            .into_boxed()
            .filter(file_sets::org_id.eq(&organisation))
            .filter(file_sets::app_id.eq(&application));

        if let Some(pattern) = &search_pattern {
            summaries_q = summaries_q.filter(file_sets::name.ilike(pattern.clone()).escape('\\'));
        }

        let total_items = total_sets as u64;
        let (page, count) = page_and_count(pagination, total_items);
        let (offset, limit) = page_window(page, count);
        let summaries: Vec<SetSummary> = summaries_q.offset(offset).limit(limit).load(&mut conn)?;

        let data = summaries_to_file_sets(summaries);

        Ok(PaginatedResponse {
            data,
            total_items,
            total_pages: total_pages(total_items, count),
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
    pagination: Query<PaginatedQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileSetDetail>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let name = name.into_inner();
    let pagination = pagination.into_inner();
    let pool = state.db_pool.clone();

    let detail = run_blocking!({
        let mut conn = pool.get()?;
        let (total_versions, first_created, last_created) =
            set_summary(&mut conn, &organisation, &application, &name)?;

        let (first_created, last_created) = match (first_created, last_created) {
            (Some(first), Some(last)) if total_versions > 0 => (first, last),
            _ => return Err(ABError::NotFound(format!("File set '{}' not found", name))),
        };

        let total_items = total_versions as u64;
        let (page, count) = page_and_count(pagination, total_items);
        let (offset, limit) = page_window(page, count);
        let rows: Vec<FileSetEntry> =
            set_versions_page_query(&organisation, &application, &name, offset, limit)
                .select(FileSetEntry::as_select())
                .load(&mut conn)?;

        // Each version stores its file keys, so no files lookup is needed.
        let versions = rows
            .iter()
            .map(|row| to_set_version(row, row.file_keys.clone()))
            .collect();

        Ok(FileSetDetail {
            name,
            versions,
            total_items,
            total_pages: total_pages(total_items, count),
            created_at: first_created.to_rfc3339(),
            updated_at: last_created.to_rfc3339(),
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

        let file_keys = row.file_keys.clone();
        Ok(to_set_version(&row, file_keys))
    })?;

    Ok(Json(version))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use uuid::Uuid;

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

    // --- validate_metadata (#1: the generated CLI sends metadata as a JSON string) ---

    fn metadata_rejected(result: airborne_types::Result<serde_json::Value>) {
        match result {
            Err(ABError::BadRequest(msg)) => assert!(msg.contains("JSON object"), "{}", msg),
            other => panic!("expected BadRequest, got {:?}", other),
        }
    }

    #[test]
    fn missing_metadata_defaults_to_empty_object() {
        assert_eq!(validate_metadata(None).unwrap(), serde_json::json!({}));
    }

    #[test]
    fn object_metadata_is_accepted_as_is() {
        let v = serde_json::json!({"jira": "PICAF-1", "n": 2});
        assert_eq!(validate_metadata(Some(v.clone())).unwrap(), v);
    }

    #[test]
    fn json_object_string_metadata_is_parsed() {
        let v = serde_json::Value::String(r#"{"jira":"PICAF-1","n":2}"#.to_string());
        assert_eq!(
            validate_metadata(Some(v)).unwrap(),
            serde_json::json!({"jira": "PICAF-1", "n": 2})
        );
    }

    #[test]
    fn non_json_string_metadata_is_rejected() {
        metadata_rejected(validate_metadata(Some(serde_json::Value::String(
            "not json".to_string(),
        ))));
    }

    #[test]
    fn json_string_of_non_object_metadata_is_rejected() {
        for text in ["[1,2]", "42", "\"text\"", "null"] {
            metadata_rejected(validate_metadata(Some(serde_json::Value::String(
                text.to_string(),
            ))));
        }
    }

    #[test]
    fn array_and_scalar_metadata_are_rejected() {
        metadata_rejected(validate_metadata(Some(serde_json::json!([1, 2]))));
        metadata_rejected(validate_metadata(Some(serde_json::json!(5))));
    }

    // --- map_file_set_write_error (#5: concurrent writes hit the unique index) ---

    fn unique_violation() -> diesel::result::Error {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            Box::new("duplicate key value violates unique constraint".to_string()),
        )
    }

    #[test]
    fn duplicate_set_name_is_reported_as_already_exists() {
        match map_file_set_write_error(unique_violation(), "assets", FileSetWrite::CreateSet) {
            ABError::BadRequest(msg) => {
                assert!(
                    msg.contains("'assets'") && msg.contains("already exists"),
                    "{}",
                    msg
                )
            }
            other => panic!("expected BadRequest, got {:?}", other),
        }
    }

    #[test]
    fn concurrent_new_version_is_a_conflict() {
        match map_file_set_write_error(unique_violation(), "assets", FileSetWrite::CreateVersion) {
            ABError::Conflict(msg) => {
                assert!(msg.contains("'assets'") && msg.contains("retry"), "{}", msg)
            }
            other => panic!("expected Conflict, got {:?}", other),
        }
    }

    #[test]
    fn missing_set_on_new_version_is_not_found() {
        match map_file_set_write_error(
            diesel::result::Error::NotFound,
            "assets",
            FileSetWrite::CreateVersion,
        ) {
            ABError::NotFound(msg) => assert!(msg.contains("'assets'"), "{}", msg),
            other => panic!("expected NotFound, got {:?}", other),
        }
    }

    #[test]
    fn other_database_errors_stay_internal() {
        let err = diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::SerializationFailure,
            Box::new("could not serialize access".to_string()),
        );
        assert!(matches!(
            map_file_set_write_error(err, "assets", FileSetWrite::CreateSet),
            ABError::InternalServerError(_)
        ));
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
    fn many_duplicate_keys_collapse_keeping_first_order() {
        let many: Vec<String> = (0..100_000)
            .map(|i| format!("f{}@version:1", i % 1000))
            .collect();
        let deduped = normalize_file_keys(&many).unwrap();
        assert_eq!(deduped.len(), 1000);
        assert_eq!(deduped[0], "f0@version:1");
        assert_eq!(deduped[999], "f999@version:1");
    }

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

    // --- page_and_count / total_pages: shared by the set list and a set's versions ---

    #[test]
    fn all_returns_every_row_as_one_page() {
        assert_eq!(page_and_count(PaginatedQuery::All, 240), (1, 240));
    }

    #[test]
    fn all_with_no_rows_still_uses_a_count_of_one() {
        assert_eq!(page_and_count(PaginatedQuery::All, 0), (1, 1));
    }

    #[test]
    fn paginated_page_and_count_pass_through() {
        assert_eq!(
            page_and_count(PaginatedQuery::Paginated { page: 3, count: 7 }, 240),
            (3, 7)
        );
    }

    #[test]
    fn no_items_is_one_page() {
        assert_eq!(total_pages(0, 10), 1);
    }

    #[test]
    fn exact_multiple_has_no_extra_page() {
        assert_eq!(total_pages(20, 10), 2);
    }

    #[test]
    fn remainder_adds_a_page() {
        assert_eq!(total_pages(21, 10), 3);
    }

    // --- GET /file-sets/{name} versions query ---

    fn parse_versions_query(qs: &str) -> Result<PaginatedQuery, String> {
        Query::<PaginatedQuery>::from_query(qs)
            .map(Query::into_inner)
            .map_err(|e| e.to_string())
    }

    #[test]
    fn versions_default_to_first_page_of_ten() {
        assert!(matches!(
            parse_versions_query("").unwrap(),
            PaginatedQuery::Paginated { page: 1, count: 10 }
        ));
    }

    #[test]
    fn versions_take_page_and_count() {
        assert!(matches!(
            parse_versions_query("page=2&count=5").unwrap(),
            PaginatedQuery::Paginated { page: 2, count: 5 }
        ));
    }

    #[test]
    fn versions_accept_all() {
        assert!(matches!(
            parse_versions_query("all=true").unwrap(),
            PaginatedQuery::All
        ));
    }

    #[test]
    fn versions_reject_page_zero() {
        assert!(parse_versions_query("page=0").is_err());
    }

    #[test]
    fn versions_page_is_newest_first_with_limit_and_offset() {
        let sql = diesel::debug_query::<diesel::pg::Pg, _>(&set_versions_page_query(
            "org", "app", "demo", 20, 10,
        ))
        .to_string();
        assert!(
            sql.contains("ORDER BY \"hyperotaserver\".\"file_sets\".\"version\" DESC"),
            "{}",
            sql
        );
        assert!(sql.contains("LIMIT $4 OFFSET $5"), "{}", sql);
        assert!(
            sql.ends_with("[\"org\", \"app\", \"demo\", 10, 20]"),
            "{}",
            sql
        );
    }

    // --- sort_member_files ---

    fn order(files: &[FileEntry]) -> Vec<(String, i32)> {
        files
            .iter()
            .map(|f| (f.file_path.clone(), f.version))
            .collect()
    }

    #[test]
    fn member_files_sort_by_path_then_version() {
        let sorted = sort_member_files(vec![
            file(1, "b.js", 1),
            file(2, "a.js", 2),
            file(3, "c.js", 1),
            file(4, "a.js", 1),
        ]);
        assert_eq!(
            order(&sorted),
            vec![
                ("a.js".to_string(), 1),
                ("a.js".to_string(), 2),
                ("b.js".to_string(), 1),
                ("c.js".to_string(), 1)
            ]
        );
    }

    #[test]
    fn already_sorted_member_files_are_unchanged() {
        let sorted = sort_member_files(vec![file(1, "a.js", 1), file(2, "b.js", 3)]);
        assert_eq!(
            order(&sorted),
            vec![("a.js".to_string(), 1), ("b.js".to_string(), 3)]
        );
    }

    #[test]
    fn no_member_files_sort_to_empty() {
        assert!(sort_member_files(vec![]).is_empty());
    }

    // --- resolving a set's keys: every requested key must name a file ---

    #[test]
    fn same_file_by_version_and_tag_is_accepted() {
        let requested = keys(&["a.js@version:1", "a.js@tag:latest"]);
        let resolved = [tagged(1, "a.js", 1, "latest")];
        assert!(unresolved_keys(&requested, &resolved).is_empty());
    }

    #[test]
    fn missing_key_is_named() {
        let requested = keys(&["a.js@version:1", "b.js@version:2"]);
        let resolved = [file(1, "a.js", 1)];
        assert_eq!(
            unresolved_keys(&requested, &resolved),
            vec!["b.js@version:2"]
        );
    }

    #[test]
    fn wrong_version_of_a_path_does_not_resolve_the_key() {
        let requested = keys(&["a.js@version:2"]);
        assert_eq!(
            unresolved_keys(&requested, &[file(1, "a.js", 1)]),
            vec!["a.js@version:2"]
        );
    }

    #[test]
    fn tag_key_needs_that_tag_on_that_path() {
        let requested = keys(&["a.js@tag:prod", "b.js@tag:latest"]);
        let resolved = [
            tagged(1, "a.js", 1, "latest"),
            tagged(2, "c.js", 1, "latest"),
        ];
        assert_eq!(
            unresolved_keys(&requested, &resolved),
            vec!["a.js@tag:prod", "b.js@tag:latest"]
        );
    }

    #[test]
    fn key_without_version_or_tag_never_resolves() {
        let requested = keys(&["a.js"]);
        assert_eq!(
            unresolved_keys(&requested, &[file(1, "a.js", 1)]),
            vec!["a.js"]
        );
    }

    // --- set names: they appear in URLs ---

    #[test]
    fn plain_names_are_accepted() {
        for name in ["hyperpay", "ec-config", "v1.2_final", "9lives", "A"] {
            assert_eq!(validate_name(name).unwrap(), name);
        }
    }

    #[test]
    fn dot_only_names_are_rejected() {
        for name in [".", "..", "..."] {
            assert!(validate_name(name).is_err(), "{} should be rejected", name);
        }
    }

    #[test]
    fn name_must_start_with_letter_or_digit() {
        for name in ["-x", "_x", ".x"] {
            match validate_name(name) {
                Err(ABError::BadRequest(msg)) => assert!(msg.contains("start with"), "{}", msg),
                other => panic!("expected BadRequest for {}, got {:?}", name, other),
            }
        }
    }

    // --- name search: wildcards in the search text are literal ---

    #[test]
    fn search_wildcards_are_matched_literally() {
        assert_eq!(
            name_search_pattern(Some("hyper_pay")).as_deref(),
            Some("%hyper\\_pay%")
        );
        assert_eq!(name_search_pattern(Some("50%")).as_deref(), Some("%50\\%%"));
        assert_eq!(
            name_search_pattern(Some("a\\b")).as_deref(),
            Some("%a\\\\b%")
        );
    }

    #[test]
    fn search_is_trimmed_and_blank_means_none() {
        assert_eq!(name_search_pattern(Some("  ec ")).as_deref(), Some("%ec%"));
        assert_eq!(name_search_pattern(Some("   ")), None);
        assert_eq!(name_search_pattern(None), None);
    }

    // --- stored keys: what a set version keeps, and what reads return ---

    fn tagged(id: u128, path: &str, version: i32, tag: &str) -> FileEntry {
        FileEntry {
            tag: Some(tag.to_string()),
            ..file(id, path, version)
        }
    }

    #[test]
    fn tag_keys_are_stored_as_the_resolved_version() {
        // A caller may send `a.js@tag:latest`; the row it resolved to is
        // version 5, and that pinned key is what gets stored.
        assert_eq!(
            keys_of(vec![tagged(1, "a.js", 5, "latest")]),
            vec!["a.js@version:5"]
        );
    }

    #[test]
    fn stored_keys_are_sorted_by_path_then_version() {
        assert_eq!(
            keys_of(vec![
                file(1, "b.js", 1),
                file(2, "a.js", 2),
                file(3, "a.js", 1)
            ]),
            vec!["a.js@version:1", "a.js@version:2", "b.js@version:1"]
        );
    }

    #[test]
    fn version_response_lists_the_stored_keys_as_is() {
        let row = FileSetEntry {
            id: Uuid::from_u128(9),
            name: "assets".to_string(),
            version: 3,
            metadata: serde_json::json!({"jira": "X-1"}),
            file_keys: vec!["a.js@version:1".to_string(), "b.js@version:4".to_string()],
            created_at: ts(42),
        };
        let v = to_set_version(&row, row.file_keys.clone());
        assert_eq!(v.version, 3);
        assert_eq!(v.files, vec!["a.js@version:1", "b.js@version:4"]);
        assert_eq!(v.metadata, serde_json::json!({"jira": "X-1"}));
        assert_eq!(v.created_at, ts(42).to_rfc3339());
    }

    // --- keys_of: keys of freshly resolved files (create endpoints) ---

    #[test]
    fn resolved_files_become_sorted_keys() {
        assert_eq!(
            keys_of(vec![file(1, "b.js", 3), file(2, "a.js", 1)]),
            vec!["a.js@version:1", "b.js@version:3"]
        );
    }

    #[test]
    fn no_resolved_files_give_no_keys() {
        assert!(keys_of(vec![]).is_empty());
    }

    // --- summaries_to_file_sets: the list response (Y1/Y4: latest version number only) ---

    #[test]
    fn summary_maps_to_name_counts_latest_version_and_dates() {
        let sets = summaries_to_file_sets(vec![(
            "assets".to_string(),
            3,
            Some(ts(100)),
            Some(3),
            Some(ts(300)),
        )]);
        assert_eq!(
            sets,
            vec![FileSet {
                name: "assets".to_string(),
                total_versions: 3,
                latest_version: 3,
                created_at: ts(100).to_rfc3339(),
                updated_at: ts(300).to_rfc3339(),
            }]
        );
    }

    #[test]
    fn list_keeps_the_query_order() {
        let names: Vec<String> = summaries_to_file_sets(vec![
            ("alpha".to_string(), 1, Some(ts(1)), Some(1), Some(ts(1))),
            ("beta".to_string(), 2, Some(ts(2)), Some(2), Some(ts(5))),
        ])
        .into_iter()
        .map(|s| s.name)
        .collect();
        assert_eq!(names, vec!["alpha", "beta"]);
    }

    #[test]
    fn single_version_set_was_created_and_updated_at_once() {
        let sets = summaries_to_file_sets(vec![(
            "one".to_string(),
            1,
            Some(ts(7)),
            Some(1),
            Some(ts(7)),
        )]);
        assert_eq!(sets[0].created_at, sets[0].updated_at);
        assert_eq!(sets[0].latest_version, 1);
    }

    #[test]
    fn list_response_carries_no_file_data() {
        let json = serde_json::to_value(summaries_to_file_sets(vec![(
            "s".to_string(),
            1,
            Some(ts(1)),
            Some(1),
            Some(ts(1)),
        )]))
        .unwrap();
        let keys: Vec<&String> = json[0].as_object().unwrap().keys().collect();
        assert_eq!(
            keys,
            vec![
                "created_at",
                "latest_version",
                "name",
                "total_versions",
                "updated_at"
            ]
        );
    }

    #[test]
    fn empty_page_gives_empty_list() {
        assert!(summaries_to_file_sets(vec![]).is_empty());
        // ...because the offset of page 3 lies past a 3-set listing.
        assert_eq!(page_window(3, 2), (4, 2));
    }
}
