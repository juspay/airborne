pub mod utils;
use actix_web::{get, post, web::{self, Query}, HttpResponse, Result, Scope};
use crate::{middleware::auth::READ, package::utils::parse_package_key, utils::db::{
    models::{FileEntry, NewPackageV2Entry, PackageV2Entry},
    schema::hyperotaserver::{
        files::{
            app_id as file_app_id, file_path, org_id as file_org_id, table as files_table, tag as file_tag, version as file_version
        },
        packages_v2::{
            app_id as package_app_id, org_id as package_org_id, table as packages_table, tag as package_tag, version as package_version
        },
    }
}};
use serde::{Deserialize, Serialize};
use crate::{
    types::AppState, middleware::auth::{validate_user, AuthResponse, WRITE},
    file::utils::parse_file_key,
};
use diesel::{dsl::count_star, prelude::*};
use diesel::RunQueryDsl;
use diesel::pg::Pg;
use diesel::expression::BoxableExpression;
use diesel::sql_types::Bool;

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub id: String,
    pub index: String,
    pub org_id: String,
    pub app_id: String,
    pub tag: String,
    pub version: i32,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageInput {
    pub index: String,
    pub tag: String,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListPackagesInput {
    pub offset: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ListPackagesOutput {
    pub packages: Vec<Package>,
    pub page_number: i32,
    pub next_offset: Option<i32>,
    pub prev_offset: Option<i32>,
    pub total_pages: i32,
}

#[derive(Debug, Deserialize)]
pub struct GetPackageQuery {
    pub package_key: String,
}

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(create_package)
        .service(get_package)
        .service(list_packages)
}

fn db_response_to_package(
    db_pkg: PackageV2Entry
) -> Package {
    return Package {
        id: format!("version:{}", db_pkg.version),
        index: db_pkg.index,
        org_id: db_pkg.org_id,
        app_id: db_pkg.app_id,
        tag: db_pkg.tag,
        version: db_pkg.version,
        files: db_pkg.files.into_iter().flatten().collect(),
    };
}

#[post("/create")]
async fn create_package(
    req: web::Json<CreatePackageInput>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, WRITE)
        .map_err(actix_web::error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, WRITE)
        .map_err(actix_web::error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let mut file_conds: Vec<Box<dyn BoxableExpression<_, Pg, SqlType = Bool>>> = Vec::new();

    for file_id in &req.files {
        let (fp, ver_opt, tag_opt) = parse_file_key(file_id);

        if let Some(v) = ver_opt {
            file_conds.push(Box::new(
                file_path
                    .eq(fp.clone())
                    .and(file_version.eq(v))
            ));
        } else if let Some(t) = tag_opt {
            file_conds.push(Box::new(
                file_path
                    .eq(fp.clone())
                    .and(file_tag.eq(t.clone()))
            ));
        } else {
            return Err(actix_web::error::ErrorBadRequest("Invalid file key format"));
        }
    }

    let combined = file_conds
        .into_iter()
        .reduce(|a, b| Box::new(a.or(b)))
        .expect("we already returned on empty req.files");

    let files: Vec<FileEntry> = files_table
        .into_boxed::<Pg>()
        .filter(file_org_id.eq(&organisation))
        .filter(file_app_id.eq(&application))
        .filter(combined)
        .load(&mut conn)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    if files.len() != req.files.len() {
        return Err(actix_web::error::ErrorBadRequest("Some files not found"));
    }

    let latest_package = packages_table
        .filter(package_org_id.eq(&organisation))
        .filter(package_app_id.eq(&application))
        .order(package_version.desc())
        .select(PackageV2Entry::as_select())
        .first::<PackageV2Entry>(&mut conn)
        .optional()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let new_version = if let Some(latest) = latest_package {
        latest.version + 1
    } else {
        1
    };

    let new_package = NewPackageV2Entry {
        index: req.index.clone(),
        org_id: organisation.clone(),
        app_id: application.clone(),
        tag: req.tag.clone(),
        version: new_version,
        files: files.iter().map(|f| Some(format!("{}@version:{}", f.file_path.to_string(), f.version.to_string()))).collect()
    };

    let package = diesel::insert_into(packages_table)
        .values(&new_package)
        .returning(PackageV2Entry::as_returning())
        .get_result::<PackageV2Entry>(&mut conn)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Created().json(db_response_to_package(package)))
}

#[get("")]
async fn get_package(
    query: Query<GetPackageQuery>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let package_id = query.into_inner().package_key;
    if package_id.is_empty() {
        return Err(actix_web::error::ErrorBadRequest("Package Key cannot be empty"));
    }
    let (opt_pkg_version, opt_pkg_tag) = parse_package_key(&package_id);

    let auth_response = auth_response.into_inner();
    let organisation = validate_user(auth_response.organisation, READ)
        .map_err(actix_web::error::ErrorUnauthorized)?;
    let application = validate_user(auth_response.application, READ)
        .map_err(actix_web::error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let package = 
        if let Some(pkg_tag) = opt_pkg_tag {
            packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_tag.eq(&pkg_tag))
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)
                .map_err(actix_web::error::ErrorInternalServerError)?
        } else if let Some(pkg_version) = opt_pkg_version {
            packages_table
                .filter(package_org_id.eq(&organisation))
                .filter(package_app_id.eq(&application))
                .filter(package_version.eq(&pkg_version))
                .select(PackageV2Entry::as_select())
                .first::<PackageV2Entry>(&mut conn)
                .map_err(actix_web::error::ErrorInternalServerError)?
        } else {
            return Err(actix_web::error::ErrorInternalServerError("Bad format for package id"));
        };
    Ok(HttpResponse::Ok().json(db_response_to_package(package)))
}

#[get("/list")]
async fn list_packages(
    input: Query<ListPackagesInput>,
    auth_response: web::ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let ListPackagesInput { offset, limit } = input.into_inner();
    let auth = auth_response.into_inner();
    let organisation = validate_user(auth.organisation, READ)
        .map_err(actix_web::error::ErrorUnauthorized)?;
    let application = validate_user(auth.application, READ)
        .map_err(actix_web::error::ErrorUnauthorized)?;
    let mut conn = state.db_pool
        .get()
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // sanitize / defaults
    let offset_val = offset.unwrap_or(0).max(0) as i64;
    let limit_val  = limit.unwrap_or(10).clamp(1, 100) as i64; // default 10, max 100

    // 1) total count
    let total_count: i64 = packages_table
        .filter(package_org_id.eq(&organisation))
        .filter(package_app_id.eq(&application))
        .select(count_star())
        .first(&mut conn)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // 2) fetch one page
    let rows: Vec<PackageV2Entry> = packages_table
        .filter(package_org_id.eq(&organisation))
        .filter(package_app_id.eq(&application))
        .order(package_version.desc())
        .offset(offset_val)
        .limit(limit_val)
        .select(PackageV2Entry::as_select())
        .load(&mut conn)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // 3) map to your public DTO
    let packages: Vec<Package> =
        rows.into_iter().map(db_response_to_package).collect();

    // 4) build pagination
    let total_pages = ((total_count + limit_val - 1) / limit_val) as i32;
    let page_number = (offset_val / limit_val + 1) as i32;
    let next_offset = (offset_val + limit_val < total_count)
        .then(|| (offset_val + limit_val) as i32);
    let prev_offset = (offset_val >= limit_val)
        .then(|| (offset_val - limit_val) as i32);

    let out = ListPackagesOutput {
        packages,
        page_number,
        next_offset,
        prev_offset,
        total_pages,
    };

    Ok(HttpResponse::Ok().json(out))
}