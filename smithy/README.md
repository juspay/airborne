# Airborne OTA Smithy SDK

A Smithy-based API definition for the Airborne service - a comprehensive Over-The-Air (OTA) update management platform for mobile and web applications.

## Overview

Airborne is a service designed to manage OTA updates and configurations for applications. It provides a complete solution for:

- **Release Management**: Create and manage application releases with versioned configurations
- **Organization & Application Management**: Multi-tenant support with organization-based access control
- **File & Package Management**: Handle application assets, bundles, and resources
- **Dimension-based Targeting**: Deploy releases to specific user segments using configurable dimensions
- **Authentication & Access Control**: Secure API access with bearer token authentication

## API Operations

The Airborne service is organized into several functional domains:

### User Management

- `PostLogin` - Authenticate users and obtain access tokens
- `GetUser` - Retrieve user information and associated organizations

### Organization Management

- `CreateOrganisation` - Create a new organization
- `ListOrganisations` - List all organizations accessible to the user
- `RequestOrganisation` - Request access to an existing organization

### Application Management

- `CreateApplication` - Create a new application within an organization

### File Management

- `CreateFile` - Create file metadata
- `ListFiles` - List all files in an application
- `UploadFile` - Upload application files and assets

### Package Management

- `CreatePackage` - Create application packages with important and lazy-loaded files
- `ListPackages` - List all packages for an application

### Release Management

- `CreateRelease` - Create new releases with configurations and packages
- `ListReleases` - List releases with optional dimension filtering
- `GetRelease` - Retrieve specific release details
- `ServeRelease` / `ServeReleaseV2` - Serve release configurations to client applications

### Dimension Management

- `CreateDimension` - Create targeting dimensions for releases
- `ListDimensions` - List all available dimensions
- `UpdateDimension` - Modify existing dimensions
- `DeleteDimension` - Remove dimensions

## Generated SDK

This project generates a TypeScript client SDK:

- **Package Name**: `airborne-server-sdk`
- **Generator**: AWS TypeScript CodeGen v0.29.0

The SDK is automatically generated when building the Smithy models and provides type-safe client libraries for consuming the Airborne API.

## Project Structure

```
├── models/                    # Smithy model definitions
│   ├── main.smithy           # Main service definition and operation list
│   ├── application.smithy    # Application-related structures and operations
│   ├── user.smithy          # User authentication and management
│   ├── organisation.smithy  # Organization management structures
│   ├── release.smithy       # Release and configuration management
│   ├── package.smithy       # Package management structures
│   ├── file.smithy          # File handling structures
│   ├── dimension.smithy     # Dimension targeting structures
│   ├── errors.smithy        # Common error definitions
│   └── common.smithy        # Shared structures and types
├── smithy-build.json        # Build configuration
├── patches/                 # Code generation patches
└── output/                  # Generated code output
```

## Development Setup

### Prerequisites

- [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html) installed
- Java 11 or higher (required for Smithy CLI)
- Make (for using the provided Makefile commands)

### Building the Project

This project uses Make commands from the parent directory for build automation:

```console
# Clean previous build output
make smithy-clean

# Build Smithy models only
make smithy-build

# Clean and build in one command
make smithy-clean-build

# Build and generate client SDKs
make smithy-clients
```

#### Build Commands Explained

- **`make smithy-clean`**: Removes the `smithy/output` directory
- **`make smithy-build`**: Navigates to the smithy directory and runs `smithy build`
- **`make smithy-clean-build`**: Combines clean and build operations
- **`make smithy-clients`**:
  - Builds the Smithy models
  - Generates TypeScript client SDK in `airborne_server_clients/javascript/sdk`
  - Copies model files to `airborne_server_clients/model`
  - Generates additional client SDKs for other languages (if configured)
  - Applies patches from `smithy/patches/*.patch`

### Development Workflow

1. **Model Changes**: Edit `.smithy` files in the `models/` directory
2. **Build**: Run `make smithy-build` to validate models
3. **Generate Clients**: Run `make smithy-clients` to update SDKs
4. **Testing**: Use the generated SDK or examine output for correctness
5. **Iteration**: Repeat as needed

## Error Handling

The API defines standard error responses:

- **`Unauthorized`** (401) - Authentication required or invalid credentials
- **`ForbiddenError`** (403) - Insufficient permissions for the requested operation
- **`BadRequestError`** (400) - Invalid request parameters or format
- **`NotFoundError`** (404) - Requested resource not found
- **`InternalServerError`** (500) - Server-side processing error

## API Protocol

- **Protocol**: REST JSON (AWS restJson1)
- **Content Type**: `application/json`
- **Authentication**: HTTP Bearer tokens
- **Headers**: Custom headers like `x-organisation` and `x-application` for context

## Contributing

When modifying the API:

1. Update the appropriate `.smithy` files in the `models/` directory
2. Follow Smithy best practices for naming and structure
3. Ensure backward compatibility when possible
4. Run `make smithy-build` to validate changes
5. Test generated SDK functionality

For more information about Smithy development, see the [official Smithy documentation](https://smithy.io/).
