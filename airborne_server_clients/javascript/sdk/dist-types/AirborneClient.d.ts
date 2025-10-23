import { HttpAuthSchemeInputConfig, HttpAuthSchemeResolvedConfig } from "./auth/httpAuthSchemeProvider";
import { CreateApplicationCommandInput, CreateApplicationCommandOutput } from "./commands/CreateApplicationCommand";
import { CreateDimensionCommandInput, CreateDimensionCommandOutput } from "./commands/CreateDimensionCommand";
import { CreateFileCommandInput, CreateFileCommandOutput } from "./commands/CreateFileCommand";
import { CreateOrganisationCommandInput, CreateOrganisationCommandOutput } from "./commands/CreateOrganisationCommand";
import { CreatePackageCommandInput, CreatePackageCommandOutput } from "./commands/CreatePackageCommand";
import { CreateReleaseCommandInput, CreateReleaseCommandOutput } from "./commands/CreateReleaseCommand";
import { DeleteDimensionCommandInput, DeleteDimensionCommandOutput } from "./commands/DeleteDimensionCommand";
import { GetReleaseCommandInput, GetReleaseCommandOutput } from "./commands/GetReleaseCommand";
import { GetUserCommandInput, GetUserCommandOutput } from "./commands/GetUserCommand";
import { ListDimensionsCommandInput, ListDimensionsCommandOutput } from "./commands/ListDimensionsCommand";
import { ListFilesCommandInput, ListFilesCommandOutput } from "./commands/ListFilesCommand";
import { ListOrganisationsCommandInput, ListOrganisationsCommandOutput } from "./commands/ListOrganisationsCommand";
import { ListPackagesCommandInput, ListPackagesCommandOutput } from "./commands/ListPackagesCommand";
import { ListReleasesCommandInput, ListReleasesCommandOutput } from "./commands/ListReleasesCommand";
import { ListVersionsCommandInput, ListVersionsCommandOutput } from "./commands/ListVersionsCommand";
import { PostLoginCommandInput, PostLoginCommandOutput } from "./commands/PostLoginCommand";
import { RequestOrganisationCommandInput, RequestOrganisationCommandOutput } from "./commands/RequestOrganisationCommand";
import { ServeReleaseCommandInput, ServeReleaseCommandOutput } from "./commands/ServeReleaseCommand";
import { ServeReleaseV2CommandInput, ServeReleaseV2CommandOutput } from "./commands/ServeReleaseV2Command";
import { UpdateDimensionCommandInput, UpdateDimensionCommandOutput } from "./commands/UpdateDimensionCommand";
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
export type ServiceInputTypes = CreateApplicationCommandInput | CreateDimensionCommandInput | CreateFileCommandInput | CreateOrganisationCommandInput | CreatePackageCommandInput | CreateReleaseCommandInput | DeleteDimensionCommandInput | GetReleaseCommandInput | GetUserCommandInput | ListDimensionsCommandInput | ListFilesCommandInput | ListOrganisationsCommandInput | ListPackagesCommandInput | ListReleasesCommandInput | ListVersionsCommandInput | PostLoginCommandInput | RequestOrganisationCommandInput | ServeReleaseCommandInput | ServeReleaseV2CommandInput | UpdateDimensionCommandInput | UploadFileCommandInput;
/**
 * @public
 */
export type ServiceOutputTypes = CreateApplicationCommandOutput | CreateDimensionCommandOutput | CreateFileCommandOutput | CreateOrganisationCommandOutput | CreatePackageCommandOutput | CreateReleaseCommandOutput | DeleteDimensionCommandOutput | GetReleaseCommandOutput | GetUserCommandOutput | ListDimensionsCommandOutput | ListFilesCommandOutput | ListOrganisationsCommandOutput | ListPackagesCommandOutput | ListReleasesCommandOutput | ListVersionsCommandOutput | PostLoginCommandOutput | RequestOrganisationCommandOutput | ServeReleaseCommandOutput | ServeReleaseV2CommandOutput | UpdateDimensionCommandOutput | UploadFileCommandOutput;
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
