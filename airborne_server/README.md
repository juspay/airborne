# Airborne Server

The Airborne Server is a robust backend system designed to power the Software-as-a-Service (SaaS) offering of the Airborne SDK. It provides comprehensive management capabilities for users, organizations, applications, software packages, configurations, and release cycles, enabling seamless and controlled Over-The-Air (OTA) updates for client applications.

## Key Features

- **Multi-Tenant Architecture:** Securely manage multiple organizations and their respective applications.
- **Granular Access Control:** Leverages Keycloak for fine-grained user permissions and roles.
- **Flexible Package Management:** Supports versioning and distribution of application packages.
- **Dynamic Configuration:** Manage application configurations and release-specific settings.
- **Controlled Releases:** Facilitates staged rollouts and management of application releases.
- **Transactional Integrity:** Ensures consistency across distributed operations involving Keycloak, Superposition, and S3.
- **Admin Dashboard:** A React-based user interface for server administration and monitoring.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [User Management](#user-management)
  - [Organization Management](#organization-management)
  - [Application Management](#application-management)
  - [Package Management](#package-management)
  - [Configuration Management](#configuration-management)
  - [Release Management (Application Level)](#release-management-application-level)
  - [Public Release Endpoints](#public-release-endpoints)
  - [Dashboard Access](#dashboard-access)
- [Database Architecture](#database-architecture)
- [Keycloak Integration](#keycloak-integration)
- [Development Environment](#development-environment)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Database Migrations](#database-migrations)
  - [Running the Server](#running-the-server)
  - [Services Started](#services-started)
  - [Development Workflow](#development-workflow)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Airborne Server acts as the central nervous system for delivering updates to applications. It handles the complexities of storing package assets (via AWS S3), managing configurations (via Superposition and its internal database), and authenticating/authorizing users (via Keycloak). This allows development teams to focus on building features while relying on a stable platform for update distribution.

**Related Systems:**

- **[Airborne Analytics Server](../airborne_analytics_server/README.md)**: A companion analytics platform that provides comprehensive OTA update insights, tracking adoption rates, failure analysis, and performance metrics across your applications.

## API Reference

All API endpoints are versioned and adhere to RESTful principles. Authentication is primarily handled through JWT Bearer tokens issued by Keycloak. Specific permissions are required for various operations, as detailed below.
The base path for all API routes is implicitly defined by the Actix web server configuration in `main.rs`.

### Authentication

Authentication is managed via Keycloak. Most endpoints require a valid JWT Bearer token.

### User Management

Base Path: `/users` (for creation/login), `/user` (for fetching authenticated user details)

- **`POST /users/create`**: Registers a new user.
  - **Request Body**: `application/json` - `{ "name": "username", "password": "userpassword" }`
  - **Response**: `application/json` - User details including a JWT token.
- **`POST /users/login`**: Authenticates an existing user.
  - **Request Body**: `application/json` - `{ "name": "username", "password": "userpassword" }`
  - **Response**: `application/json` - User details including a JWT token.
- **`GET /user`**: Retrieves details for the currently authenticated user, including their organizational affiliations.
  - **Authentication**: Required.
  - **Response**: `application/json` - User profile and organization data.

### Organization Management

Base Path: `/organisations`

- **`POST /organisations/create`**: Establishes a new organization.
  - **Authentication**: Required.
  - **Request Body**: `application/json` - `{ "name": "organisation_name" }`
  - **Response**: `application/json` - Details of the newly created organization.
- **`DELETE /organisations/{org_name}`**: Removes an existing organization.
  - **Authentication**: Required (Owner/Admin permissions for the organization).
  - **Path Parameter**: `org_name` (string) - The name of the organization to delete.
  - **Response**: `application/json` - Success confirmation.
- **`GET /organisations`**: Lists all organizations accessible to the authenticated user.
  - **Authentication**: Required.
  - **Response**: `application/json` - Array of organization objects.

#### Organization User Management

Base Path: `/organisation/user` (Operations are scoped to the organization context derived from the user's token)

- **`POST /organisation/user/create`**: Adds a user to the current organization with a specified access role.
  - **Authentication**: Required (Write permissions for the organization).
  - **Request Body**: `application/json` - `{ "user": "username", "access": "read|write|admin|owner" }`
  - **Response**: `application/json` - Success confirmation.
- **`POST /organisation/user/update`**: Modifies a user's access role within the current organization.
  - **Authentication**: Required (Admin permissions for the organization).
  - **Request Body**: `application/json` - `{ "user": "username", "access": "read|write|admin|owner" }`
  - **Response**: `application/json` - Success confirmation.
- **`POST /organisation/user/remove`**: Removes a user from the current organization.
  - **Authentication**: Required (Admin permissions for the organization).
  - **Request Body**: `application/json` - `{ "user": "username" }`
  - **Response**: `application/json` - Success confirmation.
- **`GET /organisation/user/list`**: Retrieves a list of all users within the current organization, including their roles.
  - **Authentication**: Required (Read permissions for the organization).
  - **Response**: `application/json` - Array of user information objects.

### Application Management

Base Path: `/organisations/applications` (Scoped to the organization context from the user's token)

- **`POST /organisations/applications/create`**: Creates a new application within the current organization.
  - **Authentication**: Required (Write permissions for the organization).
  - **Request Body**: `application/json` - `{ "application": "application_name" }`
  - **Response**: `application/json` - Details of the newly created application.

### Package Management

Base Path: `/organisations/applications/package` (Scoped to the organization and application context from the user's token)

- **`GET /organisations/applications/package`**: Lists all software packages for the current application.
  - **Authentication**: Required (Read permissions for the application).
  - **Response**: `application/json` - Array of package detail objects.
- **`POST /organisations/applications/package/create_json`**: Creates a new package version using a comprehensive JSON manifest.
  - **Authentication**: Required (Write permissions for the application).
  - **Request Body**: `application/json` - Detailed JSON structure defining package configuration and manifest.
  - **Response**: `application/json` - `{ "version": new_package_version }`.
- **`POST /organisations/applications/package/create_package_json_v1`**: Creates a new package version using a V1 JSON structure.
  - **Authentication**: Required (Write permissions for the application).
  - **Request Body**: `application/json` - JSON defining package information and associated resources.
  - **Response**: `application/json` - `{ "version": new_package_version }`.
- **`POST /organisations/applications/package/create_json_v1_multipart`**: Creates a new package version using a V1 JSON structure, supporting an optional index file upload via multipart/form-data.
  - **Authentication**: Required (Write permissions for the application).
  - **Request Body**: `multipart/form-data`
    - `json` (Text): JSON string containing package details.
    - `index` (File, Optional): The main index file for the package.
  - **Response**: `application/json` - `{ "version": new_package_version }`.

### Configuration Management

Base Path: `/organisations/applications/config` (Scoped to the organization and application context from the user's token)

- **`POST /organisations/applications/config/create_json_v1`**: Creates a new configuration associated with the latest package version.
  - **Authentication**: Required (Write permissions for the application).
  - **Request Body**: `application/json` - JSON defining configuration version, timeouts, and properties.
  - **Response**: `application/json` - `{ "version": package_version, "config_version": "config_version_string" }`.
- **`POST /organisations/applications/config/create_json_v1/multipart`**: Creates a new configuration via multipart/form-data (primarily for JSON payload).
  - **Authentication**: Required (Write permissions for the application).
  - **Request Body**: `multipart/form-data` - `json` (Text): JSON string for the configuration.
  - **Response**: `application/json` - `{ "version": package_version, "config_version": "config_version_string" }`.

### Release Management (Application Level)

Base Path: `/organisations/applications/release` (Scoped to the organization and application context from the user's token)

- **`POST /organisations/applications/release/create`**: Initiates a new release for an application, linking a package version with its configuration.
  - **Authentication**: Required (Write permissions for the application).
  - **Request Body**: `application/json` - `{ "version_id": "optional_package_version_id", "metadata": { ... } }` (If `version_id` is omitted, the latest package is used).
  - **Response**: `application/json` - Details of the created release.
- **`GET /organisations/applications/release/history`**: Retrieves the release history for the current application.
  - **Authentication**: Required (Read permissions for the application).
  - **Response**: `application/json` - Array of release history entries.

### Public Release Endpoints

Base Path: `/release` (These endpoints are typically public and consumed by client SDKs)

- **`GET /release/{organisation}/{application}`**: Serves the live release configuration for a specified organization and application. (Legacy endpoint)
  - **Response**: `application/json` - Combined release configuration, including package details and resources.
- **`GET /release/v2/{organisation}/{application}`**: Serves the V2 live release configuration. This version resolves the workspace name to fetch configuration from Superposition and defaults to the latest package if version "0" is specified in Superposition.
  - **Response**: `application/json` - Combined V2 release configuration.

### Dashboard Access

Base Path: `/dashboard`

- **`GET /dashboard/*`**: Serves static assets for the Airborne Server's administrative dashboard (React application).
  - Requests to paths under `/dashboard` will serve files from the `./dashboard_react/dist` directory, with `index.html` as the default fallback for client-side routing.

## Database Architecture

The server utilizes a PostgreSQL database, `airborneserver`, to persist its operational data. The schema is organized as follows:

1.  **`packages`**: Manages versions of application software packages.

    - **Purpose**: Stores metadata and asset information for each package version deployable via OTA updates.
    - **Key Columns**:
      - `id` (UUID, PK): Unique identifier.
      - `version` (Integer): Package version number, scoped to `app_id`.
      - `app_id` (Text): Foreign key to the application.
      - `org_id` (Text): Foreign key to the organization.
      - `index` (Text): Path/name of the package's main entry file (e.g., `index.jsa`).
      - `version_splits` (Boolean): Indicates if assets are stored in version-specific S3 paths.
      - `use_urls` (Boolean): Determines if `important`/`lazy` fields contain full URLs or relative paths.
      - `important` (JSONB): Array of critical file objects (`{ "url": "...", "filePath": "..." }`).
      - `lazy` (JSONB): Array of on-demand file objects (`{ "url": "...", "filePath": "..." }`).
      - `properties` (JSONB): Custom metadata (e.g., manifest, hashes).
      - `resources` (JSONB): Additional associated resources.

2.  **`configs`**: Stores configurations linked to specific package versions.

    - **Purpose**: Allows for versioned configurations that can be applied to different package releases.
    - **Key Columns**:
      - `id` (Integer, PK, Auto-increment): Unique identifier.
      - `org_id` (Text): Foreign key to the organization.
      - `app_id` (Text): Foreign key to the application.
      - `version` (Integer): Package version this configuration applies to.
      - `config_version` (Text): User-defined version string for this configuration content.
      - `release_config_timeout` (Integer): Timeout (ms) for fetching release configuration.
      - `package_timeout` (Integer): Timeout (ms) for downloading the package.
      - `tenant_info` (JSONB): Tenant-specific settings.
      - `properties` (JSONB): General configuration properties.
      - `created_at` (Timestamp): Creation timestamp.

3.  **`releases`**: Logs official software releases for applications.

    - **Purpose**: Tracks the history of deployed releases, linking packages and configurations.
    - **Key Columns**:
      - `id` (UUID, PK): Unique identifier.
      - `org_id` (Text): Foreign key to the organization.
      - `app_id` (Text): Foreign key to the application.
      - `package_version` (Integer): Version of the `packages` entry used.
      - `config_version` (Text): `config_version` from the `configs` entry used.
      - `created_at` (Timestamptz): Release creation timestamp.
      - `created_by` (Text): ID of the user who initiated the release.
      - `metadata` (JSONB): Custom metadata for the release.

4.  **`cleanup_outbox`**: Facilitates transactional consistency for distributed operations.

    - **Purpose**: Implements an outbox pattern to manage rollbacks or retries for operations spanning multiple services (Keycloak, Superposition, S3).
    - **Key Columns**:
      - `transaction_id` (Text, PK): Unique transaction identifier.
      - `entity_name` (Text): Identifier of the primary entity involved (e.g., org name).
      - `entity_type` (Text): Type of operation (e.g., "organisation_create").
      - `state` (JSONB): Stores information about created resources for potential rollback.
      - `created_at` (Timestamptz): Transaction initiation time.
      - `attempts` (Integer): Number of processing attempts.
      - `last_attempt` (Nullable Timestamptz): Timestamp of the last attempt.

5.  **`workspace_names`**: Ensures unique Superposition workspace names.
    - **Purpose**: Maps an internal auto-incrementing ID to an organization and a generated Superposition workspace name, preventing naming conflicts.
    - **Key Columns**:
      - `id` (Integer, PK, Auto-increment): Unique internal ID.
      - `organization_id` (Text): Associated organization ID.
      - `workspace_name` (Text): The unique workspace name (e.g., "workspace123").

## Keycloak Integration

Keycloak is integral to the Airborne Server's security and operational model. It serves the following critical functions:

- **Identity and Access Management (IAM)**: Provides robust user authentication (username/password) and manages user identities.
- **Token-Based Authentication**: Issues JSON Web Tokens (JWTs) upon successful login. These tokens are used as Bearer tokens to authenticate API requests to protected endpoints.
- **Authorization and Permissions**: Manages user roles and permissions through a group-based hierarchy. Organizations and applications are represented as groups in Keycloak, with sub-groups defining access levels (e.g., `owner`, `admin`, `write`, `read`).
- **Service Accounts**: Utilized for server-to-server communication between the Airborne Server and Keycloak for administrative tasks like user creation or group management, without requiring user credentials.

The server validates incoming JWTs, extracts user identity and associated permissions (derived from group memberships), and enforces access control rules for all protected resources and operations.

## Development Environment

### Prerequisites

To set up the development environment for the Airborne Server, you will need the following software installed:

**Option 1: Using Nix (Recommended)**

- **Nix with Flakes**: All dependencies automatically provided with `nix develop`
  - This provides: Rust toolchain, cargo-watch, diesel-cli, Node.js, Make, Docker/Podman Compose, PostgreSQL client tools, and all required system libraries

**Option 2: Manual Installation**

- **Required System Dependencies:**
  - Docker or Podman (Essential for running containerized services)
  - Git (For version control)
  - Make (GNU Make - Required for running Makefile commands)
  - Node.js 22+ (For frontend dashboard and docs builds)
  - PostgreSQL Client Tools (including `psql` and `pg_isready`)
  - curl (For health checks and API testing)
  - jq (JSON processor for parsing responses)
  - yq (YAML processor for parsing Docker Compose configurations)
- **Rust Development Dependencies:**
  - Rust Toolchain (cargo, rustc)
  - cargo-watch (for development hot-reloading): `cargo install cargo-watch`
  - diesel-cli (for database migrations): `cargo install diesel_cli --no-default-features --features postgres`
  - pkg-config (Required for building native dependencies)
- **Platform-Specific Dependencies:**
  - **macOS**: libiconv (usually provided by Xcode Command Line Tools)
  - **Linux**: libssl-dev, libpq-dev packages (Ubuntu/Debian) or equivalent for your distribution

### Environment Variables

The server relies on a set of environment variables for its configuration. These are typically managed in a `.env` file at the root of the `airborne_server/` directory. Critical variables include:

- `KEYCLOAK_URL`: URL of the Keycloak instance.
- `KEYCLOAK_CLIENT_ID`: Client ID for the Airborne Server in Keycloak.
- `KEYCLOAK_SECRET`: Client secret (typically KMS encrypted for production).
- `KEYCLOAK_REALM`: Keycloak realm name.
- `KEYCLOAK_PUBLIC_KEY`: Public key for validating JWTs issued by Keycloak.
- `SUPERPOSITION_URL`: URL of the Superposition service.
- `SUPERPOSITION_ORG_ID`: The organization ID within Superposition used by the server.
- `AWS_BUCKET`: Name of the S3 bucket for storing package assets.
- `PUBLIC_ENDPOINT`: The public-facing URL for accessing assets stored in S3.
- `DB_URL`: Connection string for the PostgreSQL database (typically KMS encrypted for production).
- AWS Credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`): For S3 and KMS access. `AWS_ENDPOINT_URL` may be needed for LocalStack.

Refer to the provided `.env.example` or existing setup scripts (`scripts/encrypt_env.sh`, `scripts/generate_env.sh`) for guidance on populating these variables.

### Database Migrations

Database schema changes are managed using Diesel CLI.

- **Applying Migrations**: To apply pending migrations, you can use either:

  - **Using Make (Recommended)**:

    ```bash
    make db-migration
    ```

    This command automatically loads environment variables from `.env` and constructs the appropriate database URL if not set.

  - **Using Diesel CLI directly**:
    ```bash
    diesel migration run --database-url <your_decrypted_postgresql_connection_string>
    ```

- **Automatic Migrations**: The server application is configured to attempt to run any pending migrations automatically upon startup.

### Running the Server

The Airborne Server uses a comprehensive Makefile located at the project root for orchestrating the setup and execution of all services. The Makefile provides various commands for different development and deployment scenarios.

1.  **Clone the Repository**:

    ```bash
    git clone <repository-url>
    cd airborne
    ```

2.  **Quick Start (Development Mode)**:

    ```bash
    # Start the Airborne server in development mode with hot-reloading
    make run

    # Or start the analytics server in development mode
    make run-analytics
    ```

3.  **Available Make Commands**:

    ```bash
    # See all available commands with descriptions
    make help
    ```

4.  **Development Modes**:

    ```bash
    # Start the complete Airborne server development environment
    make run

    # Start analytics server with Grafana + Victoria Metrics
    make run-analytics

    # Start analytics server with Kafka + ClickHouse (alternative)
    make run-kafka-clickhouse

    # Set up dependencies only
    make setup

    # Build the server without running
    make airborne-server

    # Check system status
    make status

    # Stop all services
    make stop

    # Clean up everything and start fresh
    make cleanup
    ```

### Services Started

**Services Started by `make run`:**

- **Backend API**: `http://localhost:8081`
- **Keycloak (Authentication)**: `http://localhost:8180` (Default admin: `admin/admin`)
- **PostgreSQL Database**: `localhost:5433`
- **LocalStack (AWS Mock)**: `http://localhost:4566`
- **Superposition**: `http://localhost:8080`

**Services Started by `make run-analytics`:**

- **Analytics Backend API**: `http://localhost:6400`
- **Grafana**: `http://localhost:4000`
- **Victoria Metrics**: `http://localhost:8428`

### Development Workflow

**Individual Service Management:**

```bash
# Database services
make db                     # Start PostgreSQL database
make db-migration          # Run database migrations

# Infrastructure services
make localstack            # Start LocalStack (AWS mock)
make superposition         # Start Superposition service
make keycloak-db           # Start Keycloak database
make keycloak              # Start Keycloak authentication

# Initialization (run after services are up)
make superposition-init    # Initialize Superposition organization
make keycloak-init         # Initialize Keycloak realm and client
make localstack-init       # Initialize LocalStack S3 buckets

# Frontend builds
make node-dependencies     # Install Node.js dependencies
make dashboard             # Build dashboard React app
make docs                  # Build docs React app

# Build servers
make airborne-server       # Build the Airborne server
make analytics-server      # Build the analytics server

# Code quality
make fmt                   # Format Rust code using rustfmt
make lint                  # Run Clippy linter on Rust code
make lint-fix              # Run Clippy with automatic fixes
make check                 # Run format check and linting (CI mode)

# Git integration
make commit                # Run quality checks and commit changes
make amend                 # Amend the last commit with quality checks
make amend-no-edit         # Amend the last commit without editing message

# Utility commands
make kill                  # Kill running airborne-server processes
make env-file              # Create .env file from .env.example
make status                # Show current system status
make test                  # Run test suite
```

**Complete Development Flow:**

1. **First-time setup:**

   ```bash
   make setup              # Sets up all dependencies
   ```

2. **Daily development:**

   ```bash
   make run                # Start everything with hot-reloading
   # Make your changes...
   make commit             # Format, lint, and commit
   ```

3. **Working with specific components:**

   ```bash
   make db                 # Start just the database
   make superposition      # Start just Superposition
   make airborne-server    # Build just the server
   ```

4. **Cleanup and restart:**
   ```bash
   make cleanup            # Clean up containers and volumes
   make run                # Fresh start
   ```
