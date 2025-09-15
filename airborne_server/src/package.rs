pub mod utils;
use crate::{
    package::{types::*, utils::parse_package_key},
    run_blocking,
    types::ABError,
    utils::db::{
        models::{FileEntry, NewPackageV2Entry, PackageV2Entry},
        schema::hyperotaserver::{
            files::{
                app_id as file_app_id, file_path, org_id as file_org_id, table as files_table,
                tag as file_tag, version as file_version,
            },
            packages_v2::{
                app_id as package_app_id, org_id as package_org_id, table as packages_table,
                tag as package_tag, version as package_version,
            },
        },
    },
};
use actix_web::{
    get, post,
    web::{self, Query},
    HttpResponse, Result, Scope,
};

use crate::{
    file::utils::parse_file_key,
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ, WRITE},
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

#[post("")]
async fn create_package(
    req: web::Json<CreatePackageInput>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ABError> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
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

        let files: Vec<FileEntry> = if !request.files.is_empty() {
            let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

            for file_id in &request.files {
                let (fp, ver_opt, tag_opt) = parse_file_key(file_id);

                if let Some(v) = ver_opt {
                    file_conds.push(Box::new(file_path.eq(fp.clone()).and(file_version.eq(v))));
                } else if let Some(t) = tag_opt {
                    file_conds.push(Box::new(
                        file_path.eq(fp.clone()).and(file_tag.eq(t.clone())),
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

        let latest_package = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
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
            index: request.index.clone(),
            org_id: organisation.clone(),
            app_id: application.clone(),
            tag: request.tag.clone(),
            version: new_version,
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

    Ok(HttpResponse::Created().json(utils::db_response_to_package(package)))
}

#[get("")]
async fn get_package(
    query: Query<GetPackageQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ABError> {
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
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let pool = state.db_pool.clone();

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

    Ok(HttpResponse::Ok().json(utils::db_response_to_package(package)))
}

#[get("/list")]
async fn list_packages(
    input: Query<ListPackagesInput>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ABError> {
    let ListPackagesInput { offset, limit } = input.into_inner();
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

    // sanitize / defaults
    let offset_val = offset.unwrap_or(0).max(0) as i64;
    let limit_val = limit.unwrap_or(10).clamp(1, 100) as i64; // default 10, max 100

    let pool = state.db_pool.clone();

    let (total_count, rows) = run_blocking!({
        let mut conn = pool.get()?;

        // 1) total count
        let total_count: i64 = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
            .select(count_star())
            .first(&mut conn)?;

        // 2) fetch one page
        let rows: Vec<PackageV2Entry> = packages_table
            .filter(package_org_id.eq(&organisation))
            .filter(package_app_id.eq(&application))
            .order(package_version.desc())
            .offset(offset_val)
            .limit(limit_val)
            .select(PackageV2Entry::as_select())
            .load(&mut conn)?;

        Ok((total_count, rows))
    })?;

    // 3) map to your public DTO
    let packages: Vec<Package> = rows
        .into_iter()
        .map(utils::db_response_to_package)
        .collect();

    // 4) build pagination
    let total_pages = ((total_count + limit_val - 1) / limit_val) as i32;
    let page_number = (offset_val / limit_val + 1) as i32;
    let next_offset =
        (offset_val + limit_val < total_count).then(|| (offset_val + limit_val) as i32);
    let prev_offset = (offset_val >= limit_val).then(|| (offset_val - limit_val) as i32);

    let out = ListPackagesOutput {
        packages,
        page_number,
        next_offset,
        prev_offset,
        total_pages,
    };

    Ok(HttpResponse::Ok().json(out))
}
