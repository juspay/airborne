# Airborne: Seamless Over-The-Air Updates for Your Applications

[![Maven Central](https://img.shields.io/maven-central/v/io.juspay/airborne.svg?label=maven:airborne)](https://central.sonatype.com/artifact/io.juspay/airborne)
[![Maven Central](https://img.shields.io/maven-central/v/io.juspay/airborne-react.svg?label=maven:airborne-react)](https://central.sonatype.com/artifact/io.juspay/airborne-react)

Airborne empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their **Android, iOS, and React Native applications**. Our primary focus is to provide robust, easy-to-use SDKs and plugins that streamline the update process directly within your client applications.

Optionally, for those who require full control over the update infrastructure, Airborne also offers a comprehensive backend server.

## ✨ Empower Your Apps with OTA Updates: Key SDK Features

Airborne's SDKs and plugins are designed to make OTA updates a breeze:

- **Effortless Integration**: Lightweight SDKs for native Android and iOS, plus a dedicated plugin for React Native applications.
- **Client-Side Control**: Manage update checks, downloads, and installations directly from your application code.
- **Flexible Update Strategies**: Implement various update flows, such as silent updates, user-prompted updates, or forced updates.
- **Cross-Platform Consistency**: The React Native plugin ensures a consistent OTA experience across both Android and iOS.
- **Open Source**: Our SDKs are open source, allowing for transparency, customization, and community contributions.

## 🚀 Core Components: SDKs First

Airborne is primarily about enabling your applications with powerful update mechanisms:

- **[Airborne Android SDK](android/README.md)**: Integrate OTA update capabilities directly into your native Android applications. This lightweight SDK provides the tools to check for, download, and apply updates seamlessly. (Further details in its README).
- **[Airborne iOS SDK](iOS/README.md)**: Similarly, equip your native iOS applications with OTA functionality using our dedicated iOS SDK. (Further details in its README).
- **[Airborne React Native Plugin](airborne-react-plugin/README.md)**: The ideal solution for React Native developers. This plugin allows you to manage OTA updates across both Android and iOS platforms with a unified JavaScript API. (Further details in its README).
- **[Airborne React Native Example](react-example/README.md)**: A practical example application demonstrating how to use the Airborne React Native Plugin and integrate it with an update source. (Further details in its README).

## SDK Configuration and Download Flow Details

This section delves into the specifics of the Airborne SDK's configuration file structure and the download/usage flows it manages.

### Core Concepts

We are seeing 2 broad categories of files that have to be downloaded:

- **Package**: An atomic unit, which consists of files and properties requiring all files to be present to boot. A package can be further divided into two sets:
  - **Important**: If these files are not present by the boot timeout, then this package is not used.
  - **Lazy**: If the priority files are downloaded by boot timeout, then these files will download in parallel and inform the application upon completion.
- **Resources**: These are files that will work in any combination. All resources that load before the boot timeout are used in that session.

### Configuration File Structure

The SDK requires a configuration file with the following structure:

```json
{
  "version": "1",
  "config": {
    "version": "1.0.0",
    "release_config_timeout": 1000,
    "boot_timeout": 1000,
    "properties": {}
  },
  "package": {
    "name": "Application_Name",
    "version": "1.0.0",
    "index": {
      "url": "https://assets.juspay.in/bundles/index.js",
      "filePath": "index.js"
    },
    "properties": {},
    "important": [
      {
        "url": "https://assets.juspay.in/bundles/initial.js",
        "filePath": "initial.js"
      }
    ],
    "lazy": [
      {
        "url": "https://assets.juspay.in/images/card.png",
        "filePath": "card.png"
      }
    ]
  },
  "resources": [
    {
      "url": "https://assets.juspay.in/configs/config.js",
      "filePath": "config.js"
    }
  ]
}
```

The above structure has 4 parts: `version`, `config`, `package`, and `resources`.

- **Version**: This is the version of the structure of the above file.
- **Config**: Contains the configuration for the SDK to decide the behavior of downloads. It contains the following keys:
  - `version`: Used to indicate the current version of the config.
  - `release_config_timeout`: Timeout for this file to complete downloading. This is used in the next session.
  - `boot_timeout`: Timeout for both the package and resource block to complete downloading. This is called boot time since it is an indicator that the application can use the package to begin booting.
  - `properties`: This is a user-defined field block which can be used to send any config keys to the application.
- **Package**: A package is an atomic unit. The package block as mentioned above is a transactional set of files. The package block contains the spec for the package. It contains the following keys:
  - `name`: The name of the application represented by this package.
  - `version`: The version of this package. Note: if the version is not changed, the SDK will not initiate the download of the package.
  - `properties`: This is a user-defined field block which can be used to send any config keys to configure their application. This block is used to send keys specific to this version of the package, unlike the block in `config` which will give the latest available.
  - `index`: A special entry for the file used as the entry point to the package.
  - `important`: List of files required at the start of the application. The application cannot boot without these files.
  - `lazy`: List of files which extend the `important` block; This can be used for non-critical code files, images, etc.
- **Resources**: List of files which will attempt to download before the `boot_timeout`. All files that complete before timeout will be available during boot.

### Download and Usage Flow

#### Case 1: Happy Case

The entire `package.important` block is available before boot timeout.

![Case 1: Happy Case](readme-images/Case%201%20Happy%20Case.png)

#### Case 2: Package Timeout

If the `package.important` block is not completely downloaded on time, the entire package set is not used. The SDK will supply the previous package along with relevant configurations to its users.

![Case 2: Package Timeout](readme-images/Case%202%20Package%20Timeout.png)

#### Case 3: Resource Timeout

If the resource block is not completely downloaded by the time of load, then all files downloaded before the timeout are used. Files downloaded after are not available in this session. This ensures that file read operations in one session are idempotent.

![Case 3: Resource Timeout](readme-images/Case%203%20Resource%20Timeout.png)

### Feature list

- Splits (Webpack - split) support for bundles
- Security via signature validation
- CLI for pushing releases
- React plugin to use sdk
- Juspay server / Self hosted
- Adoption Analytics

### Optional Add-ons: The Airborne Backend Systems

For developers who need comprehensive backend solutions to manage updates and analytics:

#### **[Airborne Server](airborne_server/README.md)**

A robust backend system that can manage application versions, store update packages, and deliver them to your SDK-integrated applications.

- **Key functionalities**: User authentication (OIDC-based; Keycloak-compatible), organization/application management, package storage, release configurations, and a dashboard UI.
- **Technology stack**: Rust (Actix Web), PostgreSQL, Keycloak, Docker, LocalStack (for AWS emulation).

#### **[Airborne Analytics Server](airborne_analytics_server/README.md)**

A high-performance analytics platform that provides comprehensive OTA update insights and monitoring.

- **Key functionalities**: Real-time event streaming, adoption metrics, failure analysis, performance tracking, multi-tenant analytics.
- **Technology stack**: Rust (Actix Web), Kafka, ClickHouse/Victoria Metrics, Grafana for visualization.
- **Features**: Event ingestion API, real-time dashboards, adoption rates, version distribution analysis, device tracking.

**Note**: While powerful, using these servers is optional. The SDKs can be configured to work with other update distribution and analytics mechanisms if preferred.

## 🏁 Getting Started with Airborne SDKs

Integrating OTA updates into your application is straightforward:

1.  **Choose Your SDK/Plugin**:

    - For **native Android** applications: Use the [Airborne Android SDK](android/README.md).
    - For **native iOS** applications: Use the [Airborne iOS SDK](iOS/README.md).
    - For **React Native** applications: Use the [Airborne React Native Plugin](airborne-react-plugin/README.md). Refer to the [Airborne React Native Example](react-example/README.md) for a practical guide.

2.  **Integrate into Your Project**: Follow the specific installation and setup instructions provided in the README of your chosen SDK/plugin.

3.  **Configure Update Source**: Point your SDK/plugin to an update source. This could be the optional Airborne Server or any other compatible update distribution mechanism.

4.  **Implement Update Logic**: Use the SDK/plugin APIs to check for updates, download them, and apply them according to your application's requirements.

### Setting up the Optional Airborne Server

If you choose to use the self-hosted Airborne Server:

**Prerequisites:**

**Option 1: Using Nix (Recommended)**

- **Nix with Flakes**: All dependencies automatically provided with `nix develop`
  - This provides: Rust toolchain, cargo-watch, diesel-cli, Node.js, Make, Docker/Podman Compose, jq, yq, curl, AWS CLI, and all required system libraries

**Option 2: Manual Installation**

- **System Dependencies:**
  - Docker or Podman (with Docker Compose support)
  - Git
  - Make (GNU Make)
  - Node.js 22+ (for frontend builds)
  - curl
  - jq (JSON processor)
  - yq (YAML processor)
- **Rust Development Dependencies:**
  - Rust toolchain (cargo, rustc)
  - cargo-watch (for development hot-reloading): `cargo install cargo-watch`
  - diesel-cli (for database migrations): `cargo install diesel_cli --no-default-features --features postgres`
- **Platform-Specific Dependencies:**
  - **For Analytics Server**: OpenSSL development libraries, Cyrus SASL libraries, pkg-config, cmake
  - **For Main Server**: PostgreSQL client libraries, OpenSSL development libraries, pkg-config
  - **macOS**: libiconv (usually provided by Xcode Command Line Tools)
  - **Linux**: libssl-dev, libpq-dev, libsasl2-dev packages (Ubuntu/Debian) or equivalent

**One-Command Setup:**

1.  **Clone the Repository** (if you haven't already):
    ```bash
    git clone <repository-url> # Replace <repository-url> with the actual URL
    cd airborne
    ```
2.  **Set up Environment**:
    ```bash
    make setup                          # With encryption (default)
    make setup USE_ENCRYPTED_SECRETS=false   # Without encryption
    ```
    
    The `make setup` command will:
    - Set up environment (encrypted or plaintext based on flag)
    - Start all infrastructure services (PostgreSQL, Keycloak, LocalStack, Superposition)
    - Install Node.js dependencies
    
    **Options:**
    - `USE_ENCRYPTED_SECRETS=true` (default): Encrypts secrets using KMS + AES-GCM
    - `USE_ENCRYPTED_SECRETS=false`: Uses plaintext secrets for local development

3.  **Start the Server**:
    - **Airborne server** development mode (with hot-reloading):
      ```bash
      make run
      ```
    - **Analytics server** development mode (with hot-reloading):
      ```bash
      make run-analytics
      ```
    - For other available commands, see the help:
      ```bash
      make help
      ```
    - For detailed setup options, see the [Airborne Server README](airborne_server/README.md).

### Environment Variables Reference

The Airborne server uses the following environment variables. All secrets can be encrypted using the KMS + Envelope Encryption pattern.

#### Encryption Settings

| Variable | Required | Encrypted | Description |
|----------|----------|-----------|-------------|
| `USE_ENCRYPTED_SECRETS` | No | No | Enable/disable encryption. Default: `true`. Set to `false` for plaintext mode. |
| `MASTER_KEY` | Yes* | Yes | KMS-encrypted Data Encryption Key (DEK). Required when `USE_ENCRYPTED_SECRETS=true`. |

*Required only when encryption is enabled.

#### Server Settings

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `PORT` | No | No | `8081` | HTTP server port |
| `KEEP_ALIVE` | No | No | `30` | Keep-alive timeout in seconds |
| `BACKLOG` | No | No | `1024` | TCP listen backlog |
| `ACTIX_WORKERS` | No | No | `4` | Number of Actix worker threads |
| `SERVER_PATH_PREFIX` | No | No | `api` | API route prefix |
| `LOG_FORMAT` | No | No | (empty) | Custom log format |
| `RUST_LOG` | No | No | `info` | Rust logging level |

#### Database Settings

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `DB_USER` | Yes | No | - | PostgreSQL username |
| `DB_PASSWORD` | Yes | **Yes** | - | PostgreSQL password |
| `DB_MIGRATION_USER` | Yes | No | - | Migration database username |
| `DB_MIGRATION_PASSWORD` | Yes | **Yes** | - | Migration database password |
| `DB_HOST` | Yes | No | - | PostgreSQL host |
| `DB_PORT` | Yes | No | - | PostgreSQL port |
| `DB_NAME` | Yes | No | - | PostgreSQL database name |
| `DB_URL` | No | No | - | Full database URL (overrides individual settings) |
| `DB_MIGRATION_URL` | No | No | - | Migration database URL |
| `DATABASE_POOL_SIZE` | No | No | `4` | Connection pool size |

#### AWS / S3 Settings

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `AWS_BUCKET` | Yes | No | - | S3 bucket name for package storage |
| `AWS_REGION` | No | No | - | AWS region (e.g., `us-east-1`) |
| `AWS_ENDPOINT_URL` | No | No | - | Custom S3 endpoint (for LocalStack) |
| `AWS_ACCESS_KEY_ID` | No* | No | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No* | **Yes** | - | AWS secret key |
| `AWS_SESSION_TOKEN` | No* | No | - | AWS session token |
| `CLOUDFRONT_DISTRIBUTION_ID` | No | No | - | CloudFront distribution ID for CDN |

*Required when using real AWS. Not needed for LocalStack.

#### AuthN Provider Settings

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `AUTHN_PROVIDER` | No | No | `keycloak` | AuthN provider (`keycloak`, `oidc`, `okta`, or `auth0`) |
| `OIDC_ISSUER_URL` | Yes | No | - | OIDC issuer URL |
| `OIDC_EXTERNAL_ISSUER_URL` | No | No | - | External OIDC issuer/base URL used for browser redirects (defaults to `OIDC_ISSUER_URL`) |
| `OIDC_CLIENT_ID` | Yes | No | - | OIDC client ID |
| `OIDC_CLIENT_SECRET` | Yes | **Yes** | - | OIDC client secret |
| `AUTH_ADMIN_CLIENT_ID` | Yes | No | - | Client ID used for AuthZ/admin API token acquisition |
| `AUTH_ADMIN_CLIENT_SECRET` | Yes | **Yes** | - | Client secret used for AuthZ/admin API token acquisition |
| `AUTH_ADMIN_TOKEN_URL` | Yes | No | - | OAuth token endpoint for admin API access tokens |
| `AUTH_ADMIN_AUDIENCE` | No | No | - | Optional audience parameter (commonly required by Auth0) |
| `AUTH_ADMIN_SCOPES` | No | No | - | Optional space-separated scopes (commonly required by Okta/Auth0) |
| `AUTH_ADMIN_ISSUER` | Yes | No | - | Issuer URL used to derive Keycloak AuthZ realm/base URL |

For current Keycloak-backed authorization, `AUTH_ADMIN_ISSUER` must be a Keycloak realm issuer URL (`.../realms/<realm>`).

#### Superposition Settings

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `SUPERPOSITION_URL` | Yes | No | - | Superposition service URL |
| `SUPERPOSITION_ORG_ID` | Yes | No | - | Organization ID in Superposition |
| `SUPERPOSITION_TOKEN` | No | **Yes** | - | Superposition API token |
| `SUPERPOSITION_USER_TOKEN` | No | **Yes** | - | Superposition user token (for authenticated mode) |
| `SUPERPOSITION_ORG_TOKEN` | No | **Yes** | - | Superposition organization token (for authenticated mode) |
| `ENABLE_AUTHENTICATED_SUPERPOSITION` | No | No | `false` | Enable authenticated Superposition calls |
| `SUPERPOSITION_MIGRATION_STRATEGY` | No | No | `PATCH` | Migration strategy: `PATCH` or `OVERRIDE` |
| `MIGRATIONS_TO_RUN_ON_BOOT` | No | No | (empty) | Comma-separated list: `db`, `superposition` |

#### Feature Flags

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `OIDC_ENABLED_IDPS` | No | No | (empty) | Comma-separated OIDC IdP hints for Keycloak OAuth (for example: `google,github`) |
| `ORGANISATION_CREATION_DISABLED` | No | No | `false` | Disable organisation creation via API |

*When `ORGANISATION_CREATION_DISABLED=true`, the following are required:*
- `GOOGLE_SPREADSHEET_ID` - Google Sheets ID for org requests
- `GCP_SERVICE_ACCOUNT_PATH` OR `GOOGLE_SERVICE_ACCOUNT_KEY` - GCP credentials

Note: the environment variable is spelled `ORGANISATION_CREATION_DISABLED`.

#### Google Integration (Optional)

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `GOOGLE_SPREADSHEET_ID` | Conditional | No | - | Google Sheets ID for org requests |
| `GCP_SERVICE_ACCOUNT_PATH` | Conditional | No | - | Path to GCP service account JSON file |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Conditional | **Yes** | - | GCP service account key JSON content |

*Required when `ORGANISATION_CREATION_DISABLED=true`*

#### Public Endpoint

| Variable | Required | Encrypted | Default | Description |
|----------|----------|-----------|---------|-------------|
| `PUBLIC_ENDPOINT` | Yes | No | - | Public URL for the server (used in generated links) |

### Running Locally

#### With Encrypted Secrets (Production-like)

```bash
# 1. Set up encrypted environment (one-time)
make setup-encrypted

# 2. Run the server
make run
```

The `setup-encrypted` command:
1. Generates a Data Encryption Key (DEK) → saves to `.masterkey.local`
2. Encrypts the DEK with AWS KMS → stores in `.env` as `MASTER_KEY`
3. Encrypts all secrets using AES-256-GCM with the DEK
4. Creates an `.env` file with encrypted values

#### Without Encryption (Local Development)

```bash
# 1. Set up plaintext environment (one-time)
make setup-plaintext

# 2. Run with encryption disabled
USE_ENCRYPTED_SECRETS=false make run
```

Or manually edit `.env`:
```bash
USE_ENCRYPTED_SECRETS=false
# ... other plaintext env vars
```

#### Creating Encrypted Secrets

To encrypt new secrets or re-encrypt existing ones:

```bash
# From project root
cd airborne_server && ./scripts/encrypt-envs.sh
```

This script will:
- Use existing `.masterkey.local` if present (won't regenerate)
- Generate new DEK only if `.masterkey.local` doesn't exist
- Encrypt all secrets in `.env`
- Output KMS-encrypted master key

**Important:** Keep `.masterkey.local` secure and never commit it to version control!

**Services Started by `make run`:**

- **Backend API**: `http://localhost:8081`
- **Keycloak (Authentication)**: `http://localhost:8180` (Default admin: `admin/admin`)
- **PostgreSQL Database**: `localhost:5433`
- **LocalStack (AWS Mock)**: `http://localhost:4566`
- **Superposition**: `http://localhost:8080`

**Services Started by `make run-analytics`:**

- **Analytics Backend API**: `http://localhost:6400`
- **Grafana Dashboard**: `http://localhost:4000` (admin/admin)
- **Victoria Metrics**: `http://localhost:8428`

**Alternative Analytics Stack (`make run-kafka-clickhouse`):**

- **Analytics Backend API**: `http://localhost:6400`
- **Kafka UI**: `http://localhost:8080`
- **ClickHouse**: `http://localhost:8123`
- **Supporting services**: Zookeeper, Kafka

**Available Make Commands:**

The project now uses a single consolidated Makefile at the root directory. Key commands include:

**Main Development Commands:**

- `make run` - Run the complete Airborne server development environment with hot-reloading
- `make run-analytics` - Run the analytics server with Grafana + Victoria Metrics
- `make run-kafka-clickhouse` - Run the analytics server with Kafka + ClickHouse stack

**Infrastructure Services:**

- `make setup` - Set up all dependencies (database, services, etc.)
- `make db` - Start PostgreSQL database
- `make keycloak` - Start Keycloak authentication service
- `make localstack` - Start LocalStack (AWS mock)
- `make superposition` - Start Superposition service

**Analytics Services:**

- `make grafana` - Start Grafana dashboard
- `make victoria-metrics` - Start Victoria Metrics time series DB
- `make kafka` - Start Kafka message broker
- `make clickhouse` - Start ClickHouse analytics database
- `make zookeeper` - Start Zookeeper coordination service
- `make kafka-ui` - Start Kafka UI management interface

**Build Commands:**

- `make airborne-server` - Build the Airborne server
- `make analytics-server` - Build the analytics server
- `make dashboard` - Build the dashboard React app
- `make docs` - Build the docs React app

**Utility Commands:**

- `make status` - Show current system status
- `make stop` - Stop all services gracefully
- `make cleanup` - Clean up containers and volumes
- `make help` - Show all available commands with descriptions

For more detailed server setup, API routes, database schema, and ACL information, please refer to the **[Airborne Server README](airborne_server/README.md)**.

## 🔧 Development & Build System

Airborne uses a consolidated Makefile-based build system located at the project root. This single Makefile manages all components of the project:

- **Server Development**: Full-stack Airborne server with hot-reloading
- **Analytics Development**: Analytics server with multiple backend options
- **Infrastructure Management**: Database, authentication, and supporting services
- **Code Quality**: Formatting, linting, and testing across all components
- **Frontend Builds**: React-based dashboard and docs applications

**Key Benefits:**

- Single command interface for all project operations
- Consistent development experience across all components
- Integrated dependency management and service orchestration
- Simplified CI/CD workflows

Run `make help` from the project root to see all available commands and their descriptions.

## 🤝 Contributing

We welcome contributions to Airborne, especially to our SDKs and plugins! If you're interested in contributing:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them with clear, descriptive messages.
4.  Push your changes to your fork (`git push origin feature/your-feature-name`).
5.  Submit a pull request to the main repository.

Please ensure your code adheres to existing coding styles and includes appropriate tests where applicable. Key areas for contribution include enhancing SDK features, improving the developer experience, or adding more examples.

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

_This README provides a general overview. For detailed information on specific SDKs, plugins, or the optional server, please refer to the documentation within each sub-project._
