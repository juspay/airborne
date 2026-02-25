pub mod types;

use actix_web::{
    get,
    web::{self, Json, Query, ReqData},
};
use diesel::prelude::*;

use crate::{
    file::groups::types::*,
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ},
    run_blocking, types as airborne_types,
    types::{ABError, AppState},
    utils::db::{models::FileEntry as DbFile, schema::hyperotaserver::files::dsl::*},
};

pub fn add_routes() -> actix_web::Scope {
    actix_web::Scope::new("/groups").service(list_file_groups)
}

/// Parse comma-separated tags into a vector
fn parse_tags(tags: Option<&str>) -> Vec<String> {
    tags.map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    })
    .unwrap_or_default()
}

/// Escape SQL LIKE wildcard characters in search term
/// Escapes '%', '_', and '\' with backslash
fn escape_like_pattern(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

#[get("")]
async fn list_file_groups(
    query: Query<FileGroupsQuery>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<FileGroupsListResponse>> {
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
    let query = query.into_inner();
    let pagination = query.pagination;
    let search_term = query.search.clone();
    let tags_filter = parse_tags(query.tags.as_deref());

    let (groups, total_items, total_pages) = run_blocking!({
        let mut conn = pool.get()?;

        // Get total count of distinct file_paths matching filters
        let total_items: i64 = {
            let mut count_query = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .into_boxed();

            if let Some(search) = &search_term {
                let escaped = escape_like_pattern(search);
                let pattern = format!("%{}%", escaped);
                count_query = count_query.filter(file_path.ilike(pattern).escape('\\'));
            }

            if !tags_filter.is_empty() {
                count_query = count_query.filter(tag.eq_any(&tags_filter));
            }

            count_query
                .select(diesel::dsl::count_distinct(file_path))
                .first(&mut conn)?
        };

        // Determine pagination params
        let (page, count) = match pagination {
            crate::types::PaginatedQuery::All => (1u32, total_items as u32),
            crate::types::PaginatedQuery::Paginated { page, count } => (page, count),
        };

        // Get the distinct file_paths for this page using a subquery approach
        // First, get distinct file_paths without group_by on boxed query
        let file_paths: Vec<String> = if tags_filter.is_empty() {
            let mut path_query = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .into_boxed();

            if let Some(search) = &search_term {
                let escaped = escape_like_pattern(search);
                let pattern = format!("%{}%", escaped);
                path_query = path_query.filter(file_path.ilike(pattern).escape('\\'));
            }

            path_query
                .select(file_path)
                .distinct()
                .order(file_path.asc())
                .limit(count as i64)
                .offset(((page.saturating_sub(1)) * count) as i64)
                .load(&mut conn)?
        } else {
            // When filtering by tags, we need to get distinct file_paths from filtered results
            let mut path_query = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .filter(tag.eq_any(&tags_filter))
                .into_boxed();

            if let Some(search) = &search_term {
                let escaped = escape_like_pattern(search);
                let pattern = format!("%{}%", escaped);
                path_query = path_query.filter(file_path.ilike(pattern).escape('\\'));
            }

            path_query
                .select(file_path)
                .distinct()
                .order(file_path.asc())
                .limit(count as i64)
                .offset(((page.saturating_sub(1)) * count) as i64)
                .load(&mut conn)?
        };

        // For each file_path, get last 50 versions and their tags
        let mut groups = Vec::new();

        for fp in file_paths {
            // Get last 50 versions for this file_path
            let file_versions: Vec<DbFile> = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .filter(file_path.eq(&fp))
                .order(version.desc())
                .limit(50)
                .select(DbFile::as_select())
                .load(&mut conn)?;

            let total_versions = files
                .filter(org_id.eq(&organisation))
                .filter(app_id.eq(&application))
                .filter(file_path.eq(&fp))
                .select(diesel::dsl::count_star())
                .first::<i64>(&mut conn)?;

            // Build versions list
            let versions: Vec<FileGroupVersion> = file_versions
                .iter()
                .map(|f| FileGroupVersion {
                    version: f.version,
                    url: f.url.clone(),
                    size: f.size,
                    checksum: f.checksum.clone(),
                    created_at: f.created_at.to_rfc3339(),
                })
                .collect();

            // Build tags list (tag -> version mapping)
            let tags: Vec<FileGroupTag> = file_versions
                .iter()
                .filter_map(|f| {
                    f.tag.as_ref().map(|t| FileGroupTag {
                        tag: t.clone(),
                        version: f.version,
                    })
                })
                .collect();

            groups.push(FileGroupResponse {
                file_path: fp,
                versions,
                tags,
                total_versions,
            });
        }

        let total_pages = if total_items == 0 {
            1u32
        } else {
            ((total_items as f64) / (count as f64)).ceil() as u32
        };

        Ok((groups, total_items as u64, total_pages))
    })?;

    Ok(Json(FileGroupsListResponse {
        groups,
        total_items,
        total_pages,
    }))
}
