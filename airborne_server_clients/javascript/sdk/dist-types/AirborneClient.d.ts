import { HttpAuthSchemeInputConfig, HttpAuthSchemeResolvedConfig } from "./auth/httpAuthSchemeProvider";
import { AcknowledgeEmergencyRollbackCommandInput, AcknowledgeEmergencyRollbackCommandOutput } from "./commands/AcknowledgeEmergencyRollbackCommand";
import { ApproveControlCenterDeploymentRequestCommandInput, ApproveControlCenterDeploymentRequestCommandOutput } from "./commands/ApproveControlCenterDeploymentRequestCommand";
import { CancelControlCenterDeploymentRequestCommandInput, CancelControlCenterDeploymentRequestCommandOutput } from "./commands/CancelControlCenterDeploymentRequestCommand";
import { ConcludeReleaseCommandInput, ConcludeReleaseCommandOutput } from "./commands/ConcludeReleaseCommand";
import { CreateApplicationCommandInput, CreateApplicationCommandOutput } from "./commands/CreateApplicationCommand";
import { CreateCohortRangeCommandInput, CreateCohortRangeCommandOutput } from "./commands/CreateCohortRangeCommand";
import { CreateControlCenterDeploymentRequestCommandInput, CreateControlCenterDeploymentRequestCommandOutput } from "./commands/CreateControlCenterDeploymentRequestCommand";
import { CreateControlCenterGroupCommandInput, CreateControlCenterGroupCommandOutput } from "./commands/CreateControlCenterGroupCommand";
import { CreateDimensionCommandInput, CreateDimensionCommandOutput } from "./commands/CreateDimensionCommand";
import { CreateFileCommandInput, CreateFileCommandOutput } from "./commands/CreateFileCommand";
import { CreateOrganisationCommandInput, CreateOrganisationCommandOutput } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommandInput, CreatePackageCommandOutput } from "./commands/CreatePackageCommand";
import { CreateReleaseCommandInput, CreateReleaseCommandOutput } from "./commands/CreateReleaseCommand";
import { DeleteControlCenterGroupCommandInput, DeleteControlCenterGroupCommandOutput } from "./commands/DeleteControlCenterGroupCommand";
import { DeleteDimensionCommandInput, DeleteDimensionCommandOutput } from "./commands/DeleteDimensionCommand";
import { DiscardReleaseCommandInput, DiscardReleaseCommandOutput } from "./commands/DiscardReleaseCommand";
import { GetControlCenterApprovalPolicyCommandInput, GetControlCenterApprovalPolicyCommandOutput } from "./commands/GetControlCenterApprovalPolicyCommand";
import { GetControlCenterDeploymentRequestCommandInput, GetControlCenterDeploymentRequestCommandOutput } from "./commands/GetControlCenterDeploymentRequestCommand";
import { GetControlCenterDeploymentsCommandInput, GetControlCenterDeploymentsCommandOutput } from "./commands/GetControlCenterDeploymentsCommand";
import { GetControlCenterOverviewCommandInput, GetControlCenterOverviewCommandOutput } from "./commands/GetControlCenterOverviewCommand";
import { GetControlCenterReleaseEventsCommandInput, GetControlCenterReleaseEventsCommandOutput } from "./commands/GetControlCenterReleaseEventsCommand";
import { GetControlCenterRollbackPreviewCommandInput, GetControlCenterRollbackPreviewCommandOutput } from "./commands/GetControlCenterRollbackPreviewCommand";
import { GetReleaseCommandInput, GetReleaseCommandOutput } from "./commands/GetReleaseCommand";
import { GetServingPolicyCommandInput, GetServingPolicyCommandOutput } from "./commands/GetServingPolicyCommand";
import { GetTelemetrySummaryCommandInput, GetTelemetrySummaryCommandOutput } from "./commands/GetTelemetrySummaryCommand";
import { GetUserCommandInput, GetUserCommandOutput } from "./commands/GetUserCommand";
import { IngestTelemetryReportsCommandInput, IngestTelemetryReportsCommandOutput } from "./commands/IngestTelemetryReportsCommand";
import { ListControlCenterDeploymentRequestsCommandInput, ListControlCenterDeploymentRequestsCommandOutput } from "./commands/ListControlCenterDeploymentRequestsCommand";
import { ListControlCenterGroupsCommandInput, ListControlCenterGroupsCommandOutput } from "./commands/ListControlCenterGroupsCommand";
import { ListControlCenterOperationsCommandInput, ListControlCenterOperationsCommandOutput } from "./commands/ListControlCenterOperationsCommand";
import { ListDimensionsCommandInput, ListDimensionsCommandOutput } from "./commands/ListDimensionsCommand";
import { ListFileGroupsCommandInput, ListFileGroupsCommandOutput } from "./commands/ListFileGroupsCommand";
import { ListFilesCommandInput, ListFilesCommandOutput } from "./commands/ListFilesCommand";
import { ListOrganisationsCommandInput, ListOrganisationsCommandOutput } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommandInput, ListPackagesCommandOutput } from "./commands/ListPackagesCommand";
import { ListReleasesCommandInput, ListReleasesCommandOutput } from "./commands/ListReleasesCommand";
import { PostLoginCommandInput, PostLoginCommandOutput } from "./commands/PostLoginCommand";
import { PreviewServingPolicyCommandInput, PreviewServingPolicyCommandOutput } from "./commands/PreviewServingPolicyCommand";
import { PutServingPolicyCommandInput, PutServingPolicyCommandOutput } from "./commands/PutServingPolicyCommand";
import { RampReleaseCommandInput, RampReleaseCommandOutput } from "./commands/RampReleaseCommand";
import { RejectControlCenterDeploymentRequestCommandInput, RejectControlCenterDeploymentRequestCommandOutput } from "./commands/RejectControlCenterDeploymentRequestCommand";
import { RequestOrganisationCommandInput, RequestOrganisationCommandOutput } from "./commands/RequestOrganisationCommand";
import { ResolveControlCenterOperationCommandInput, ResolveControlCenterOperationCommandOutput } from "./commands/ResolveControlCenterOperationCommand";
import { RollbackReleaseCommandInput, RollbackReleaseCommandOutput } from "./commands/RollbackReleaseCommand";
import { ServeReleaseCommandInput, ServeReleaseCommandOutput } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput } from "./commands/ServeReleaseV2Command";
import { UpdateControlCenterApprovalPolicyCommandInput, UpdateControlCenterApprovalPolicyCommandOutput } from "./commands/UpdateControlCenterApprovalPolicyCommand";
import { UpdateControlCenterGroupCommandInput, UpdateControlCenterGroupCommandOutput } from "./commands/UpdateControlCenterGroupCommand";
import { UpdateDimensionCommandInput, UpdateDimensionCommandOutput } from "./commands/UpdateDimensionCommand";
import { UpdateFileCommandInput, UpdateFileCommandOutput } from "./commands/UpdateFileCommand";
import { UploadFileCommandInput, UploadFileCommandOutput } from "./commands/UploadFileCommand";
import { RuntimeExtension, RuntimeExtensionsConfig } from "./runtimeExtensions";
import { HostHeaderInputConfig, HostHeaderResolvedConfig } from "@aws-sdk/middleware-host-header";
import { UserAgentInputConfig, UserAgentResolvedConfig } from "@aws-sdk/middleware-user-agent";
import { CustomEndpointsInputConfig, CustomEndpointsResolvedConfig } from "@smithy/config-resolver";
import { RetryInputConfig, RetryResolvedConfig } from "@smithy/middleware-retry";
import { HttpHandlerUserInput as __HttpHandlerUserInput } from "@smithy/protocol-http";
import { Client as __Client, DefaultsMode as __DefaultsMode, SmithyConfiguration as __SmithyConfiguration, SmithyResolvedConfiguration as __SmithyResolvedConfiguration } from "@smithy/smithy-client";
import { Provider, BodyLengthCalculator as __BodyLengthCalculator, CheckOptionalClientConfig as __CheckOptionalClientConfig, ChecksumConstructor as __ChecksumConstructor, Decoder as __Decoder, Encoder as __Encoder, HashConstructor as __HashConstructor, HttpHandlerOptions as __HttpHandlerOptions, Logger as __Logger, Provider as __Provider, StreamCollector as __StreamCollector, UrlParser as __UrlParser, UserAgent as __UserAgent } from "@smithy/types";
export { __Client };
/**
 * @public
 */
