import { AirborneServiceException as __BaseException } from "./AirborneServiceException";
import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import { StreamingBlobTypes, DocumentType as __DocumentType } from "@smithy/types";
/**
 * Bad request error
 * @public
 */
export declare class BadRequestError extends __BaseException {
    readonly name: "BadRequestError";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<BadRequestError, __BaseException>);
}
/**
 * Application information
 * @public
 */
export interface Application {
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Access levels of the user for the organisation
     * @public
     */
    access: (string)[] | undefined;
}
/**
 * Create application request
 * @public
 */
export interface CreateApplicationRequest {
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
}
/**
 * @public
 */
export declare class ForbiddenError extends __BaseException {
    readonly name: "ForbiddenError";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ForbiddenError, __BaseException>);
}
/**
 * Internal server error
 * @public
 */
export declare class InternalServerError extends __BaseException {
    readonly name: "InternalServerError";
    readonly $fault: "server";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InternalServerError, __BaseException>);
}
/**
 * Not found error
 * @public
 */
export declare class NotFoundError extends __BaseException {
    readonly name: "NotFoundError";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<NotFoundError, __BaseException>);
}
/**
 * Unauthorized error
 * @public
 */
export declare class Unauthorized extends __BaseException {
    readonly name: "Unauthorized";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<Unauthorized, __BaseException>);
}
/**
 * @public
 * @enum
 */
export declare const DimensionType: {
    readonly COHORT: "cohort";
    readonly STANDARD: "standard";
};
/**
 * @public
 */
export type DimensionType = typeof DimensionType[keyof typeof DimensionType];
/**
 * Create dimension request type
 * @public
 */
