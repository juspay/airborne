pub mod utils;
use crate::{
    package::{types::*, utils::parse_package_key},
    run_blocking,
    types::{ABError, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::db::{
        models::{
            FileEntry, NewPackageGroupEntry, NewPackageV2Entry, PackageGroupsEntry, PackageV2Entry,
        },
        schema::hyperotaserver::{
            files::{
                app_id as file_app_id, file_path, org_id as file_org_id, table as files_table,
                tag as file_tag, version as file_version,
            },
            package_groups::{
                app_id as package_group_app_id, id as pkg_group_id,
                is_primary as package_group_is_primary, name as package_group_name,
                org_id as package_group_org_id, table as package_groups_table,
            },
            packages_v2::{
                app_id as package_app_id, index as package_index, org_id as package_org_id,
                package_group_id, table as packages_table, tag as package_tag,
                version as package_version,
            },
        },
    },
};
use actix_web::{
    get, patch, post,
    web::{self, Json, Query},
    Scope,
};

use crate::{
    file::utils::parse_file_key,
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ, WRITE},
    types as airborne_types,
    types::AppState,
};
use diesel::expression::BoxableExpression;
use diesel::pg::Pg;
use diesel::sql_types::Bool;
use diesel::RunQueryDsl;
use diesel::{dsl::count_star, prelude::*};

pub mod types;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_package)
        .service(get_package)
        .service(list_packages)
}

pub fn add_package_group_routes() -> Scope {
    Scope::new("")
        .service(create_package_group)
        .service(get_package_groups)
        .service(get_package_group)
        .service(update_group_name)
        .service(get_packages_v2)
        .service(create_packages_v2)
        .service(get_package_v2_tag)
        .service(get_package_v2_version)
}

#[post("")]
async fn create_package(
    req: web::Json<CreatePackageInput>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<Package>>> {
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

    let index = request.index.trim();
    if index.is_empty() {
        return Err(ABError::BadRequest(
            "Index file must be provided and cannot be empty".to_string(),
        ));
    }
    let index = index.to_string();

    let package = run_blocking!({
        let mut conn = pool.get()?;

        let files: Vec<FileEntry> = if !request.files.is_empty() {
            let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

            for file_id in &request.files {
                let (fp, ver_opt, tag_opt) = parse_file_key(file_id);

                if let Some(v) = ver_opt {
                    file_conds.push(Box::new(file_path.eq(fp.clone()).and(file_version.eq(v))));
                } else if let Some(t) = tag_opt {
                    file_conds.push(Box::new(
                        file_path
                            .eq(fp.clone())
                            .and(file_tag.is_not_distinct_from(t.clone())),
                    ));
                } else {
                    return Err(ABError::BadRequest("Invalid file key format".to_string()));
                }
            }

            let combined = file_conds
                .into_iter()
                .reduce(|a, b| Box::new(a.or(b)))
                .unwrap_or(Box::new(file_path.eq("")));

            let files: Vec<FileEntry> = files_table
                .into_boxed::<Pg>()
                .filter(file_org_id.eq(&organisation))
                .filter(file_app_id.eq(&application))
                .filter(combined)
                .load(&mut conn)?;
            files
        } else {
            vec![]
        };

        if files.len() != request.files.len() {
            return Err(ABError::BadRequest("Some files not found".to_string()));
        }

        // Validate that the index file exists in the database
        let (index_fp, index_ver_opt, index_tag_opt) = parse_file_key(&index);
        let mut index_query = files_table
            .into_boxed::<Pg>()
            .filter(file_org_id.eq(&organisation))
            .filter(file_app_id.eq(&application))
            .filter(file_path.eq(&index_fp));

        if let Some(v) = index_ver_opt {
            index_query = index_query.filter(file_version.eq(v));
        } else if let Some(t) = index_tag_opt {
            index_query = index_query.filter(file_tag.is_not_distinct_from(t));
        } else {
            return Err(ABError::BadRequest(
                "Invalid index file key format".to_string(),
            ));
        }

        let _index_file: FileEntry = index_query
            .select(FileEntry::as_select())
            .first::<FileEntry>(&mut conn)
            .optional()?
            .ok_or_else(|| ABError::BadRequest("Index file not found".to_string()))?;

        let primary_group: PackageGroupsEntry = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(package_group_is_primary.eq(true))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)?;

        let latest_package = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
            .filter(package_group_id.eq(&primary_group.id))
            .order(package_version.desc())
            .select(PackageV2Entry::as_select())
            .first::<PackageV2Entry>(&mut conn)
            .optional()?;

        let new_version = if let Some(latest) = latest_package {
            latest.version + 1
        } else {
            1
        };

        let new_package = NewPackageV2Entry {
            index: Some(index.clone()),
            org_id: organisation.clone(),
            app_id: application.clone(),
            tag: request.tag.clone(),
            version: new_version,
            package_group_id: primary_group.id,
            files: files
                .iter()
                .map(|f| Some(format!("{}@version:{}", f.file_path, f.version)))
                .collect(),
        };

        let result = diesel::insert_into(packages_table)
            .values(&new_package)
            .returning(PackageV2Entry::as_returning())
            .get_result::<PackageV2Entry>(&mut conn)?;

        Ok(result)
    })?;

    Ok(
        WithHeaders::new(Json(utils::db_response_to_package(package)))
            .status(actix_web::http::StatusCode::CREATED),
    )
}

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

    let package = run_blocking!({
        let mut conn = pool.get()?;

        let primary_group: PackageGroupsEntry = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(package_group_is_primary.eq(true))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)?;

        if let Some(pkg_tag) = opt_pkg_tag {
            let result = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_group_id.eq(&primary_group.id))
                .filter(package_tag.eq(&pkg_tag))
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)?;
            Ok(result)
        } else if let Some(pkg_version) = opt_pkg_version {
            let result = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_group_id.eq(&primary_group.id))
                .filter(package_version.eq(&pkg_version))
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)?;
            Ok(result)
        } else {
            Err(ABError::BadRequest("Bad format for package id".to_string()))
        }
    })?;

    Ok(Json(utils::db_response_to_package(package)))
}

