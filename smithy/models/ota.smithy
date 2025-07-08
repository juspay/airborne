$version: "2.0"

namespace juspay.ota

use smithy.api#jsonName
use aws.protocols#restJson1
use smithy.api#http
use smithy.api#mediaType
use smithy.api#streaming
use smithy.api#httpPayload
use smithy.api#httpLabel
use smithy.api#httpHeader
use smithy.api#httpQuery

@trait(selector: "*")
structure entrypoint {}

// Add this trait to any of the operation to make it a Login API
@trait(selector: "*")
structure authapi {}

// Add this trait to any of the operation to make it an authenticated route, an Authorization Header will be passed along with token
@trait(selector: "*")
structure requiresauth {}

/// Service for managing OTA updates and configurations
@entrypoint
@restJson1
@httpBearerAuth
service OTAService {
    version: "1.0.0",
    operations: [
        // Authentication operations
        PostLogin,
        GetUser,
        CreateUser,
        GetOAuthUrl,
        PostOAuthLogin,
        PostOAuthSignup,
        
        // Organization operations
        CreateOrganisation,
        RequestOrganisation,
        DeleteOrganisation,
        GetOrganisations,
        
        // Organization user management
        CreateOrganisationUser,
        UpdateOrganisationUser,
        RemoveOrganisationUser,
        ListOrganisationUsers,
        
        // Application operations
        CreateApplication,
        
        // Package operations
        ListPackages,
        CreatePackage,
        CreatePackageMultipart,
        
        // Configuration operations
        CreateConfig,
        CreateConfigMultipart,
        
        // Release operations
        CreateRelease,
        GetReleaseHistory,
        RampRelease,
        ConcludeRelease,
        GetExperiment,
        GetRelease,
        GetReleaseV2,
        
        // Dimension operations
        CreateDimension,
        ListDimensions,
        UpdateDimension,
        DeleteDimension
    ]
}

/// User credentials for login
structure UserCredentials {
    @required
    name: String,
    @required
    password: String
}

/// User token response
structure UserToken {
    @required
    access_token: String,
    @required
    token_type: String,
    @required
    expires_in: Long,
    @required
    refresh_token: String,
    @required
    refresh_expires_in: Long
}

/// User information
structure User {
    @required
    user_id: String,
    @required
    organisations: Organisations,
    user_token: UserToken
}

/// List of organisations
list Organisations {
    member: Organisation
}

/// Organisation information
structure Organisation {
    @required
    name: String,
    @required
    applications: Applications,
    @required
    access: AccessList
}

/// List of applications
list Applications {
    member: Application
}

/// Application information
structure Application {
    @required
    name: String,
    @required
    version: String
}

/// List of access levels
list AccessList {
    member: String
}

/// Organisation creation request
structure CreateOrganisationRequest {
    @required
    name: String
}

/// Release configuration
structure ReleaseConfig {
    @required
    config: Config,
    @required
    package: Package,
    @required
    resources: Document
}

/// Configuration details
structure Config {
    @required
    version: String,
    @required
    release_config_timeout: Integer,
    @required
    package_timeout: Integer,
    @required
    properties: ConfigProperties
}

/// Configuration properties
structure ConfigProperties {
    @required
    tenant_info: Document
}

/// Package information
structure Package {
    @required
    name: String,
    @required
    version: String,
    @required
    properties: PackageProperties,
    @required
    index: String,
    @required
    splits: Splits
}

/// Package properties
structure PackageProperties {
    @required
    manifest: Document,
    @required
    manifest_hash: Document
}

/// List of splits
list Splits {
    member: String
}

/// Alias for a streaming blob of raw bytes
@streaming
@mediaType("application/octet-stream")
blob FileStream

/// OAuth URL response
structure OAuthUrlResponse {
    @required
    auth_url: String,
    @required
    state: String
}

/// OAuth login/signup request
structure OAuthRequest {
    @required
    code: String,
    @required
    state: String
}

/// Organization request structure
structure OrganisationRequest {
    @required
    organisation_name: String,
    @required
    name: String,
    @required
    email: String,
    @required
    phone: String,
    @required
    play_store_link: String,
    @required
    app_store_link: String
}

/// Organization request response
structure OrganisationRequestResponse {
    @required
    organisation_name: String,
    @required
    message: String
}

/// Organization user request
structure OrganisationUserRequest {
    @required
    user: String,
    @required
    access: String
}

/// Organization user update request
structure OrganisationUserUpdateRequest {
    @required
    user: String,
    @required
    access: String
}

/// Organization user remove request
structure OrganisationUserRemoveRequest {
    @required
    user: String
}

