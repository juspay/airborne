use crate::{
    package::types::{Package, PackageV2},
    utils::db::models::PackageV2Entry,
};

pub fn parse_package_key(spec: &str) -> (Option<i32>, Option<String>) {
    if let Some((kind, value)) = spec.split_once(':') {
        match kind {
            "version" => (value.parse().ok(), None),
            "tag" => (None, Some(value.to_string())),
            _ => (None, None),
        }
    } else {
        (None, None)
    }
}

pub fn db_response_to_package(db_pkg: PackageV2Entry) -> Package {
    Package {
        index: db_pkg.index.unwrap_or_default(),
        tag: db_pkg.tag,
        version: db_pkg.version,
        files: db_pkg.files.into_iter().flatten().collect(),
    }
}

pub fn db_response_to_package_v2(db_pkg: PackageV2Entry) -> PackageV2 {
    PackageV2 {
        index: db_pkg.index,
        tag: db_pkg.tag,
        version: db_pkg.version,
        files: db_pkg.files.into_iter().flatten().collect(),
        package_group_id: db_pkg.package_group_id,
    }
}
