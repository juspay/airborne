use crate::{package::types::Package, utils::db::models::PackageV2Entry};

pub fn parse_package_key(spec: &str) -> (Option<i32>, Option<String>) {
    if let Some((kind, value)) = spec.split_once(':') {
        match kind {
            "version" => (value.parse().ok(), None),
            "tag"     => (None, Some(value.to_string())),
            _         => (None, None),
        }
    } else {
        (None, None)
    }
}

pub fn db_response_to_package(
    db_pkg: PackageV2Entry
) -> Package {
    return Package {
        index: db_pkg.index,
        tag: db_pkg.tag,
        version: db_pkg.version,
        files: db_pkg.files.into_iter().flatten().collect(),
    };
}