/// Application creation request
structure ApplicationCreateRequest {
    @required
    application: String,
    organisation: String,

    @httpHeader("X-Organisation")
    organisationName: String
}

/// Package list item
structure PackageItem {
    @required
    version: String,
    @required
    created_at: String
}

/// Package list response
list PackageList {
    member: PackageItem
}

/// Package properties for creation
structure PackageCreationProperties {
    @required
    manifest: Document,
    @required
    manifest_hash: Document
}

/// Package creation request
structure PackageCreateRequest {
    @required
    package: PackageDetails,
    @required
    resources: ResourceList,
    @required
    contexts: ContextList
}

/// Package details
structure PackageDetails {
    @required
    version: String,
    @required
    important: ResourceList,
    @required
    lazy: ResourceList,
    @required
    properties: Document
}

/// Resource list
list ResourceList {
    member: String
}

/// Context list
list ContextList {
    member: Document
}

/// Package creation response
structure PackageCreateResponse {
    @required
    version: Integer
}

/// Configuration creation request
structure ConfigCreateRequest {
    @required
    config: ConfigDetails,
    @required
    tenant_info: Document,
    @required
    properties: Document
}

/// Configuration details
structure ConfigDetails {
    @required
    version: String,
    @required
    release_config_timeout: Integer,
    @required
    boot_timeout: Integer,
    @required
    properties: Document
}

/// Configuration creation response
structure ConfigCreateResponse {
    @required
    version: Integer,
    @required
    config_version: String
}

/// Release creation request
structure ReleaseCreateRequest {
    version_id: String,
    @required
    metadata: Document,
    @required
    context: ReleaseContext
}

/// Release context
structure ReleaseContext {
    @required
    and: ContextList
}

/// Release creation response
structure ReleaseCreateResponse {
    @required
    id: String,
    @required
    created_at: String,
    @required
    package_version: Integer,
    @required
    config_version: String
}

/// Release history response
structure ReleaseHistoryResponse {
    @required
    releases: ReleaseList
}

/// Release list
list ReleaseList {
    member: ReleaseItem
}

/// Release item
structure ReleaseItem {
    @required
    id: String,
    @required
    created_at: String,
    @required
    package_version: Integer,
    @required
    config_version: String,
    @required
    metadata: Document
}

/// Release ramp request
structure ReleaseRampRequest {
    @required
    traffic_percentage: Integer,
    @required
    change_reason: String
}

/// Release ramp response
structure ReleaseRampResponse {
    @required
    success: Boolean,
    @required
    message: String,
    @required
    experiment_id: String,
    @required
    traffic_percentage: Integer
}

/// Release conclude request
structure ReleaseConcludeRequest {
    @required
    chosen_variant: String,
    @required
    change_reason: String
}

/// Release conclude response
structure ReleaseConcludeResponse {
    @required
    success: Boolean,
    @required
    message: String,
    @required
    experiment_id: String,
    @required
    chosen_variant: String
}

/// Experiment details
structure ExperimentDetails {
    @required
    experiment_id: String,
    @required
    traffic_percentage: Integer,
    @required
    variants: VariantList
}

/// Variant list
list VariantList {
    member: String
}

/// Dimension creation request
structure DimensionCreateRequest {
    @required
    dimension: String,
    @required
    schema: Document,
    @required
    description: String
}

/// Dimension creation response
structure DimensionCreateResponse {
    @required
    dimension: String,
    @required
    position: Integer,
    @required
    schema: Document,
    @required
    description: String,
    @required
    change_reason: String
}

/// Dimension list response
structure DimensionListResponse {
    @required
    dimensions: DimensionList
}

/// Dimension list
list DimensionList {
    member: DimensionItem
}

/// Dimension item
structure DimensionItem {
    @required
    dimension: String,
    @required
    position: Integer,
    @required
    schema: Document,
    @required
    description: String
}

/// Dimension update request
structure DimensionUpdateRequest {
    @required
    position: Integer,
    @required
    change_reason: String
}

/// Success response
structure SuccessResponse {
    @required
    success: Boolean,
    @required
    message: String
}

/// User list response
structure UserListResponse {
    @required
    users: UserItemList
}

/// User item list
list UserItemList {
    member: UserItem
}

/// User item
structure UserItem {
    @required
    user: String,
    @required
    access: String
}

/// Login operation
@http(method: "POST", uri: "/users/login")
@authapi
operation PostLogin {
    input: UserCredentials,
    output: User,
    errors: [UnauthorizedError]
}