export type ServiceInputTypes = AcknowledgeEmergencyRollbackCommandInput | ApproveControlCenterDeploymentRequestCommandInput | CancelControlCenterDeploymentRequestCommandInput | ConcludeReleaseCommandInput | CreateApplicationCommandInput | CreateCohortRangeCommandInput | CreateControlCenterDeploymentRequestCommandInput | CreateControlCenterGroupCommandInput | CreateDimensionCommandInput | CreateFileCommandInput | CreateOrganisationCommandInput | CreatePackageCommandInput | CreateReleaseCommandInput | DeleteControlCenterGroupCommandInput | DeleteDimensionCommandInput | DiscardReleaseCommandInput | GetControlCenterApprovalPolicyCommandInput | GetControlCenterDeploymentRequestCommandInput | GetControlCenterDeploymentsCommandInput | GetControlCenterOverviewCommandInput | GetControlCenterReleaseEventsCommandInput | GetControlCenterRollbackPreviewCommandInput | GetReleaseCommandInput | GetServingPolicyCommandInput | GetTelemetrySummaryCommandInput | GetUserCommandInput | IngestTelemetryReportsCommandInput | ListControlCenterDeploymentRequestsCommandInput | ListControlCenterGroupsCommandInput | ListControlCenterOperationsCommandInput | ListDimensionsCommandInput | ListFileGroupsCommandInput | ListFilesCommandInput | ListOrganisationsCommandInput | ListPackagesCommandInput | ListReleasesCommandInput | PostLoginCommandInput | PreviewServingPolicyCommandInput | PutServingPolicyCommandInput | RampReleaseCommandInput | RejectControlCenterDeploymentRequestCommandInput | RequestOrganisationCommandInput | ResolveControlCenterOperationCommandInput | RollbackReleaseCommandInput | ServeReleaseCommandInput | ServeReleaseV2CommandInput | UpdateControlCenterApprovalPolicyCommandInput | UpdateControlCenterGroupCommandInput | UpdateDimensionCommandInput | UpdateFileCommandInput | UploadFileCommandInput;
/**
 * @public
 */