export interface CreateDimensionRequest {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Description of the dimension
     * @public
     */
    description: string | undefined;
    /**
     * Type of the dimension
     * @public
     */
    dimension_type: DimensionType | undefined;
    /**
     * Identifier of the dimension this depends on (required for cohort dimensions, ignored for standard dimensions)
     * @public
     */
    depends_on?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * @public
 */
export interface CreateDimensionResponse {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Description of the dimension
     * @public
     */
    description: __DocumentType | undefined;
    /**
     * Position of the dimension
     * @public
     */
    position: number | undefined;
    /**
     * Schema of the dimension
     * @public
     */
    schema?: __DocumentType | undefined;
    /**
     * Reason for the change
     * @public
     */
    change_reason: string | undefined;
}
/**
 * Create file request
 * @public
 */
export interface CreateFileRequest {
    /**
     * Path where the file will be stored on sdk
     * @public
     */
    file_path: string | undefined;
    /**
     * URL from where the file can be downloaded
     * @public
     */
    url: string | undefined;
    /**
     * Tag to identify the file
     * @public
     */
    tag?: string | undefined;
    /**
     * Metadata associated with the file in Stringified JSON format or a file attachment
     * @public
     */
    metadata?: __DocumentType | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Create file response
 * @public
 */
export interface CreateFileResponse {
    /**
     * id of the file
     * @public
     */
    id: string | undefined;
    /**
     * Path where the file is stored on sdk
     * @public
     */
    file_path: string | undefined;
    /**
     * URL from where the file can be downloaded
     * @public
     */
    url: string | undefined;
    /**
     * Version of the file
     * @public
     */
    version: number | undefined;
    /**
     * Tag associated with the file
     * @public
     */
    tag?: string | undefined;
    /**
     * Size of the file in bytes
     * @public
     */
    size: number | undefined;
    /**
     * Checksum of the file
     * @public
     */
    checksum: string | undefined;
    /**
     * Metadata associated with the file
     * @public
     */
    metadata: __DocumentType | undefined;
    /**
     * Status of the file
     * @public
     */
    status: string | undefined;
    /**
     * Date of creation of the file
     * @public
     */
    created_at: string | undefined;
}
/**
 * Organisation creation request
 * @public
 */
export interface CreateOrganisationRequest {
    name: string | undefined;
}
/**
 * Organisation information
 * @public
 */
export interface Organisation {
    /**
     * Name of the organisation
     * @public
     */
    name: string | undefined;
    /**
     * List of applications under the organisation
     * @public
     */
    applications: (Application)[] | undefined;
    /**
     * Access levels of the user for the organisation
     * @public
     */
    access: (string)[] | undefined;
}
/**
 * Create package request
 * @public
 */
export interface CreatePackageRequest {
    /**
     * Index file id
     * @public
     */
    index: string | undefined;
    tag?: string | undefined;
    /**
     * Space Separated file ids to be included in the package
     * @public
     */
    files: (string)[] | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Package information
 * @public
 */
export interface Package {
    tag?: string | undefined;
    version: number | undefined;
    index: string | undefined;
    /**
     * List of strings
     * @public
     */
    files: (string)[] | undefined;
}
/**
 * Create release request config
 * @public
 */
export interface CreateReleaseRequestConfig {
    /**
     * Timeout for the release config in seconds
     * @public
     */
    release_config_timeout: number | undefined;
    /**
     * Timeout for the package in seconds
     * @public
     */
    boot_timeout: number | undefined;
    /**
     * Properties of the config in Stringified JSON format
     * @public
     */
    properties: __DocumentType | undefined;
}
/**
 * Create release request package
 * @public
 */
export interface CreateReleaseRequestPackage {
    /**
     * Properties of the package in Stringified JSON format or a file attachment
     * @public
     */
    properties?: __DocumentType | undefined;
    /**
     * Important files in the package
     * @public
     */
    important?: (string)[] | undefined;
    /**
     * Lazy files in the package
     * @public
     */
    lazy?: (string)[] | undefined;
}
/**
 * @public
 */
export interface CreateReleaseRequest {
    /**
     * config for the release
     * @public
     */
    config: CreateReleaseRequestConfig | undefined;
    /**
     * Package ID for the release
     * @public
     */
    package_id?: string | undefined;
    /**
     * Package details for the release
     * @public
     */
    package?: CreateReleaseRequestPackage | undefined;
    /**
     * Dimensions for the release in key-value format
     * @public
     */
    dimensions?: Record<string, __DocumentType> | undefined;
    /**
     * Resources for the release
     * @public
     */
    resources?: (string)[] | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Configuration properties
 * @public
 */
export interface ConfigProperties {
    tenant_info: __DocumentType | undefined;
}
/**
 * @public
 */
export interface GetReleaseConfig {
    version: string | undefined;
    release_config_timeout: number | undefined;
    boot_timeout: number | undefined;
    /**
     * Configuration properties
     * @public
     */
    properties: ConfigProperties | undefined;
}
/**
 * @public
 */
export interface ReleaseExperiment {
    experiment_id?: string | undefined;
    package_version?: number | undefined;
    config_version?: string | undefined;
    created_at?: string | undefined;
    traffic_percentage?: number | undefined;
    status?: string | undefined;
}
/**
 * @public
 */
export interface ServeFile {
    file_path?: string | undefined;
    url?: string | undefined;
    checksum?: string | undefined;
}
/**
 * @public
 */
export interface ServePackage {
    name?: string | undefined;
    version?: string | undefined;
    index?: ServeFile | undefined;
    properties?: __DocumentType | undefined;
    important?: (ServeFile)[] | undefined;
    lazy?: (ServeFile)[] | undefined;
}
/**
 * @public
 */
export interface CreateReleaseResponse {
    /**
     * ID of the release
     * @public
     */
    id: string | undefined;
    /**
     * Creation time of the release
     * @public
     */
    created_at: string | undefined;
    /**
     * Status of the release
     * @public
     */
    config: GetReleaseConfig | undefined;
    /**
     * Package details of the release
     * @public
     */
    package: ServePackage | undefined;
    /**
     * Experiment details of the release
     * @public
     */
    experiment?: ReleaseExperiment | undefined;
    /**
     * Dimensions associated with the release
     * @public
     */
    dimensions: Record<string, __DocumentType> | undefined;
}
/**
 * @public
 */
export interface DeleteDimensionRequest {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * @public
 */
export interface GetReleaseRequest {
    /**
     * ID of the release
     * @public
     */
    releaseId: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * @public
 */
export interface GetReleaseResponse {
    id?: string | undefined;
    created_at?: string | undefined;
    config?: GetReleaseConfig | undefined;
    package?: ServePackage | undefined;
    resources?: (ServeFile)[] | undefined;
    experiment?: ReleaseExperiment | undefined;
    dimensions?: Record<string, __DocumentType> | undefined;
}
/**
 * User token response
 * @public
 */
export interface UserToken {
    access_token: string | undefined;
    token_type: string | undefined;
    expires_in: number | undefined;
    refresh_token: string | undefined;
    refresh_expires_in: number | undefined;
}
/**
 * User information
 * @public
 */
export interface User {
    user_id: string | undefined;
    /**
     * List of organisations
     * @public
     */
    organisations: (Organisation)[] | undefined;
    /**
     * User token response
     * @public
     */
    user_token?: UserToken | undefined;
}
/**
 * @public
 */
export interface ListDimensionsRequest {
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    page?: number | undefined;
    count?: number | undefined;
}
/**
 * @public
 */
export interface DimensionResponse {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Description of the dimension
     * @public
     */
    description: __DocumentType | undefined;
    /**
     * Position of the dimension
     * @public
     */
    position: number | undefined;
    /**
     * Schema of the dimension
     * @public
     */
    schema?: __DocumentType | undefined;
    /**
     * Reason for the change
     * @public
     */
    change_reason: string | undefined;
    mandatory?: boolean | undefined;
}
/**
 * @public
 */
export interface ListDimensionsResponse {
    total_pages?: number | undefined;
    total_items?: number | undefined;
    data?: (DimensionResponse)[] | undefined;
}
/**
 * List files request
 * @public
 */
export interface ListFilesRequest {
    /**
     * Page number for pagination
     * @public
     */
    page?: number | undefined;
    /**
     * Number of files per page
     * @public
     */
    per_page?: number | undefined;
    /**
     * Search query to filter files
     * @public
     */
    search?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * List files response
 * @public
 */
export interface ListFilesResponse {
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
    /**
     * List of files
     * @public
     */
    files: (CreateFileResponse)[] | undefined;
    /**
     * Total number of files
     * @public
     */
    total: number | undefined;
    /**
     * Current page number
     * @public
     */
    page: number | undefined;
    /**
     * Number of files per page
     * @public
     */
    per_page: number | undefined;
}
/**
 * List organisations response
 * @public
 */
export interface ListOrganisationsResponse {
    /**
     * List of organisations
     * @public
     */
    organisations: (Organisation)[] | undefined;
}
/**
 * List packages request
 * @public
 */
export interface ListPackagesRequest {
    /**
     * Offset for pagination (default: 1)
     * @public
     */
    page?: number | undefined;
    /**
     * Limit for pagination (default: 50)
     * @public
     */
    count?: number | undefined;
    /**
     * Search term for filtering packages using index file path
     * @public
     */
    search?: string | undefined;
    /**
     * If true, fetch all packages without pagination
     * @public
     */
    all?: boolean | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * List packages response
 * @public
 */
export interface ListPackagesResponse {
    /**
     * List of packages
     * @public
     */
    data: (Package)[] | undefined;
    /**
     * Total number of pages
     * @public
     */
    total_pages: number | undefined;
    /**
     * Total number of items
     * @public
     */
    total_items: number | undefined;
}
/**
 * @public
 */
export interface ListReleasesRequest {
    /**
     * dimension to filter releases in format key1=value1;key2=value2
     * @public
     */
    dimension?: string | undefined;
    /**
     * Page number for pagination (default: 1)
     * @public
     */
    page?: number | undefined;
    /**
     * Count of releases per page for pagination (default: 50)
     * @public
     */
    count?: number | undefined;
    /**
     * If true, fetch all releases without pagination
     * @public
     */
    all?: boolean | undefined;
    /**
     * Status to filter releases
     * @public
     */
    status?: string | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * @public
 */
export interface ListReleasesResponse {
    /**
     * List of releases
     * @public
     */
    data: (GetReleaseResponse)[] | undefined;
    /**
     * Total number of pages
     * @public
     */
    total_pages: number | undefined;
    /**
     * Total number of items
     * @public
     */
    total_items: number | undefined;
}
/**
 * User credentials for login
 * @public
 */
export interface UserCredentials {
    /**
     * Gmail of the user
     * @public
     */
    client_id: string | undefined;
    /**
     * Password of the user
     * @public
     */
    client_secret: string | undefined;
}
/**
 * Request organisation request
 * @public
 */
export interface RequestOrganisationRequest {
    /**
     * Name of the organisation
     * @public
     */
    organisation_name: string | undefined;
    /**
     * Name of the requester
     * @public
     */
    name: string | undefined;
    /**
     * Email of the requester
     * @public
     */
    email: string | undefined;
    /**
     * Phone number of the requester
     * @public
     */
    phone: string | undefined;
    /**
     * App store link
     * @public
     */
    app_store_link: string | undefined;
    /**
     * Play store link
     * @public
     */
    play_store_link: string | undefined;
}
/**
 * Request organisation response
 * @public
 */
export interface RequestOrganisationResponse {
    /**
     * Name of the organisation
     * @public
     */
    organisation_name: string | undefined;
    /**
     * Message indicating the status of the request
     * @public
     */
    message: string | undefined;
}
/**
 * Input for get release operations
 * @public
 */
export interface GetServeReleaseInput {
    organisation: string | undefined;
    application: string | undefined;
}
/**
 * Release configuration
 * @public
 */
export interface ReleaseConfig {
    config: GetReleaseConfig | undefined;
    /**
     * Package information
     * @public
     */
    package: Package | undefined;
    resources: __DocumentType | undefined;
}
/**
 * @public
 */
export interface UpdateDimensionRequest {
    /**
     * Name of the dimension
     * @public
     */
    dimension: string | undefined;
    /**
     * Reason for the change
     * @public
     */
    change_reason: string | undefined;
    /**
     * New position of the dimension
     * @public
     */
    position: number | undefined;
    /**
     * Name of the organisation
     * @public
     */
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * Upload file request
 * @public
 */
export interface UploadFileRequest {
    /**
     * File path of file to be uploaded
     * @public
     */
    file: StreamingBlobTypes | undefined;
    /**
     * Path where the file will be stored on sdk
     * @public
     */
    file_path: string | undefined;
    /**
     * tag to identify the file
     * @public
     */
    tag?: string | undefined;
    /**
     * SHA-256 digest of the file, encoded in Base64, used by the server to verify the integrity of the uploaded file
     * @public
     */
    checksum: string | undefined;
    organisation: string | undefined;
    /**
     * Name of the application
     * @public
     */
    application: string | undefined;
}
/**
 * @internal
 */
export declare const UploadFileRequestFilterSensitiveLog: (obj: UploadFileRequest) => any;