/// Get user operation
@http(method: "GET", uri: "/user")
@readonly
@requiresauth
operation GetUser {
    output: User,
    errors: [UnauthorizedError]
}

/// Create user operation
@http(method: "POST", uri: "/users/create")
operation CreateUser {
    input: UserCredentials,
    output: User,
    errors: [BadRequestError]
}

/// Create organisation operation
@http(method: "POST", uri: "/organisations/create")
@requiresauth
operation CreateOrganisation {
    input: CreateOrganisationRequest,
    output: Organisation,
    errors: [UnauthorizedError, BadRequestError]
}

/// Get release operation
@http(method: "GET", uri: "/release/{organisation}/{application}")
@readonly
@requiresauth
operation GetRelease {
    input: GetReleaseInput,
    output: ReleaseConfig,
    errors: [NotFoundError, InternalServerError]
}

/// Get release v2 operation
@http(method: "GET", uri: "/release/v2/{organisation}/{application}")
@readonly
@requiresauth
operation GetReleaseV2 {
    input: GetReleaseInput,
    output: ReleaseConfig,
    errors: [NotFoundError, InternalServerError]
}

/// Input for get release operations
structure GetReleaseInput {
    @required
    @httpLabel
    organisation: String,
    @required
    @httpLabel
    application: String
}

/// Unauthorized error
@error("client")
@httpError(401)
structure UnauthorizedError {
    @required
    message: String
}

/// Bad request error
@error("client")
@httpError(400)
structure BadRequestError {
    @required
    message: String
}

/// Not found error
@error("client")
@httpError(404)
structure NotFoundError {
    @required
    message: String
}

/// Internal server error
@error("server")
@httpError(500)
structure InternalServerError {
    @required
    message: String
}

// OAuth Operations

/// Get OAuth URL operation
@http(method: "GET", uri: "/users/oauth/url")
@readonly
operation GetOAuthUrl {
    output: OAuthUrlResponse,
    errors: [InternalServerError]
}

/// OAuth login operation
@http(method: "POST", uri: "/users/oauth/login")
@authapi
operation PostOAuthLogin {
    input: OAuthRequest,
    output: User,
    errors: [UnauthorizedError, BadRequestError]
}

/// OAuth signup operation
@http(method: "POST", uri: "/users/oauth/signup")
@authapi
operation PostOAuthSignup {
    input: OAuthRequest,
    output: User,
    errors: [UnauthorizedError, BadRequestError]
}

// Organization Operations