export type ServiceOutputTypes = AcknowledgeEmergencyRollbackCommandOutput | ApproveControlCenterDeploymentRequestCommandOutput | CancelControlCenterDeploymentRequestCommandOutput | ConcludeReleaseCommandOutput | CreateApplicationCommandOutput | CreateCohortRangeCommandOutput | CreateControlCenterDeploymentRequestCommandOutput | CreateControlCenterGroupCommandOutput | CreateDimensionCommandOutput | CreateFileCommandOutput | CreateOrganisationCommandOutput | CreatePackageCommandOutput | CreateReleaseCommandOutput | DeleteControlCenterGroupCommandOutput | DeleteDimensionCommandOutput | DiscardReleaseCommandOutput | GetControlCenterApprovalPolicyCommandOutput | GetControlCenterDeploymentRequestCommandOutput | GetControlCenterDeploymentsCommandOutput | GetControlCenterOverviewCommandOutput | GetControlCenterReleaseEventsCommandOutput | GetControlCenterRollbackPreviewCommandOutput | GetReleaseCommandOutput | GetServingPolicyCommandOutput | GetTelemetrySummaryCommandOutput | GetUserCommandOutput | IngestTelemetryReportsCommandOutput | ListControlCenterDeploymentRequestsCommandOutput | ListControlCenterGroupsCommandOutput | ListControlCenterOperationsCommandOutput | ListDimensionsCommandOutput | ListFileGroupsCommandOutput | ListFilesCommandOutput | ListOrganisationsCommandOutput | ListPackagesCommandOutput | ListReleasesCommandOutput | PostLoginCommandOutput | PreviewServingPolicyCommandOutput | PutServingPolicyCommandOutput | RampReleaseCommandOutput | RejectControlCenterDeploymentRequestCommandOutput | RequestOrganisationCommandOutput | ResolveControlCenterOperationCommandOutput | RollbackReleaseCommandOutput | ServeReleaseCommandOutput | ServeReleaseV2CommandOutput | UpdateControlCenterApprovalPolicyCommandOutput | UpdateControlCenterGroupCommandOutput | UpdateDimensionCommandOutput | UpdateFileCommandOutput | UploadFileCommandOutput;
/**
 * @public
 */
