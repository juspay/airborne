pub mod utils;
use std::collections::HashMap;

use crate::{
    file::utils::parse_file_key,
    package::{types::*, utils::parse_package_key},
    release::utils::get_files_by_file_keys_async,
    run_blocking,
    types::{ABError, PaginatedQuery, PaginatedResponse, WithHeaders},
    utils::db::{
        models::{FileEntry, FileSetEntry, NewPackageV2Entry, PackageV2Entry},
        schema::hyperotaserver::{
            file_sets,
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

/// Decide a package's `files` and per-set snapshots from the individually
/// chosen files and the file sets. A set's members come straight from its
/// stored `path@version:N` keys, so no files lookup is needed. Rules:
/// - the index file's path can't also come in as a file (it is served as
///   the index already);
/// - a package holds one version per path, since a device keeps one file per
///   path;
/// - the identical `path@version` from several sources is included once, and
///   each set's snapshot still lists everything that set contributed.
fn plan_package_files(
    index_key: &str,
    individual: &[FileEntry],
    sets: &[FileSetEntry],
) -> airborne_types::Result<(Vec<String>, Vec<PackageFileSet>)> {
    let (index_path, _, _) = parse_file_key(index_key);
    // path -> (version, where it came from)
    let mut admitted: HashMap<String, (i32, String)> = HashMap::new();
    let mut files: Vec<String> = Vec::new();

    let mut admit = |path: &str, version: i32, source: String| -> airborne_types::Result<String> {
        let key = format!("{}@version:{}", path, version);
        if path == index_path {
            return Err(ABError::BadRequest(format!(
                "File '{}' is the package index and can't also be included by {}",
                path, source
            )));
        }
        match admitted.get(path) {
            Some((first_version, _)) if *first_version == version => {}
            Some((first_version, first_source)) => {
                return Err(ABError::BadRequest(format!(
                    "File '{}' is included at version {} by {} and at version {} by {}; \
                     a package can contain only one version of a file",
                    path, first_version, first_source, version, source
                )));
            }
            None => {
                admitted.insert(path.to_string(), (version, source));
                files.push(key.clone());
            }
        }
        Ok(key)
    };

    for file in individual {
        admit(
            &file.file_path,
            file.version,
            "individually selected files".to_string(),
        )?;
    }

    let mut snapshots = Vec::with_capacity(sets.len());
    for set in sets {
        let mut keys = Vec::with_capacity(set.file_keys.len());
        for stored in &set.file_keys {
            // Sets store keys resolved to a version; anything else is bad data.
            let (path, version) = match parse_file_key(stored) {
                (path, Some(version), None) => (path, version),
                _ => {
                    return Err(ABError::InternalServerError(format!(
                        "File set '{}' version {} has an invalid file key '{}'",
                        set.name, set.version, stored
                    )))
                }
            };
            keys.push(admit(&path, version, format!("file set '{}'", set.name))?);
        }
        snapshots.push(PackageFileSet {
            name: set.name.clone(),
            version: set.version,
            files: keys,
        });
    }

    Ok((files, snapshots))
}

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
    let set_refs = request.file_sets.clone().unwrap_or_default();

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
    let package = run_blocking!({
        let mut conn = pool.get()?;

        // Load each referenced file set version. Its stored keys are its
        // members, so no files lookup is needed; plan_package_files applies
        // the package rules.
        let mut sets: Vec<FileSetEntry> = Vec::new();
        for set_ref in &set_refs {
            let set: FileSetEntry = file_sets::table
                .filter(file_sets::org_id.eq(&db_organisation))
                .filter(file_sets::app_id.eq(&db_application))
                .filter(file_sets::name.eq(&set_ref.name))
                .filter(file_sets::version.eq(set_ref.version))
                .select(FileSetEntry::as_select())
                .first(&mut conn)
                .optional()?
                .ok_or_else(|| {
                    ABError::BadRequest(format!(
                        "Version {} of file set '{}' not found",
                        set_ref.version, set_ref.name
                    ))
                })?;
            sets.push(set);
        }

        let (package_files, set_snapshots) = plan_package_files(&db_pkg_index, &files, &sets)?;

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

        let all_files: Vec<Option<String>> = package_files.into_iter().map(Some).collect();

        let new_package = NewPackageV2Entry {
            index: db_pkg_index.clone(),
            org_id: db_organisation.clone(),
            app_id: db_application.clone(),
            tag: opt_pkg_tag.clone(),
            version: new_version,
            files: all_files,
            file_sets: serde_json::to_value(&set_snapshots)
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use uuid::Uuid;

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
            created_at: Utc.timestamp_opt(0, 0).unwrap(),
        }
    }

    /// A set version whose stored keys are the given files' keys.
    fn set(name: &str, version: i32, members: Vec<FileEntry>) -> FileSetEntry {
        set_with_keys(
            name,
            version,
            &members
                .iter()
                .map(|f| format!("{}@version:{}", f.file_path, f.version))
                .collect::<Vec<_>>(),
        )
    }

    fn set_with_keys<S: AsRef<str>>(name: &str, version: i32, keys: &[S]) -> FileSetEntry {
        FileSetEntry {
            id: Uuid::new_v4(),
            name: name.to_string(),
            version,
            metadata: serde_json::json!({}),
            file_keys: keys.iter().map(|k| k.as_ref().to_string()).collect(),
            created_at: Utc.timestamp_opt(0, 0).unwrap(),
        }
    }

    const INDEX: &str = "index.jsa@version:1";

    fn bad_request(result: airborne_types::Result<(Vec<String>, Vec<PackageFileSet>)>) -> String {
        match result {
            Err(ABError::BadRequest(msg)) => msg,
            Err(other) => panic!("expected BadRequest, got {:?}", other),
            Ok((files, _)) => panic!("expected rejection, got files {:?}", files),
        }
    }

    // --- no limit on the number of sets ---

    #[test]
    fn many_file_sets_can_build_one_package() {
        // There's no cap on sets per package: each set is read from its
        // stored keys, with no files lookup.
        let sets: Vec<FileSetEntry> = (0..150)
            .map(|i| {
                set_with_keys(
                    &format!("set-{}", i),
                    1,
                    &[format!("file-{}.js@version:1", i)],
                )
            })
            .collect();
        let (files, snapshots) = plan_package_files(INDEX, &[], &sets).unwrap();
        assert_eq!(files.len(), 150);
        assert_eq!(snapshots.len(), 150);
    }

    // --- plan_package_files: basic shape ---

    #[test]
    fn individual_files_only_keep_their_order() {
        let (files, snapshots) =
            plan_package_files(INDEX, &[file(1, "b.js", 1), file(2, "a.js", 3)], &[]).unwrap();
        assert_eq!(files, vec!["b.js@version:1", "a.js@version:3"]);
        assert!(snapshots.is_empty());
    }

    #[test]
    fn individual_files_come_before_set_files_in_request_order() {
        let sets = [
            set("first", 2, vec![file(2, "x.js", 1)]),
            set("second", 1, vec![file(3, "y.js", 1)]),
        ];
        let (files, snapshots) = plan_package_files(INDEX, &[file(1, "a.js", 1)], &sets).unwrap();
        assert_eq!(
            files,
            vec!["a.js@version:1", "x.js@version:1", "y.js@version:1"]
        );
        assert_eq!(snapshots.len(), 2);
        assert_eq!(
            (snapshots[0].name.as_str(), snapshots[0].version),
            ("first", 2)
        );
        assert_eq!(snapshots[0].files, vec!["x.js@version:1"]);
        assert_eq!(
            (snapshots[1].name.as_str(), snapshots[1].version),
            ("second", 1)
        );
        assert_eq!(snapshots[1].files, vec!["y.js@version:1"]);
    }

    #[test]
    fn empty_request_gives_empty_package_files() {
        let (files, snapshots) = plan_package_files(INDEX, &[], &[]).unwrap();
        assert!(files.is_empty());
        assert!(snapshots.is_empty());
    }

    // --- set members come from the set's stored keys (no files lookup) ---

    #[test]
    fn set_members_are_read_from_its_stored_keys() {
        let sets = [set_with_keys(
            "bundle",
            4,
            &["b.js@version:2", "a.js@version:7"],
        )];
        let (files, snapshots) = plan_package_files(INDEX, &[], &sets).unwrap();
        assert_eq!(files, vec!["b.js@version:2", "a.js@version:7"]);
        assert_eq!(snapshots[0].files, vec!["b.js@version:2", "a.js@version:7"]);
        assert_eq!(
            (snapshots[0].name.as_str(), snapshots[0].version),
            ("bundle", 4)
        );
    }

    #[test]
    fn stored_key_with_a_path_containing_at_signs_is_parsed() {
        let sets = [set_with_keys("s", 1, &["dir@x/app.js@version:3"])];
        let (files, _) = plan_package_files(INDEX, &[], &sets).unwrap();
        assert_eq!(files, vec!["dir@x/app.js@version:3"]);
    }

    fn internal_error(
        result: airborne_types::Result<(Vec<String>, Vec<PackageFileSet>)>,
    ) -> String {
        match result {
            Err(ABError::InternalServerError(msg)) => msg,
            Err(other) => panic!("expected InternalServerError, got {:?}", other),
            Ok((files, _)) => panic!("expected an error, got files {:?}", files),
        }
    }

    #[test]
    fn malformed_stored_key_is_an_internal_error() {
        let msg = internal_error(plan_package_files(
            INDEX,
            &[],
            &[set_with_keys("s", 1, &["oops"])],
        ));
        assert!(msg.contains("'s'") && msg.contains("oops"), "{}", msg);
    }

    #[test]
    fn unpinned_tag_key_in_a_set_is_an_internal_error() {
        // Sets must store resolved versions; a tag key means bad data.
        let msg = internal_error(plan_package_files(
            INDEX,
            &[],
            &[set_with_keys("s", 1, &["a.js@tag:latest"])],
        ));
        assert!(msg.contains("a.js@tag:latest"), "{}", msg);
    }

    // --- #6: the index path can't also come in as a file ---

    #[test]
    fn index_path_as_individual_file_is_rejected() {
        let msg = bad_request(plan_package_files(INDEX, &[file(1, "index.jsa", 1)], &[]));
        assert!(msg.contains("index.jsa"), "{}", msg);
        assert!(msg.contains("index"), "{}", msg);
    }

    #[test]
    fn index_path_from_a_set_is_rejected_naming_the_set() {
        let sets = [set(
            "bundle",
            3,
            vec![file(1, "ok.js", 1), file(2, "index.jsa", 1)],
        )];
        let msg = bad_request(plan_package_files(INDEX, &[], &sets));
        assert!(msg.contains("index.jsa"), "{}", msg);
        assert!(msg.contains("'bundle'"), "{}", msg);
    }

    #[test]
    fn index_path_at_another_version_is_still_rejected() {
        let sets = [set("bundle", 1, vec![file(1, "index.jsa", 2)])];
        let msg = bad_request(plan_package_files(INDEX, &[], &sets));
        assert!(msg.contains("index.jsa"), "{}", msg);
    }

    // --- #7: one version per path ---

    #[test]
    fn same_path_different_versions_across_sets_is_rejected() {
        let sets = [
            set("a", 1, vec![file(1, "app.js", 1)]),
            set("b", 1, vec![file(2, "app.js", 2)]),
        ];
        let msg = bad_request(plan_package_files(INDEX, &[], &sets));
        assert!(msg.contains("app.js"), "{}", msg);
        assert!(
            msg.contains("version 1") && msg.contains("version 2"),
            "{}",
            msg
        );
    }

    #[test]
    fn same_path_different_versions_set_vs_individual_is_rejected() {
        let sets = [set("a", 1, vec![file(2, "app.js", 2)])];
        let msg = bad_request(plan_package_files(INDEX, &[file(1, "app.js", 1)], &sets));
        assert!(msg.contains("app.js"), "{}", msg);
        assert!(
            msg.contains("version 1") && msg.contains("version 2"),
            "{}",
            msg
        );
    }

    #[test]
    fn same_path_different_versions_individually_is_rejected() {
        let msg = bad_request(plan_package_files(
            INDEX,
            &[file(1, "app.js", 1), file(2, "app.js", 2)],
            &[],
        ));
        assert!(msg.contains("app.js"), "{}", msg);
    }

    // --- #8: identical file from two sources is kept once ---

    #[test]
    fn identical_file_in_two_sets_is_listed_once() {
        let shared = file(1, "shared.js", 4);
        let sets = [
            set("a", 1, vec![shared.clone(), file(2, "a.js", 1)]),
            set("b", 1, vec![shared.clone()]),
        ];
        let (files, snapshots) = plan_package_files(INDEX, &[], &sets).unwrap();
        assert_eq!(files, vec!["shared.js@version:4", "a.js@version:1"]);
        // Both snapshots still record what each set contributed.
        assert_eq!(
            snapshots[0].files,
            vec!["shared.js@version:4", "a.js@version:1"]
        );
        assert_eq!(snapshots[1].files, vec!["shared.js@version:4"]);
    }

    #[test]
    fn identical_file_in_set_and_individual_is_listed_once() {
        let shared = file(1, "shared.js", 4);
        let sets = [set("a", 1, vec![shared.clone()])];
        let (files, snapshots) = plan_package_files(INDEX, &[shared], &sets).unwrap();
        assert_eq!(files, vec!["shared.js@version:4"]);
        assert_eq!(snapshots[0].files, vec!["shared.js@version:4"]);
    }
}