#[get("/list")]
async fn list_packages(
    pagination_query: Query<PaginatedQuery>,
    package_query: Query<ListPackageQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<Package>>> {
    let search = package_query.search.clone();
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

    let response = run_blocking!({
        let mut conn = pool.get()?;

        let primary_group: PackageGroupsEntry = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(package_group_is_primary.eq(true))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)?;

        let build_base_query = || {
            let mut base_query = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_group_id.eq(&primary_group.id))
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

#[post("")]
async fn create_package_group(
    req: web::Json<CreatePackageGroupReq>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PackageGroup>> {
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
    let name = req.name.clone();

    let new_package_group = run_blocking!({
        let mut conn = pool.get()?;

        // Check if a package group with the same name already exists
        let existing_group = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(package_group_name.eq(&name))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)
            .optional()?;

        if existing_group.is_some() {
            return Err(ABError::BadRequest(format!(
                "Package group with name '{}' already exists",
                name
            )));
        }

        let new_package_group_entry = NewPackageGroupEntry {
            app_id: application,
            org_id: organisation,
            name,
            is_primary: false,
        };

        let new_group: PackageGroupsEntry = diesel::insert_into(package_groups_table)
            .values(&new_package_group_entry)
            .returning(PackageGroupsEntry::as_returning())
            .get_result(&mut conn)?;

        Ok(PackageGroup {
            name: new_group.name,
            is_primary: new_group.is_primary,
            id: new_group.id,
        })
    })?;

    Ok(Json(new_package_group))
}

#[get("")]
async fn get_package_groups(
    pagination_query: Query<PaginatedQuery>,
    search_query: Query<SearchQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<PackageGroup>>> {
    let auth_response = auth_response.into_inner();
    let search = search_query.search.clone();

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

    let package_groups = run_blocking!({
        let mut conn = pool.get()?;

        let build_base_query = || {
            let mut base_query = package_groups_table
                .filter(package_group_app_id.eq(&application))
                .filter(package_group_org_id.eq(&organisation))
                .into_boxed();

            if let Some(ref search_str) = search {
                let pattern = format!("%{}%", search_str);
                base_query = base_query.filter(package_group_name.ilike(pattern));
            }

            base_query
        };

        match *pagination_query {
            PaginatedQuery::All => {
                let rows: Vec<PackageGroupsEntry> = build_base_query()
                    .order((package_group_is_primary.desc(), package_group_name.asc()))
                    .select(PackageGroupsEntry::as_select())
                    .load(&mut conn)?;
                Ok(PaginatedResponse::all(
                    rows.into_iter()
                        .map(|group| PackageGroup {
                            name: group.name,
                            is_primary: group.is_primary,
                            id: group.id,
                        })
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

                let rows: Vec<PackageGroupsEntry> = build_base_query()
                    .offset(offset)
                    .limit(count)
                    .order((package_group_is_primary.desc(), package_group_name.asc()))
                    .select(PackageGroupsEntry::as_select())
                    .load(&mut conn)?;

                let package_groups: Vec<PackageGroup> = rows
                    .into_iter()
                    .map(|group| PackageGroup {
                        name: group.name,
                        is_primary: group.is_primary,
                        id: group.id,
                    })
                    .collect();

                let total_pages = (total_count + count - 1) / count;

                Ok(PaginatedResponse {
                    data: package_groups,
                    total_items: total_count as u64,
                    total_pages: total_pages as u32,
                })
            }
        }
    })?;

    Ok(Json(package_groups))
}

#[get("/{group_id}")]
async fn get_package_group(
    group_id: web::Path<uuid::Uuid>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PackageGroup>> {
    let auth_response = auth_response.into_inner();
    let group_id = group_id.into_inner();

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

    let result = run_blocking!({
        let mut conn = pool.get()?;

        let group: PackageGroupsEntry = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(pkg_group_id.eq(&group_id))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)?;

        Ok(PackageGroup {
            name: group.name,
            is_primary: group.is_primary,
            id: group.id,
        })
    })?;

    Ok(Json(result))
}

#[patch("/{group_id}")]
async fn update_group_name(
    group_id: web::Path<uuid::Uuid>,
    req: web::Json<CreatePackageGroupReq>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PackageGroup>> {
    let auth_response = auth_response.into_inner();
    let group_id = group_id.into_inner();

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
    let new_name = req.name.clone();

    let result = run_blocking!({
        let mut conn = pool.get()?;

        // Check if a package group with the same name already exists
        let existing_group = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(package_group_name.eq(&new_name))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)
            .optional()?;

        if existing_group.is_some() {
            return Err(ABError::BadRequest(format!(
                "Package group with name '{}' already exists",
                new_name
            )));
        }

        let updated: PackageGroupsEntry = diesel::update(
            package_groups_table
                .filter(package_group_org_id.eq(&organisation))
                .filter(package_group_app_id.eq(&application))
                .filter(pkg_group_id.eq(&group_id)),
        )
        .set(package_group_name.eq(&new_name))
        .returning(PackageGroupsEntry::as_returning())
        .get_result(&mut conn)?;

        Ok(PackageGroup {
            name: updated.name,
            is_primary: updated.is_primary,
            id: updated.id,
        })
    })?;

    Ok(Json(result))
}

#[get("/{group_id}/packages")]
async fn get_packages_v2(
    group_id: web::Path<uuid::Uuid>,
    pagination_query: Query<PaginatedQuery>,
    search_query: Query<SearchQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PaginatedResponse<PackageV2>>> {
    let auth_response = auth_response.into_inner();
    let group_id = group_id.into_inner();
    let search = search_query.search.clone();

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

    let packages = run_blocking!({
        let mut conn = pool.get()?;

        let build_base_query = || {
            let mut base_query = packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_group_id.eq(&group_id))
                .into_boxed();

            if let Some(ref search_str) = search {
                let pattern = format!("%{}%", search_str);
                base_query = base_query.filter(package_index.ilike(pattern));
            }
            base_query
        };

        match *pagination_query {
            PaginatedQuery::All => {
                let rows = build_base_query()
                    .order(package_version.desc())
                    .select(PackageV2Entry::as_select())
                    .load(&mut conn)?;
                Ok(PaginatedResponse::all(
                    rows.into_iter()
                        .map(utils::db_response_to_package_v2)
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

                let packages: Vec<PackageV2> = rows
                    .into_iter()
                    .map(utils::db_response_to_package_v2)
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

    Ok(Json(packages))
}

#[post("{group_id}/packages")]
async fn create_packages_v2(
    group_id: web::Path<uuid::Uuid>,
    req: web::Json<CreatePackageInputV2>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<WithHeaders<Json<PackageV2>>> {
    let auth_response = auth_response.into_inner();
    let group_id = group_id.into_inner();

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

    let package = run_blocking!({
        let mut conn = pool.get()?;

        // Check if the package group exists and get its primary status
        let group: PackageGroupsEntry = package_groups_table
            .filter(package_group_org_id.eq(&organisation))
            .filter(package_group_app_id.eq(&application))
            .filter(pkg_group_id.eq(&group_id))
            .select(PackageGroupsEntry::as_select())
            .first::<PackageGroupsEntry>(&mut conn)?;

        // Validate index based on whether group is primary
        let index = if group.is_primary {
            match &request.index {
                Some(idx) => {
                    let trimmed = idx.trim();
                    if trimmed.is_empty() {
                        return Err(ABError::BadRequest(
                            "Index file is required for primary package group and cannot be empty"
                                .to_string(),
                        ));
                    }
                    Some(trimmed.to_string())
                }
                None => {
                    return Err(ABError::BadRequest(
                        "Index file is required for primary package group".to_string(),
                    ));
                }
            }
        } else {
            if request.index.is_some() {
                return Err(ABError::BadRequest(
                    "Index file should not be provided for non-primary package group".to_string(),
                ));
            }
            None
        };

        let files: Vec<FileEntry> = if !request.files.is_empty() {
            let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

            for file_id in &request.files {
                let (fp, ver_opt, tag_opt) = parse_file_key(file_id);

                if let Some(v) = ver_opt {
                    file_conds.push(Box::new(file_path.eq(fp.clone()).and(file_version.eq(v))));
                } else if let Some(t) = tag_opt {
                    file_conds.push(Box::new(
                        file_path
                            .eq(fp.clone())
                            .and(file_tag.is_not_distinct_from(t.clone())),
                    ));
                } else {
                    return Err(ABError::BadRequest("Invalid file key format".to_string()));
                }
            }

            let combined = file_conds
                .into_iter()
                .reduce(|a, b| Box::new(a.or(b)))
                .unwrap_or(Box::new(file_path.eq("")));

            let files: Vec<FileEntry> = files_table
                .into_boxed::<Pg>()
                .filter(file_org_id.eq(&organisation))
                .filter(file_app_id.eq(&application))
                .filter(combined)
                .load(&mut conn)?;
            files
        } else {
            vec![]
        };

        if files.len() != request.files.len() {
            return Err(ABError::BadRequest("Some files not found".to_string()));
        }

        // Validate that the index file exists in the database (for primary groups)
        if let Some(ref idx) = index {
            let (index_fp, index_ver_opt, index_tag_opt) = parse_file_key(idx);
            let mut index_query = files_table
                .into_boxed::<Pg>()
                .filter(file_org_id.eq(&organisation))
                .filter(file_app_id.eq(&application))
                .filter(file_path.eq(&index_fp));

            if let Some(v) = index_ver_opt {
                index_query = index_query.filter(file_version.eq(v));
            } else if let Some(t) = index_tag_opt {
                index_query = index_query.filter(file_tag.is_not_distinct_from(t));
            } else {
                return Err(ABError::BadRequest(
                    "Invalid index file key format".to_string(),
                ));
            }

            let _index_file: FileEntry = index_query
                .select(FileEntry::as_select())
                .first::<FileEntry>(&mut conn)
                .optional()?
                .ok_or_else(|| ABError::BadRequest("Index file not found".to_string()))?;
        }

        let latest_package = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
            .filter(package_group_id.eq(&group_id))
            .order(package_version.desc())
            .select(PackageV2Entry::as_select())
            .first::<PackageV2Entry>(&mut conn)
            .optional()?;

        let new_version = if let Some(latest) = latest_package {
            latest.version + 1
        } else {
            1
        };

        let new_package = NewPackageV2Entry {
            index: index.clone(),
            org_id: organisation.clone(),
            app_id: application.clone(),
            tag: request.tag.clone(),
            version: new_version,
            package_group_id: group_id,
            files: files
                .iter()
                .map(|f| Some(format!("{}@version:{}", f.file_path, f.version)))
                .collect(),
        };

        let result = diesel::insert_into(packages_table)
            .values(&new_package)
            .returning(PackageV2Entry::as_returning())
            .get_result::<PackageV2Entry>(&mut conn)?;

        Ok(result)
    })?;

    Ok(
        WithHeaders::new(Json(utils::db_response_to_package_v2(package)))
            .status(actix_web::http::StatusCode::CREATED),
    )
}

#[get("{group_id}/packages/version/{version}")]
async fn get_package_v2_version(
    path: web::Path<(uuid::Uuid, i32)>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PackageV2>> {
    let (group_id, version) = path.into_inner();

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

    let package = run_blocking!({
        let mut conn = pool.get()?;
        let result = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
            .filter(package_group_id.eq(&group_id))
            .filter(package_version.eq(&version))
            .select(PackageV2Entry::as_select())
            .first::<PackageV2Entry>(&mut conn)?;
        Ok(result)
    })?;

    Ok(Json(utils::db_response_to_package_v2(package)))
}

#[get("{group_id}/packages/tag/{tag}")]
async fn get_package_v2_tag(
    path: web::Path<(uuid::Uuid, String)>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<PackageV2>> {
    let (group_id, tag) = path.into_inner();

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

    let package = run_blocking!({
        let mut conn = pool.get()?;
        let result = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
            .filter(package_group_id.eq(&group_id))
            .filter(package_tag.eq(&tag))
            .select(PackageV2Entry::as_select())
            .first::<PackageV2Entry>(&mut conn)?;
        Ok(result)
    })?;

    Ok(Json(utils::db_response_to_package_v2(package)))
}