/// Request organisation operation
@http(method: "POST", uri: "/organisations/request")
@requiresauth
operation RequestOrganisation {
    input: OrganisationRequest,
    output: OrganisationRequestResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Delete organisation operation
@http(method: "DELETE", uri: "/organisations/{org_name}")
@idempotent
@requiresauth
operation DeleteOrganisation {
    input: DeleteOrganisationInput,
    output: SuccessResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Delete organisation input
structure DeleteOrganisationInput {
    @required
    @httpLabel
    org_name: String
}

/// Get organisations operation
@http(method: "GET", uri: "/organisations")
@readonly
@requiresauth
operation GetOrganisations {
    output: OrganisationListResponse,
    errors: [UnauthorizedError]
}

/// Organisation list response
structure OrganisationListResponse {
    @required
    organisations: Organisations
}

// Organization User Management Operations

/// Create organisation user operation
@http(method: "POST", uri: "/organisations/user/create")
@requiresauth
operation CreateOrganisationUser {
    input: OrganisationUserRequest,
    output: SuccessResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Update organisation user operation
@http(method: "POST", uri: "/organisations/user/update")
@requiresauth
operation UpdateOrganisationUser {
    input: OrganisationUserUpdateRequest,
    output: SuccessResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Remove organisation user operation
@http(method: "POST", uri: "/organisations/user/remove")
@requiresauth
operation RemoveOrganisationUser {
    input: OrganisationUserRemoveRequest,
    output: SuccessResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// List organisation users operation
@http(method: "GET", uri: "/organisations/user/list")
@readonly
@requiresauth
operation ListOrganisationUsers {
    output: UserListResponse,
    errors: [UnauthorizedError]
}

// Application Operations

/// Create application operation
@http(method: "POST", uri: "/organisations/applications/create")
@requiresauth
operation CreateApplication {
    input: ApplicationCreateRequest,
    output: Application,
    errors: [UnauthorizedError, BadRequestError]
}

// Package Operations

/// List packages operation
@http(method: "GET", uri: "/organisations/applications/package")
@readonly
@requiresauth
operation ListPackages {
    output: PackageListResponse,
    errors: [UnauthorizedError]
}

/// Package list response
structure PackageListResponse {
    @required
    packages: PackageList
}

/// Create package operation
@http(method: "POST", uri: "/organisations/applications/package/create_package_json_v1")
@requiresauth
operation CreatePackage {
    input: PackageCreateRequest,
    output: PackageCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Create package multipart operation
@http(method: "POST", uri: "/organisations/applications/package/create_json_v1_multipart")
@requiresauth
operation CreatePackageMultipart {
    input: PackageCreateMultipartRequest,
    output: PackageCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Package create multipart request
structure PackageCreateMultipartRequest {
    @required
    @httpPayload
    file: FileStream,
    @httpHeader("Content-Type")
    contentType: String
}

// Configuration Operations

/// Create config operation
@http(method: "POST", uri: "/organisations/applications/config/create_json_v1")
@requiresauth
operation CreateConfig {
    input: ConfigCreateRequest,
    output: ConfigCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Create config multipart operation
@http(method: "POST", uri: "/organisations/applications/config/create_json_v1/multipart")
@requiresauth
operation CreateConfigMultipart {
    input: ConfigCreateMultipartRequest,
    output: ConfigCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Config create multipart request
structure ConfigCreateMultipartRequest {
    @required
    @httpPayload
    file: FileStream,
    @httpHeader("Content-Type")
    contentType: String
}

// Release Operations

/// Create release operation
@http(method: "POST", uri: "/organisations/applications/release/create")
@requiresauth
operation CreateRelease {
    input: ReleaseCreateRequest,
    output: ReleaseCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Get release history operation
@http(method: "GET", uri: "/organisations/applications/release/history")
@readonly
@requiresauth
operation GetReleaseHistory {
    output: ReleaseHistoryResponse,
    errors: [UnauthorizedError]
}

/// Ramp release operation
@http(method: "PATCH", uri: "/organisations/applications/release/{release_id}/ramp")
@requiresauth
operation RampRelease {
    input: RampReleaseInput,
    output: ReleaseRampResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Ramp release input
structure RampReleaseInput {
    @required
    @httpLabel
    release_id: String,
    @required
    traffic_percentage: Integer,
    @required
    change_reason: String
}

/// Conclude release operation
@http(method: "PATCH", uri: "/organisations/applications/release/{release_id}/conclude")
@requiresauth
operation ConcludeRelease {
    input: ConcludeReleaseInput,
    output: ReleaseConcludeResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Conclude release input
structure ConcludeReleaseInput {
    @required
    @httpLabel
    release_id: String,
    @required
    chosen_variant: String,
    @required
    change_reason: String
}

/// Get experiment operation
@http(method: "GET", uri: "/organisations/applications/release/experiment/{experiment_id}")
@readonly
@requiresauth
operation GetExperiment {
    input: GetExperimentInput,
    output: ExperimentDetails,
    errors: [UnauthorizedError, NotFoundError]
}

/// Get experiment input
structure GetExperimentInput {
    @required
    @httpLabel
    experiment_id: String
}

// Dimension Operations

/// Create dimension operation
@http(method: "POST", uri: "/organisations/applications/dimension/create")
@requiresauth
operation CreateDimension {
    input: DimensionCreateRequest,
    output: DimensionCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// List dimensions operation
@http(method: "GET", uri: "/organisations/applications/dimension/list")
@readonly
@requiresauth
operation ListDimensions {
    input: ListDimensionsInput,
    output: DimensionListResponse,
    errors: [UnauthorizedError]
}

/// List dimensions input
structure ListDimensionsInput {
    @httpQuery("page")
    page: Integer,
    @httpQuery("count")
    count: Integer
}

/// Update dimension operation
@http(method: "PUT", uri: "/organisations/applications/dimension/{dimension_name}")
@idempotent
@requiresauth
operation UpdateDimension {
    input: UpdateDimensionInput,
    output: DimensionCreateResponse,
    errors: [UnauthorizedError, BadRequestError]
}

/// Update dimension input
structure UpdateDimensionInput {
    @required
    @httpLabel
    dimension_name: String,
    @required
    position: Integer,
    @required
    change_reason: String
}

/// Delete dimension operation
@http(method: "DELETE", uri: "/organisations/applications/dimension/{dimension_name}")
@idempotent
@requiresauth
operation DeleteDimension {
    input: DeleteDimensionInput,
    errors: [UnauthorizedError, BadRequestError]
}

/// Delete dimension input
structure DeleteDimensionInput {
    @required
    @httpLabel
    dimension_name: String
} 