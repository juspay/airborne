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
        // package
        CreatePackage
        ListPackages
        // package groups
        CreatePackageGroup
        ListPackageGroups
        GetPackageGroup
        UpdatePackageGroupName
        // package v2 (group-scoped)
        ListPackagesV2
        CreatePackageV2
        GetPackageV2ByVersion
        GetPackageV2ByTag
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
