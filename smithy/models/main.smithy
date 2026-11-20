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
        ListFileGroups
        UpdateFile
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
        // Control Center overview, app groups, release history, and rollback
        GetControlCenterOverview
        ListControlCenterGroups
        ListControlCenterOperations
        ResolveControlCenterOperation
        CreateControlCenterGroup
        UpdateControlCenterGroup
        DeleteControlCenterGroup
        GetControlCenterReleaseEvents
        GetControlCenterRollbackPreview
        RollbackRelease
    ]
    errors: [
        Unauthorized
        BadRequestError
        NotFoundError
        InternalServerError
        ForbiddenError
    ]
}