export interface ClientDefaults extends Partial<__SmithyConfiguration<__HttpHandlerOptions>> {
    /**
     * The HTTP handler to use or its constructor options. Fetch in browser and Https in Nodejs.
     */
    requestHandler?: __HttpHandlerUserInput;
    /**
     * A constructor for a class implementing the {@link @smithy/types#ChecksumConstructor} interface
     * that computes the SHA-256 HMAC or checksum of a string or binary buffer.
     * @internal
     */
    sha256?: __ChecksumConstructor | __HashConstructor;
    /**
     * The function that will be used to convert strings into HTTP endpoints.
     * @internal
     */
    urlParser?: __UrlParser;
    /**
     * A function that can calculate the length of a request body.
     * @internal
     */
    bodyLengthChecker?: __BodyLengthCalculator;
    /**
     * A function that converts a stream into an array of bytes.
     * @internal
     */
    streamCollector?: __StreamCollector;
    /**
     * The function that will be used to convert a base64-encoded string to a byte array.
     * @internal
     */
    base64Decoder?: __Decoder;
    /**
     * The function that will be used to convert binary data to a base64-encoded string.
     * @internal
     */
    base64Encoder?: __Encoder;
    /**
     * The function that will be used to convert a UTF8-encoded string to a byte array.
     * @internal
     */
    utf8Decoder?: __Decoder;
    /**
     * The function that will be used to convert binary data to a UTF-8 encoded string.
     * @internal
     */
    utf8Encoder?: __Encoder;
    /**
     * The runtime environment.
     * @internal
     */
    runtime?: string;
    /**
     * Disable dynamically changing the endpoint of the client based on the hostPrefix
     * trait of an operation.
     */
    disableHostPrefix?: boolean;
    /**
     * Setting a client profile is similar to setting a value for the
     * AWS_PROFILE environment variable. Setting a profile on a client
     * in code only affects the single client instance, unlike AWS_PROFILE.
     *
     * When set, and only for environments where an AWS configuration
     * file exists, fields configurable by this file will be retrieved
     * from the specified profile within that file.
     * Conflicting code configuration and environment variables will
     * still have higher priority.
     *
     * For client credential resolution that involves checking the AWS
     * configuration file, the client's profile (this value) will be
     * used unless a different profile is set in the credential
     * provider options.
     *
     */
    profile?: string;
    /**
     * The provider populating default tracking information to be sent with `user-agent`, `x-amz-user-agent` header
     * @internal
     */
    defaultUserAgentProvider?: Provider<__UserAgent>;
    /**
     * Value for how many times a request will be made at most in case of retry.
     */
    maxAttempts?: number | __Provider<number>;
    /**
     * Specifies which retry algorithm to use.
     * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-smithy-util-retry/Enum/RETRY_MODES/
     *
     */
    retryMode?: string | __Provider<string>;
    /**
     * Optional logger for logging debug/info/warn/error.
     */
    logger?: __Logger;
    /**
     * Optional extensions
     */
    extensions?: RuntimeExtension[];
    /**
     * The {@link @smithy/smithy-client#DefaultsMode} that will be used to determine how certain default configuration options are resolved in the SDK.
     */
    defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;
}
/**
 * @public
 */
export type AirborneClientConfigType = Partial<__SmithyConfiguration<__HttpHandlerOptions>> & ClientDefaults & UserAgentInputConfig & CustomEndpointsInputConfig & RetryInputConfig & HostHeaderInputConfig & HttpAuthSchemeInputConfig;
/**
 * @public
 *
 *  The configuration interface of AirborneClient class constructor that set the region, credentials and other options.
 */
export interface AirborneClientConfig extends AirborneClientConfigType {
}
/**
 * @public
 */
export type AirborneClientResolvedConfigType = __SmithyResolvedConfiguration<__HttpHandlerOptions> & Required<ClientDefaults> & RuntimeExtensionsConfig & UserAgentResolvedConfig & CustomEndpointsResolvedConfig & RetryResolvedConfig & HostHeaderResolvedConfig & HttpAuthSchemeResolvedConfig;
/**
 * @public
 *
 *  The resolved configuration interface of AirborneClient class. This is resolved and normalized from the {@link AirborneClientConfig | constructor configuration interface}.
 */
export interface AirborneClientResolvedConfig extends AirborneClientResolvedConfigType {
}
/**
 * Service for managing OTA updates and configurations
 * @public
 */
export declare class AirborneClient extends __Client<__HttpHandlerOptions, ServiceInputTypes, ServiceOutputTypes, AirborneClientResolvedConfig> {
    /**
     * The resolved configuration of AirborneClient class. This is resolved and normalized from the {@link AirborneClientConfig | constructor configuration interface}.
     */
    readonly config: AirborneClientResolvedConfig;
    constructor(...[configuration]: __CheckOptionalClientConfig<AirborneClientConfig>);
    /**
     * Destroy underlying resources, like sockets. It's usually not necessary to do this.
     * However in Node.js, it's best to explicitly shut down the client's agent when it is no longer needed.
     * Otherwise, sockets might stay open for quite a long time before the server terminates them.
     */
    destroy(): void;
}
