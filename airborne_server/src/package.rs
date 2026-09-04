pub mod utils;
use crate::{
    package::{types::*, utils::parse_package_key},
    release::utils::get_files_by_file_keys_async,
    run_blocking,
    types::{ABError, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::db::{
        models::{FileEntry, FileGroupEntry, NewPackageV2Entry, PackageV2Entry},
        schema::hyperotaserver::{
            file_groups, files as files_table_mod,
            packages_v2::{
                app_id as package_app_id, index as package_index, org_id as package_org_id,
                table as packages_table, tag as package_tag, version as package_version,
            },
        },
        DbPool,
    },
};
use actix_web::{
    get, post,
    web::{self, Json, Query},
    Scope,
};
use airborne_authz_macros::authz;

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    types as airborne_types,
    types::AppState,
};
use diesel::RunQueryDsl;
use diesel::{dsl::count_star, prelude::*};

pub mod types;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_package)
        .service(get_package)
        .service(list_packages)
}

#[authz(
    resource = "package",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("")]
async fn create_package(
    req: web::Json<CreatePackageInput>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<Package>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let pool = state.db_pool.clone();
    let request = req.into_inner();

    let files = get_files_by_file_keys_async(
        state.db_pool.clone(),
        &state.redis_cache,
        organisation.clone(),
        application.clone(),
        request.files.clone(),
    )
    .await?;

    if files.len() != request.files.len() {
        return Err(ABError::BadRequest("Some files not found".to_string()));
    }

    let opt_pkg_tag = request.tag.clone();
    let db_organisation = organisation.clone();
    let db_application = application.clone();
    let db_pkg_index = request.index.clone();
    let group_refs = request.file_groups.clone().unwrap_or_default();
    let package = run_blocking!({
        let mut conn = pool.get()?;

        // Resolve each referenced file group version to its member files and
        // snapshot them: the package remembers exactly which groups (at which
        // group version) contributed which files.
        let mut group_snapshots: Vec<PackageFileGroup> = Vec::new();
        // Rule: the exact same file (path AND version) must not enter the
        // package twice — across groups, or a group vs an individually
        // chosen file. The same path at a different version is allowed.
        let mut seen: std::collections::HashMap<String, String> = files
            .iter()
            .map(|f| {
                (
                    format!("{}@version:{}", f.file_path, f.version),
                    "individually selected files".to_string(),
                )
            })
            .collect();

        for group_ref in &group_refs {
            let group: FileGroupEntry = file_groups::table
                .filter(file_groups::org_id.eq(&db_organisation))
                .filter(file_groups::app_id.eq(&db_application))
                .filter(file_groups::name.eq(&group_ref.name))
                .filter(file_groups::version.eq(group_ref.version))
                .select(FileGroupEntry::as_select())
                .first(&mut conn)
                .optional()?
                .ok_or_else(|| {
                    ABError::BadRequest(format!(
                        "Version {} of file group '{}' not found",
                        group_ref.version, group_ref.name
                    ))
                })?;

            let member_files: Vec<FileEntry> = files_table_mod::table
                .filter(files_table_mod::id.eq_any(&group.file_ids))
                .select(FileEntry::as_select())
                .load(&mut conn)?;

            let mut keys: Vec<String> = Vec::new();
            for f in &member_files {
                let key = format!("{}@version:{}", f.file_path, f.version);
                if let Some(source) =
                    seen.insert(key.clone(), format!("file group '{}'", group.name))
                {
                    return Err(ABError::BadRequest(format!(
                        "Duplicate file '{}': included by both {} and file group '{}'",
                        key, source, group.name
                    )));
                }
                keys.push(key);
            }

            group_snapshots.push(PackageFileGroup {
                name: group.name,
                version: group.version,
                files: keys,
            });
        }

        let latest_package = packages_table
            .filter(package_org_id.eq(&db_organisation))
            .filter(package_app_id.eq(&db_application))
            .order(package_version.desc())
            .select(PackageV2Entry::as_select())
            .first::<PackageV2Entry>(&mut conn)
            .optional()?;

        let new_version = if let Some(latest) = latest_package {
            latest.version + 1
        } else {
            1
        };

        let all_files: Vec<Option<String>> = files
            .iter()
            .map(|f| Some(format!("{}@version:{}", f.file_path, f.version)))
            .chain(
                group_snapshots
                    .iter()
                    .flat_map(|g| g.files.iter().cloned().map(Some)),
            )
            .collect();

        let new_package = NewPackageV2Entry {
            index: db_pkg_index.clone(),
            org_id: db_organisation.clone(),
            app_id: db_application.clone(),
            tag: opt_pkg_tag.clone(),
            version: new_version,
            files: all_files,
            file_groups: serde_json::to_value(&group_snapshots)
                .map_err(|e| ABError::InternalServerError(e.to_string()))?,
        };

        let result = diesel::insert_into(packages_table)
            .values(&new_package)
            .returning(PackageV2Entry::as_returning())
            .get_result::<PackageV2Entry>(&mut conn)?;

        Ok(result)
    })?;

    // remove this tag package from redis cache if exists
    if let Some(pkg_tag) = request.tag.clone() {
        if let Some(ref cache) = state.redis_cache {
            let cache_key = cache.key(
                &organisation,
                &application,
                &["package", &format!("tag:{}", &pkg_tag)],
            );
            let _ = cache.del(&cache_key).await;
        }
    }

    Ok(
        WithHeaders::new(Json(utils::db_response_to_package(package)))
            .status(actix_web::http::StatusCode::CREATED),
    )
}

