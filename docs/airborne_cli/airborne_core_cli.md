# Airborne Core CLI - Server Administration Tool

The Airborne Core CLI (npm package: `airborne-core-cli`) is a low-level command-line tool for direct interaction with the Airborne server API. Built from the backend SDK, it provides comprehensive access to all server operations.

**Note**: Most users should use [Airborne CLI](./airborne_cli.md) (`airborne-devkit`) instead, which wraps all Core CLI commands and adds automatic token management. Airborne Core CLI is recommended only for advanced scenarios requiring manual token control.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Workflows](#workflows)
- [Troubleshooting](#troubleshooting)

## Overview

The Airborne Core CLI provides low-level access to:

- ✅ Organization and application management
- ✅ File and package operations
- ✅ Release management and deployment
- ✅ Dimension-based configuration
- ✅ Local release serving for testing
- ✅ User and permission management

### Key Features

- **Comprehensive API Access**: Full coverage of Airborne server API
- **Scriptable**: Perfect for CI/CD pipelines and automation
- **Flexible Input**: Supports CLI options, JSON files, or mixed approach
- **Local Testing**: Serve releases locally for development

## Installation

### Install from npm

**NPM Package**: `airborne-core-cli`

```bash
# Install globally
npm install -g airborne-core-cli

# Or install locally in your project
npm install --save-dev airborne-core-cli

# Run
npx airborne-core-cli --help
```

## Quick Start

### 1. Configure Server Endpoint

```bash
npx airborne-core-cli configure --base-url https://your-airborne-server.com
```

### 2. Get Client Credentials

Obtain credentials from the Airborne website:

1. Navigate to [https://airborne.juspay.in](https://airborne.juspay.in)
2. Create an organization (if you don't have one)
3. Create an application within your organization
4. Inside the application, find the option to create a token
5. Generate the token to get your Client ID and Client Secret

### 3. Login

```bash
npx airborne-core-cli login \
  --client-id your_client_id \
  --client-secret your_client_secret
```

**Note**: This command prints the token to console. You must manually copy and provide it on every subsequent command.

### 4. Create Organization

```bash
npx airborne-core-cli CreateOrganisation \
  --name "MyCompany" \
  --token "your_token_from_login"
```

### 5. Create Application

```bash
npx airborne-core-cli CreateApplication \
  --organisation "MyCompany" \
  --application "MyApp" \
  --token "your_token_from_login"
```

## Commands

### Configuration

#### `configure`

Set the Airborne server base URL.

```bash
npx airborne-core-cli configure --base-url https://airborne.example.com
```

### Authentication

#### `login`

Authenticate with the Airborne server.

**Getting Credentials**:

1. Navigate to [https://airborne.juspay.in](https://airborne.juspay.in)
2. Create an organization (if you don't have one)
3. Create an application within your organization
4. Inside the application, find the option to create a token
5. Generate the token to get your Client ID and Client Secret

**Options**:

- `--client-id` - Client ID (required)
- `--client-secret` - Client secret (required)

```bash
npx airborne-core-cli login \
  --client-id your_client_id \
  --client-secret your_client_secret
```

**Output**: Prints the authentication token to console. Unlike Airborne CLI, this does NOT store the token automatically. You must manually copy and provide the token on every subsequent command.

---

### Organization Management

#### `CreateOrganisation`

Create a new organization.

**Parameters**:

- `--name` - Organization name (required)
- `--token` - Bearer token (required)

**Usage**:

1. **CLI Options**:

```bash
npx airborne-core-cli CreateOrganisation \
  --name "Acme Corp" \
  --token "your_token_here"
```

2. **JSON File**:

```bash
# params.json
{
  "name": "Acme Corp",
  "token": "your_token_here"
}

npx airborne-core-cli CreateOrganisation @params.json
```

3. **Mixed**:

```bash
npx airborne-core-cli CreateOrganisation @params.json --name "Different Name"
```

#### `ListOrganisations`

List all organizations.

```bash
npx airborne-core-cli ListOrganisations --token "your_token"
```

#### `RequestOrganisation`

Request access to an organization.

```bash
npx airborne-core-cli RequestOrganisation \
  --organisation "Acme Corp" \
  --token "your_token"
```

---

### Application Management

#### `CreateApplication`

Create a new application within an organization.

**Parameters**:

- `--application` - Application name (required)
- `--organisation` - Organization name (required)
- `--token` - Bearer token (required)

```bash
npx airborne-core-cli CreateApplication \
  --application "Mobile App" \
  --organisation "Acme Corp" \
  --token "your_token"
```

---

### Dimension Management

#### `CreateDimension`

Create a dimension for user segmentation.

**Parameters**:

- `--dimension` - Dimension name (required)
- `--description` - Description (required)
- `--dimension_type` - Type: `standard` or `cohort` (required)
- `--depends_on` - Parent dimension (for cohort type)
- `--organisation` - Organization name (required)
- `--application` - Application name (required)
- `--token` - Bearer token (required)

**Examples**:

```bash
# Standard dimension
npx airborne-core-cli CreateDimension \
  --dimension "userType" \
  --description "User subscription type" \
  --dimension_type "standard" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"

# Cohort dimension (depends on another dimension)
npx airborne-core-cli CreateDimension \
  --dimension "premiumFeatures" \
  --description "Premium user features" \
  --dimension_type "cohort" \
  --depends_on "userType" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `ListDimensions`

List all dimensions for an application.

```bash
npx airborne-core-cli ListDimensions \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `UpdateDimension`

Update an existing dimension.

```bash
npx airborne-core-cli UpdateDimension \
  --dimension "userType" \
  --description "Updated description" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `DeleteDimension`

Delete a dimension.

```bash
npx airborne-core-cli DeleteDimension \
  --dimension "userType" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

---

### File Management

#### `CreateFile`

Create a file record on the server.

**Parameters**:

- `--file_path` - Path where file will be stored on SDK (required)
- `--url` - Download URL for the file (required)
- `--tag` - Tag for identification (optional)
- `--metadata` - JSON metadata (optional)
- `--organisation` - Organization name (required)
- `--application` - Application name (required)
- `--token` - Bearer token (required)

**Examples**:

```bash
# Simple file
npx airborne-core-cli CreateFile \
  --file_path "index.android.bundle" \
  --url "https://cdn.example.com/bundles/index.android.bundle" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"

# With tag and metadata
npx airborne-core-cli CreateFile \
  --file_path "assets/logo.png" \
  --url "https://cdn.example.com/assets/logo.png" \
  --tag "v1.0.0" \
  --metadata '{"size": 12345, "type": "image/png"}' \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"

# Using JSON file
cat > file-params.json << EOF
{
  "file_path": "index.ios.bundle",
  "url": "https://cdn.example.com/bundles/index.ios.bundle",
  "tag": "v1.0.0",
  "organisation": "Acme Corp",
  "application": "Mobile App",
  "token": "your_token"
}
EOF

npx airborne-core-cli CreateFile @file-params.json
```

#### `UploadFile`

Upload a file directly to the Airborne server.

**Parameters**:

- `--file` - Path to local file (required)
- `--tag` - Tag for identification (optional)
- `--organisation` - Organization name (required)
- `--application` - Application name (required)
- `--token` - Bearer token (required)

```bash
npx airborne-core-cli UploadFile \
  --file ./build/index.android.bundle \
  --tag "v1.0.0" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `ListFiles`

List all files for an application.

```bash
npx airborne-core-cli ListFiles \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

---

### Package Management

#### `CreatePackage`

Create a package from file IDs.

**Parameters**:

- `--index` - Index file ID (required)
- `--files` - Space-separated file IDs (required)
- `--tag` - Package tag (optional)
- `--organisation` - Organization name (required)
- `--application` - Application name (required)
- `--token` - Bearer token (required)

```bash
npx airborne-core-cli CreatePackage \
  --index "file_abc123" \
  --files "file_abc123 file_def456 file_ghi789" \
  --tag "v1.0.0" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `ListPackages`

List all packages for an application.

```bash
npx airborne-core-cli ListPackages \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

---

### Release Management

#### `CreateRelease`

Create a release from a package.

**Parameters**:

- `--package` - Package ID (required)
- `--app_version` - Application version (required)
- `--lazy_packages` - Lazy package IDs (optional)
- `--boot_timeout_ms` - Boot timeout (optional)
- `--release_timeout_ms` - Release timeout (optional)
- `--organisation` - Organization name (required)
- `--application` - Application name (required)
- `--token` - Bearer token (required)

```bash
npx airborne-core-cli CreateRelease \
  --package "pkg_xyz123" \
  --app_version "1.0.0" \
  --boot_timeout_ms 30000 \
  --release_timeout_ms 60000 \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `GetRelease`

Get release details.

```bash
npx airborne-core-cli GetRelease \
  --release_id "rel_abc123" \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

#### `ListReleases`

List all releases for an application.

```bash
npx airborne-core-cli ListReleases \
  --organisation "Acme Corp" \
  --application "Mobile App" \
  --token "your_token"
```

---

### Local Testing

#### `ServeRelease`

Serve a release configuration locally for testing.

```bash
npx airborne-core-cli ServeRelease \
  --port 3000 \
  --config ./local-release-config.json
```

Access at: `http://localhost:3000`

#### `ServeReleaseV2`

Serve release with namespace and platform routing.

```bash
npx airborne-core-cli ServeReleaseV2 \
  --namespace "myapp" \
  --platform "android" \
  --port 3000 \
  --config ./release-config.json
```

Access at: `http://localhost:3000/release/myapp/android`

---

### User Management

#### `GetUser`

Get current user information.

```bash
npx airborne-core-cli GetUser --token "your_token"
```

---

## Configuration

### Server Configuration

The CLI stores server configuration in `.config` file:

```json
{
  "baseUrl": "https://airborne.example.com"
}
```

### Using JSON Files

All commands support JSON file input using `@file.json` syntax:

```bash
# Create params.json
cat > params.json << EOF
{
  "application": "MyApp",
  "organisation": "MyOrg",
  "token": "your_token"
}
EOF

# Use it
npx airborne-core-cli CreateApplication @params.json

# Override specific fields
npx airborne-core-cli CreateApplication @params.json --application "DifferentApp"
```

## Workflows

### Initial Setup Workflow

```bash
# 1. Configure server
npx airborne-core-cli configure --base-url https://airborne.example.com

# 2. Login
npx airborne-core-cli login \
  --client-id "$CLIENT_ID" \
  --client-secret "$CLIENT_SECRET"

# 3. Create organization
npx airborne-core-cli CreateOrganisation \
  --name "MyCompany" \
  --token "eyJhbGciOiJIUzI1N...."
# 4. Create application
npx airborne-core-cli CreateApplication \
  --organisation "MyCompany" \
  --application "MyApp" \
  --token "eyJhbGciOiJIUzI1N...."

# 5. Create dimensions
npx airborne-core-cli CreateDimension \
  --dimension "userType" \
  --description "User subscription type" \
  --dimension_type "standard" \
  --organisation "MyCompany" \
  --application "MyApp" \
  --token "eyJhbGciOiJIUzI1N...."
```

### Deployment Workflow

```bash
ORG="MyCompany"
APP="MyApp"

# 1. Upload files
FILE1=$(npx airborne-core-cli UploadFile \
  --file ./build/index.android.bundle \
  --organisation "$ORG" \
  --application "$APP" \
  --token "eyJhbGciOiJIUzI1N....")

FILE2=$(npx airborne-core-cli UploadFile \
  --file ./build/assets/logo.png \
  --organisation "$ORG" \
  --application "$APP" \
  --token "eyJhbGciOiJIUzI1N....")

# 2. Create package
PKG=$(npx airborne-core-cli CreatePackage \
  --index "$FILE1" \
  --files "$FILE1 $FILE2" \
  --tag "v1.0.0" \
  --organisation "$ORG" \
  --application "$APP" \
  --token "eyJhbGciOiJIUzI1N....")

# 3. Create release
npx airborne-core-cli CreateRelease \
  --package "$PKG" \
  --app_version "1.0.0" \
  --boot_timeout_ms 30000 \
  --release_timeout_ms 60000 \
  --organisation "$ORG" \
  --application "$APP" \
  --token "eyJhbGciOiJIUzI1N...."

echo "✓ Deployment complete"
```

### Testing Locally

```bash
# Create a test release config
cat > test-release.json << EOF
{
  "app_version": "1.0.0",
  "boot_timeout_ms": 30000,
  "release_timeout_ms": 60000,
  "packages": [
    {
      "index": {
        "file_path": "index.android.bundle",
        "url": "http://localhost:8000/index.android.bundle"
      },
      "files": []
    }
  ]
}
EOF

# Serve it locally
npx airborne-core-cli ServeReleaseV2 \
  --namespace "test-app" \
  --platform "android" \
  --port 3000 \
  --config ./test-release.json

# Point your app to http://localhost:3000/release/test-app/android
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy with Core CLI

on:
  push:
    tags:
      - "v*"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Download Airborne Core CLI
        run: |
          wget https://github.com/juspay/airborne/releases/download/v0.15.1/airborne-core-cli-linux-x64
          chmod +x airborne-core-cli-linux-x64
          sudo mv airborne-core-cli-linux-x64 /usr/local/bin/airborne-core-cli

      - name: Configure and Login
        env:
          CLIENT_ID: ${{ secrets.AIRBORNE_CLIENT_ID }}
          CLIENT_SECRET: ${{ secrets.AIRBORNE_CLIENT_SECRET }}
        run: |
          airborne-core-cli configure --base-url https://airborne.example.com
          airborne-core-cli login --client-id "$CLIENT_ID" --client-secret "$CLIENT_SECRET"

          npx airborne-core-cli configure --base-url https://airborne.example.com
          npx airborne-core-cli login --client-id "$CLIENT_ID" --client-secret "$CLIENT_SECRET"

      - name: Deploy
        run: |
          TOKEN="eyJhbGciOiJIUzI1N...."

          # Upload and create package (your deployment script here)
          ./scripts/deploy.sh "$TOKEN" "${{ github.ref_name }}"
```

## Troubleshooting

### Common Issues

1. **Command Not Found**

   ```bash
   # Ensure binary is in PATH
   which airborne-core-cli

   # Or use full path
   /usr/local/bin/airborne-core-cli --help

   # Or use npx
   npx airborne-core-cli --help
   ```

2. **Config Not Found**

   ```bash
   npx airborne-core-cli configure --base-url https://your-server.com
   ```

3. **Authentication Failed**

   ```bash
   # Re-login
   npx airborne-core-cli login --client-id "$CLIENT_ID" --client-secret "$CLIENT_SECRET"
   ```

4. **Token Expired**
   ```bash
   # Login again to refresh token
   npx airborne-core-cli login --client-id "$CLIENT_ID" --client-secret "$CLIENT_SECRET"
   ```

## Next Steps

- [Airborne CLI for React Native](./airborne_cli.md)
- [Server Setup Guide](../airborne_server/Setup.md)
- [SDK Documentation](../airborne_sdk/README.md)
- [API Documentation](../airborne_server/API.md)
