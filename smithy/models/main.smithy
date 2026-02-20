namespace io.airborne.server

use aws.protocols#restJson1

/// Service for managing OTA updates and configurations
@restJson1
@httpBearerAuth
service Airborne {
    operations: [
        // user
        PostLogin
        GetUser
        // organisation
        CreateOrganisation
        ListOrganisations
        RequestOrganisation
        // application
        CreateApplication
        // file
        CreateFile
        ListFiles
        UploadFile
        ListVersions
        // package
        CreatePackage
        ListPackages
        // release
        CreateRelease
        ListReleases
        GetRelease
        ServeRelease
        ServeReleaseV2
        // dimension
        CreateDimension
        ListDimensions
        UpdateDimension
        DeleteDimension
    ]
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
        InternalServerError
        ForbiddenError
    ]
}
