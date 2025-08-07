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