#[authz(
    resource = "package",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn get_package(
    query: Query<GetPackageQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Package>> {
    let package_id = query.into_inner().package_key;
    let (opt_pkg_version, mut opt_pkg_tag) = parse_package_key(&package_id);

    if opt_pkg_tag.is_none() && opt_pkg_version.is_none() {
        opt_pkg_tag = Some("latest".to_string());
    }

    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let pool = state.db_pool.clone();

    let package = match state.redis_cache {
        Some(ref cache) => {
            let cache_key = cache.key(&organisation, &application, &["package", &package_id]);

            const WEEK: usize = 7 * 24 * 60 * 60; // 604800

            cache
                .get_or_try_set::<Package, _, _>(&cache_key, WEEK, || async {
                    get_package_from_db(
                        organisation.to_owned(),
                        application.to_owned(),
                        opt_pkg_version,
                        opt_pkg_tag.to_owned(),
                        pool.to_owned(),
                    )
                    .await
                })
                .await
        }
        None => {
            let package = get_package_from_db(
                organisation.to_owned(),
                application.to_owned(),
                opt_pkg_version,
                opt_pkg_tag.to_owned(),
                pool.to_owned(),
            )
            .await?;
            Ok(package)
        }
    }?;

    Ok(Json(package))
}

async fn get_package_from_db(
    organisation: String,
    application: String,
    opt_pkg_version: Option<i32>,
    opt_pkg_tag: Option<String>,
    pool: DbPool,
) -> airborne_types::Result<Package> {
    let package = run_blocking!({
        let mut conn = pool.get()?;

        if let Some(pkg_tag) = opt_pkg_tag {
            let result = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_tag.eq(&pkg_tag))
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)?;
            Ok(result)
        } else if let Some(pkg_version) = opt_pkg_version {
            let result = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_version.eq(&pkg_version))
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)?;
            Ok(result)
        } else {
            Err(ABError::BadRequest("Bad format for package id".to_string()))
        }
    })?;

    Ok(utils::db_response_to_package(package))
}

#[authz(
    resource = "package",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/list")]
async fn list_packages(
    pagination_query: Query<PaginatedQuery>,
    package_query: Query<ListPackageQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<Package>>> {
    let search = package_query.search.clone();
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    let pool = state.db_pool.clone();

    let response = run_blocking!({
        let mut conn = pool.get()?;

        let build_base_query = || {
            let mut base_query = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .into_boxed();

            if let Some(ref search_str) = search {
                let pattern = format!("%{}%", search_str);
                base_query = base_query.filter(package_index.ilike(pattern));
            }

            base_query
        };

        match *pagination_query {
            PaginatedQuery::All => {
                let rows: Vec<PackageV2Entry> = build_base_query()
                    .order(package_version.desc())
                    .select(PackageV2Entry::as_select())
                    .load(&mut conn)?;
                Ok::<_, ABError>(PaginatedResponse::all(
                    rows.into_iter()
                        .map(utils::db_response_to_package)
                        .collect(),
                ))
            }
            PaginatedQuery::Paginated { page, count } => {
                let total_count: i64 = build_base_query()
                    .select(count_star())
                    .first::<i64>(&mut conn)?;

                let page = page as i64;
                let count = count as i64;
                let offset = (page - 1) * count;

                let rows: Vec<PackageV2Entry> = build_base_query()
                    .offset(offset)
                    .limit(count)
                    .order(package_version.desc())
                    .select(PackageV2Entry::as_select())
                    .load(&mut conn)?;

                let packages: Vec<Package> = rows
                    .into_iter()
                    .map(utils::db_response_to_package)
                    .collect();

                let total_pages = (total_count + count - 1) / count;

                Ok(PaginatedResponse {
                    data: packages,
                    total_items: total_count as u64,
                    total_pages: total_pages as u32,
                })
            }
        }
    })?;

    Ok(Json(response))
}
