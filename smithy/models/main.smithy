namespace io.airborne.server

use aws.protocols#restJson1

/// Service for managing OTA updates and configurations
@restJson1
@httpBearerAuth
service Airborne {
    operations: [
        IngestTelemetryReports
        GetTelemetrySummary
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
        RampRelease
        ConcludeRelease
        DiscardRelease
        ServeRelease
        ServeReleaseV2
        // dimension
        GetServingPolicy
        PutServingPolicy
        PreviewServingPolicy
        CreateCohortRange
        CreateDimension
        ListDimensions
        UpdateDimension
        DeleteDimension
        // Control Center overview, app groups, release history, and rollback
        GetControlCenterOverview
        GetControlCenterDeployments
        ListControlCenterGroups
        ListControlCenterOperations
        ResolveControlCenterOperation
        CreateControlCenterGroup
        UpdateControlCenterGroup
        DeleteControlCenterGroup
        GetControlCenterReleaseEvents
        GetControlCenterRollbackPreview
        RollbackRelease
        GetControlCenterApprovalPolicy
        UpdateControlCenterApprovalPolicy
        ListControlCenterDeploymentRequests
        CreateControlCenterDeploymentRequest
        GetControlCenterDeploymentRequest
        ApproveControlCenterDeploymentRequest
        RejectControlCenterDeploymentRequest
        CancelControlCenterDeploymentRequest
        AcknowledgeEmergencyRollback
    ]
}
