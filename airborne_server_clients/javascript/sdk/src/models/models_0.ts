// smithy-typescript generated code
import { AirborneServiceException as __BaseException } from "./AirborneServiceException";
import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import {
  StreamingBlobTypes,
  DocumentType as __DocumentType,
} from "@smithy/types";

/**
 * Bad request error
 * @public
 */
export class BadRequestError extends __BaseException {
  readonly name: "BadRequestError" = "BadRequestError";
  readonly $fault: "client" = "client";
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<BadRequestError, __BaseException>) {
    super({
      name: "BadRequestError",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
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
export class ForbiddenError extends __BaseException {
  readonly name: "ForbiddenError" = "ForbiddenError";
  readonly $fault: "client" = "client";
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<ForbiddenError, __BaseException>) {
    super({
      name: "ForbiddenError",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Internal server error
 * @public
 */
export class InternalServerError extends __BaseException {
  readonly name: "InternalServerError" = "InternalServerError";
  readonly $fault: "server" = "server";
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<InternalServerError, __BaseException>) {
    super({
      name: "InternalServerError",
      $fault: "server",
      ...opts
    });
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * Not found error
 * @public
 */
export class NotFoundError extends __BaseException {
  readonly name: "NotFoundError" = "NotFoundError";
  readonly $fault: "client" = "client";
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<NotFoundError, __BaseException>) {
    super({
      name: "NotFoundError",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Unauthorized error
 * @public
 */
export class Unauthorized extends __BaseException {
  readonly name: "Unauthorized" = "Unauthorized";
  readonly $fault: "client" = "client";
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<Unauthorized, __BaseException>) {
    super({
      name: "Unauthorized",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, Unauthorized.prototype);
  }
}

/**
 * @public
 * @enum
 */
export const DimensionType = {
  COHORT: "cohort",
  STANDARD: "standard",
} as const
/**
 * @public
 */
export type DimensionType = typeof DimensionType[keyof typeof DimensionType]

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
 * Create package request (legacy - uses primary group)
 * @public
 */
export interface CreatePackageRequest {
  /**
   * Index file id
   * @public
   */
  index: string | undefined;

  /**
   * Optional tag for the package (e.g., latest, v1.0, production)
   * @public
   */
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
 * Package information (legacy)
 * @public
 */
export interface Package {
  /**
   * Tag of the package
   * @public
   */
  tag?: string | undefined;

  /**
   * Version number of the package
   * @public
   */
  version: number | undefined;

  /**
   * Index file path
   * @public
   */
  index: string | undefined;

  /**
   * List of file ids in the package
   * @public
   */
  files: (string)[] | undefined;
}

/**
 * Create package group request body
 * @public
 */
export interface CreatePackageGroupRequest {
  /**
   * Name of the package group
   * @public
   */
  name: string | undefined;

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
 * Package group information
 * @public
 */
export interface PackageGroup {
  /**
   * Unique identifier of the package group
   * @public
   */
  id: string | undefined;

  /**
   * Name of the package group
   * @public
   */
  name: string | undefined;

  /**
   * Whether this is the primary package group
   * @public
   */
  is_primary: boolean | undefined;
}

/**
 * Create package v2 request body
 * @public
 */
export interface CreatePackageV2Request {
  /**
   * ID of the package group
   * @public
   */
  groupId: string | undefined;

  /**
   * Index file (required for primary groups, must not be provided for non-primary)
   * @public
   */
  index?: string | undefined;

  /**
   * Optional tag for the package (e.g., latest, v1.0, production)
   * @public
   */
  tag?: string | undefined;

  /**
   * File ids to be included in the package
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
 * Package V2 information (group-scoped)
 * @public
 */
export interface PackageV2 {
  /**
   * Index file path (required for primary groups, absent for non-primary)
   * @public
   */
  index?: string | undefined;

  /**
   * Tag of the package
   * @public
   */
  tag?: string | undefined;

  /**
   * Version number of the package
   * @public
   */
  version: number | undefined;

  /**
   * List of file ids in the package
   * @public
   */
  files: (string)[] | undefined;

  /**
   * ID of the package group this package belongs to
   * @public
   */
  package_group_id: string | undefined;
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
   * Sub-packages from non-primary groups (format: "groupid@version")
   * @public
   */
  sub_packages?: (string)[] | undefined;

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
  /**
   * Tenant information document
   * @public
   */
  tenant_info: __DocumentType | undefined;
}

/**
 * Release configuration details
 * @public
 */
export interface GetReleaseConfig {
  /**
   * Version of the config
   * @public
   */
  version: string | undefined;

  /**
   * Timeout for the release config in seconds
   * @public
   */
  release_config_timeout: number | undefined;

  /**
   * Boot timeout in seconds
   * @public
   */
  boot_timeout: number | undefined;

  /**
   * Configuration properties
   * @public
   */
  properties: ConfigProperties | undefined;
}

/**
 * Experiment associated with a release
 * @public
 */
export interface ReleaseExperiment {
  /**
   * Unique identifier of the experiment
   * @public
   */
  experiment_id?: string | undefined;

  /**
   * Package version used in the experiment
   * @public
   */
  package_version?: number | undefined;

  /**
   * Config version used in the experiment
   * @public
   */
  config_version?: string | undefined;

  /**
   * Creation timestamp of the experiment
   * @public
   */
  created_at?: string | undefined;

  /**
   * Percentage of traffic routed to this experiment
   * @public
   */
  traffic_percentage?: number | undefined;

  /**
   * Current status of the experiment
   * @public
   */
  status?: string | undefined;
}

/**
 * Served file with URL and checksum
 * @public
 */
export interface ServeFile {
  /**
   * Path of the file
   * @public
   */
  file_path?: string | undefined;

  /**
   * URL to download the file
   * @public
   */
  url?: string | undefined;

  /**
   * Checksum of the file
   * @public
   */
  checksum?: string | undefined;
}

/**
 * Package served with a release
 * @public
 */
export interface ServePackage {
  /**
   * Name identifier of the package
   * @public
   */
  name?: string | undefined;

  /**
   * Version of the package
   * @public
   */
  version?: string | undefined;

  /**
   * Index file of the package
   * @public
   */
  index?: ServeFile | undefined;

  /**
   * Properties of the package
   * @public
   */
  properties?: __DocumentType | undefined;

  /**
   * Important files loaded eagerly
   * @public
   */
  important?: (ServeFile)[] | undefined;

  /**
   * Lazy files loaded on demand
   * @public
   */
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
   * Resources for the release
   * @public
   */
  resources: (ServeFile)[] | undefined;

  /**
   * Sub-packages for the release
   * @public
   */
  sub_packages: (string)[] | undefined;

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
 * Get a single package group request
 * @public
 */
export interface GetPackageGroupRequest {
  /**
   * ID of the package group
   * @public
   */
  groupId: string | undefined;

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
 * Get package v2 by tag
 * @public
 */
export interface GetPackageV2ByTagRequest {
  /**
   * ID of the package group
   * @public
   */
  groupId: string | undefined;

  /**
   * Tag name
   * @public
   */
  tag: string | undefined;

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
 * Get package v2 by version
 * @public
 */
export interface GetPackageV2ByVersionRequest {
  /**
   * ID of the package group
   * @public
   */
  groupId: string | undefined;

  /**
   * Version number
   * @public
   */
  version: number | undefined;

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
 * Package details for get release response (includes group_id)
 * @public
 */
export interface GetReleasePackage {
  /**
   * Name identifier of the package
   * @public
   */
  name?: string | undefined;

  /**
   * ID of the package group
   * @public
   */
  group_id?: string | undefined;

  /**
   * Version of the package
   * @public
   */
  version?: string | undefined;

  /**
   * Index file of the package
   * @public
   */
  index?: ServeFile | undefined;

  /**
   * Properties of the package
   * @public
   */
  properties?: __DocumentType | undefined;

  /**
   * Important files loaded eagerly
   * @public
   */
  important?: (ServeFile)[] | undefined;

  /**
   * Lazy files loaded on demand
   * @public
   */
  lazy?: (ServeFile)[] | undefined;
}

/**
 * Response for getting a single release
 * @public
 */
export interface GetReleaseResponse {
  /**
   * Unique identifier of the release
   * @public
   */
  id?: string | undefined;

  /**
   * Creation timestamp of the release
   * @public
   */
  created_at?: string | undefined;

  /**
   * Release configuration details
   * @public
   */
  config?: GetReleaseConfig | undefined;

  /**
   * Package details of the release
   * @public
   */
  package?: GetReleasePackage | undefined;

  /**
   * Sub-packages from non-primary groups
   * @public
   */
  sub_packages?: (string)[] | undefined;

  /**
   * Resource files associated with the release
   * @public
   */
  resources?: (ServeFile)[] | undefined;

  /**
   * Experiment associated with the release
   * @public
   */
  experiment?: ReleaseExperiment | undefined;

  /**
   * Dimensions associated with the release
   * @public
   */
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
 * List package groups request
 * @public
 */
export interface ListPackageGroupsRequest {
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
   * Search term for filtering package groups by name
   * @public
   */
  search?: string | undefined;

  /**
   * If true, fetch all package groups without pagination
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
 * List package groups response
 * @public
 */
export interface ListPackageGroupsResponse {
  /**
   * List of package groups
   * @public
   */
  data: (PackageGroup)[] | undefined;

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
 * List packages request (legacy - uses primary group)
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
 * List packages v2 request (group-scoped)
 * @public
 */
export interface ListPackagesV2Request {
  /**
   * ID of the package group
   * @public
   */
  groupId: string | undefined;

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
   * Search term for filtering packages
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
 * List packages v2 response
 * @public
 */
export interface ListPackagesV2Response {
  /**
   * List of packages
   * @public
   */
  data: (PackageV2)[] | undefined;

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
 * Release configuration
 * @public
 */
export interface ReleaseConfig {
  /**
   * Release configuration details
   * @public
   */
  config: GetReleaseConfig | undefined;

  /**
   * Package details
   * @public
   */
  package: Package | undefined;

  /**
   * Resources associated with the release
   * @public
   */
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
 * Update package group name request body
 * @public
 */
export interface UpdatePackageGroupRequest {
  /**
   * ID of the package group
   * @public
   */
  groupId: string | undefined;

  /**
   * New name for the package group
   * @public
   */
  name: string | undefined;

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
export const UploadFileRequestFilterSensitiveLog = (obj: UploadFileRequest): any => ({
  ...obj,
})
