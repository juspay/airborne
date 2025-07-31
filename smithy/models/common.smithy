$version: "2"

namespace in.juspay.airborne

/// A list of raw file identifiers (e.g. "$file_path@version:$version" or "$file_path@tag:$tag").
list FileIds {
    member: String
}

/// Common File representation with version metadata
structure File {
    @required
    file_path: String,
    @required
    url: String,
    @required
    checksum: String,
    @required
    size: String,
    @required
    version: Integer,
    @required
    id: String
}