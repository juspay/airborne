$version: "2.0"

namespace io.airborne.server

// Add this trait to any of the operation to make it a Login API
@trait(selector: "*")
structure authapi {}

// Add this trait to any of the operation to make it an authenticated route, an Authorization Header will be passed along with token
@trait(selector: "*")
structure requiresauth {}

/// Add this trait to any of the input structures to make it a multipart form data request
@trait(selector: "structure")
structure httpMultipart {}

/// List of strings
list StringList {
    member: String
}

/// Common File representation with version metadata
structure File {
    @required
    file_path: String

    @required
    url: String

    @required
    checksum: String

    @required
    size: String

    @required
    version: Integer

    @required
    id: String
}
