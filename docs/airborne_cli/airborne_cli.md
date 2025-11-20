# Airborne CLI - React Native Tool

The Airborne CLI is a command-line tool specifically designed for React Native developers to manage Over-The-Air (OTA) updates. It provides a user-friendly interface for creating, configuring, and deploying updates to your React Native applications.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Workflows](#workflows)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The Airborne CLI streamlines the OTA update process for React Native applications by:

- ✅ Initializing Airborne configuration in React Native projects
- ✅ Creating platform-specific release configurations (Android/iOS)
- ✅ Managing file uploads to the Airborne server
- ✅ Creating deployable packages
- ✅ Providing interactive prompts for easy configuration

### Key Features

- **React Native Focused**: Tailored for React Native bundle workflows
- **Interactive Mode**: Prompts guide you through configuration
- **Platform Aware**: Separate handling for Android and iOS
- **File Management**: Upload bundles and assets directly
- **Secure Authentication**: Client credentials-based login

## Installation

The CLI is located in the `airborne_cli/` directory of the Airborne repository.

### Prerequisites

- **Node.js**: 20+ required
- **npm** or **yarn**
- React Native project
- Access to an Airborne server

### Install Dependencies

```bash
cd airborne_cli
npm install
```

### Run the CLI

```bash
# From the airborne_cli directory
node src/index.js --help

# Or from your project directory
node /path/to/airborne_cli/src/index.js --help
```

### Create an Alias (Optional)

Add to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
alias airborne-cli="node /path/to/airborne_cli/src/index.js"
```

Then reload:
```bash
source ~/.zshrc
```

Usage:
```bash
airborne-cli --help
```

## Quick Start

### 1. Initialize Configuration

Navigate to your React Native project and initialize Airborne configuration:

```bash
cd my-react-native-app

# Interactive mode (recommended for first-time users)
node /path/to/airborne_cli/src/index.js create-local-airborne-config

# With options
node /path/to/airborne_cli/src/index.js create-local-airborne-config \
  -o "MyCompany" \
  -n "MyApp" \
  -j "index.js"
```

This creates `airborne-config.json` in your project root.

### 2. Create Release Configuration

Create platform-specific release configurations:

```bash
# For Android
node /path/to/airborne_cli/src/index.js create-local-release-config -p android

# For iOS
node /path/to/airborne_cli/src/index.js create-local-release-config -p ios
```

This creates `airborne-release-config-android.json` and `airborne-release-config-ios.json`.

### 3. Build Your React Native Bundle

```bash
# Android
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/build/generated/assets/react/release/index.android.bundle \
  --assets-dest android/app/build/generated/res/react/release

# iOS
npx react-native bundle --platform ios --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios
```

### 4. Authenticate with Airborne Server

```bash
node /path/to/airborne_cli/src/index.js login \
  --client_id YOUR_CLIENT_ID \
  --client_secret YOUR_CLIENT_SECRET
```

### 5. Upload Files and Create Package

```bash
# Upload files for Android
node /path/to/airborne_cli/src/index.js create-remote-files -p android --upload

# Create package for Android
node /path/to/airborne_cli/src/index.js create-remote-package -p android -t "v1.0.0"

# Repeat for iOS
node /path/to/airborne_cli/src/index.js create-remote-files -p ios --upload
node /path/to/airborne_cli/src/index.js create-remote-package -p ios -t "v1.0.0"
```

## Commands

### Configuration Commands

#### `create-local-airborne-config [directoryPath]`

Initialize Airborne configuration for a React Native project.

**Options**:
- `-o, --organisation <org>` - Organisation name
- `-n, --namespace <namespace>` - Application namespace/ID
- `-j, --js-entry-file <path>` - JavaScript entry file (default: `index.js`)
- `-a, --android-index-file <path>` - Android bundle output path
- `-i, --ios-index-file <path>` - iOS bundle output path

**Interactive Mode**:
```bash
node /path/to/airborne_cli/src/index.js create-local-airborne-config
```

You'll be prompted for:
1. Organisation name
2. Application namespace
3. JavaScript entry file path
4. Android bundle output path
5. iOS bundle output path

**With Options**:
```bash
node /path/to/airborne_cli/src/index.js create-local-airborne-config \
  -o "Acme Corp" \
  -n "acme-mobile-app" \
  -j "index.js" \
  -a "android/app/build/generated/assets/react/release/index.android.bundle" \
  -i "ios/main.jsbundle"
```

**Output**: Creates `airborne-config.json`:
```json
{
  "organisation": "Acme Corp",
  "namespace": "acme-mobile-app",
  "js_entry_file": "index.js",
  "android": {
    "index_file_path": "android/app/build/generated/assets/react/release/index.android.bundle"
  },
  "ios": {
    "index_file_path": "ios/main.jsbundle"
  }
}
```

---

#### `create-local-release-config [directoryPath]`

Create platform-specific release configuration files.

**Options**:
- `-p, --platform <platform>` - Target platform: `android` or `ios` (required)
- `-b, --boot-timeout <ms>` - Boot timeout in milliseconds (default: 30000)
- `-r, --release-timeout <ms>` - Release timeout in milliseconds (default: 60000)

**Examples**:

```bash
# Interactive mode for Android
node /path/to/airborne_cli/src/index.js create-local-release-config -p android

# iOS with custom timeouts
node /path/to/airborne_cli/src/index.js create-local-release-config \
  -p ios \
  -b 40000 \
  -r 90000

# Create configs for both platforms
node /path/to/airborne_cli/src/index.js create-local-release-config -p android
node /path/to/airborne_cli/src/index.js create-local-release-config -p ios
```

**Output**: Creates `airborne-release-config-<platform>.json`:

```json
{
  "boot_timeout_ms": 30000,
  "release_timeout_ms": 60000,
  "index_file_path": "index.android.bundle",
  "files": []
}
```

---

#### `update-local-release-config [directoryPath]`

Update an existing release configuration file.

**Options**:
- `-p, --platform <platform>` - Target platform: `android` or `ios` (required)
- `-b, --boot-timeout <ms>` - New boot timeout in milliseconds
- `-r, --release-timeout <ms>` - New release timeout in milliseconds

**Examples**:

```bash
# Update Android timeouts
node /path/to/airborne_cli/src/index.js update-local-release-config \
  -p android \
  -b 40000 \
  -r 80000

# Update only boot timeout for iOS
node /path/to/airborne_cli/src/index.js update-local-release-config \
  -p ios \
  -b 35000
```

---

### Authentication

#### `login [directoryPath]`

Authenticate with the Airborne server using client credentials.

**Options**:
- `--client_id <clientId>` - Client ID (required)
- `--client_secret <clientSecret>` - Client secret (required)

**Examples**:

```bash
# Basic login
node /path/to/airborne_cli/src/index.js login \
  --client_id your_client_id \
  --client_secret your_client_secret

# Using environment variables
node /path/to/airborne_cli/src/index.js login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"
```

**Output**:
- Saves authentication token to `.airborne/` directory in your project
- Token is used for subsequent remote operations

**Security Note**: 
- Never commit `.airborne/` to version control
- Add to `.gitignore`:
  ```gitignore
  .airborne/
  ```

---

### Remote Operations

#### `create-remote-files [directoryPath]`

Process local files and create file records on the Airborne server.

**Options**:
- `-p, --platform <platform>` - Target platform: `android` or `ios` (required)
- `-t, --tag <tag>` - Tag for file identification (optional)
- `-u, --upload` - Upload files directly to Airborne server (optional)

**Mode 1: External URLs** (without `--upload`):
Creates file records that reference external URLs. You must host files yourself.

```bash
node /path/to/airborne_cli/src/index.js create-remote-files -p android
```

**Mode 2: Upload to Airborne** (with `--upload`):
Uploads files directly to the Airborne server.

```bash
node /path/to/airborne_cli/src/index.js create-remote-files -p android --upload -t "v1.2.0"
```

**With Tag**:
```bash
node /path/to/airborne_cli/src/index.js create-remote-files \
  -p ios \
  --upload \
  -t "release-2024-01"
```

**What it does**:
1. Reads `airborne-release-config-<platform>.json`
2. For each file in the config:
   - If `--upload`: Uploads file to Airborne server
   - If not `--upload`: Creates file record with external URL
3. Updates the release config with file IDs
4. Saves updated config back to disk

**Output**:
```
Creating file records for Android...
✓ Uploaded index.android.bundle -> file_abc123
✓ Uploaded assets/logo.png -> file_def456
✓ Uploaded assets/icon.png -> file_ghi789

3 files processed successfully
Updated airborne-release-config-android.json with file IDs
```

---

#### `create-remote-package [directoryPath]`

Create a deployable package from local release configuration.

**Options**:
- `-p, --platform <platform>` - Target platform: `android` or `ios` (required)
- `-t, --tag <tag>` - Package tag for identification (optional)

**Examples**:

```bash
# Create package for Android
node /path/to/airborne_cli/src/index.js create-remote-package -p android

# Create package with version tag
node /path/to/airborne_cli/src/index.js create-remote-package \
  -p ios \
  -t "v2.1.0"

# Create package with custom tag
node /path/to/airborne_cli/src/index.js create-remote-package \
  -p android \
  -t "production-release-$(date +%Y%m%d)"
```

**Prerequisites**:
- Files must already be created via `create-remote-files`
- `airborne-release-config-<platform>.json` must contain file IDs

**What it does**:
1. Reads `airborne-release-config-<platform>.json`
2. Extracts file IDs and index file ID
3. Creates a package on the Airborne server
4. Returns package ID and details

**Output**:
```
Creating package for Android...
✓ Package created successfully
Package ID: pkg_xyz123
Tag: v2.1.0
Files: 3
Index: file_abc123
```

---

## Configuration

### Project Structure

After running the CLI commands, your React Native project will have:

```
my-react-native-app/
├── airborne-config.json                    # Main Airborne configuration
├── airborne-release-config-android.json    # Android release config
├── airborne-release-config-ios.json        # iOS release config
├── .airborne/                              # Authentication tokens (DO NOT COMMIT)
│   └── token.json
├── android/
│   └── app/
│       └── build/
│           └── generated/
│               └── assets/
│                   └── react/
│                       └── release/
│                           └── index.android.bundle
├── ios/
│   └── main.jsbundle
└── package.json
```

### Configuration Files

#### `airborne-config.json`

Main configuration file for your Airborne setup:

```json
{
  "organisation": "MyCompany",
  "namespace": "myapp-production",
  "js_entry_file": "index.js",
  "android": {
    "index_file_path": "android/app/build/generated/assets/react/release/index.android.bundle"
  },
  "ios": {
    "index_file_path": "ios/main.jsbundle"
  }
}
```

**Fields**:
- `organisation`: Your company or organization name
- `namespace`: Unique identifier for your app (use environment-specific names)
- `js_entry_file`: Entry point for your React Native app
- `android.index_file_path`: Path to the Android bundle
- `ios.index_file_path`: Path to the iOS bundle

#### `airborne-release-config-<platform>.json`

Platform-specific release configuration:

```json
{
  "boot_timeout_ms": 30000,
  "release_timeout_ms": 60000,
  "index_file_path": "index.android.bundle",
  "files": [
    {
      "file_path": "index.android.bundle",
      "url": "https://cdn.example.com/bundles/index.android.bundle",
      "file_id": "file_abc123"
    },
    {
      "file_path": "assets/logo.png",
      "url": "https://cdn.example.com/assets/logo.png",
      "file_id": "file_def456"
    }
  ]
}
```

**Fields**:
- `boot_timeout_ms`: Maximum time (ms) for app boot
- `release_timeout_ms`: Maximum time (ms) for release download
- `index_file_path`: Relative path to the index bundle
- `files`: Array of file objects with:
  - `file_path`: Relative path in the OTA bundle
  - `url`: Download URL (if using external hosting)
  - `file_id`: Server-assigned file ID (after upload)

### Environment-Specific Namespaces

Use different namespaces for different environments:

```json
// Production
{
  "namespace": "myapp-production"
}

// Staging
{
  "namespace": "myapp-staging"
}

// Development
{
  "namespace": "myapp-development"
}
```

## Workflows

### Complete Deployment Workflow

#### Step 1: Initial Setup (One Time)

```bash
cd my-react-native-app

# Initialize configuration
node /path/to/airborne_cli/src/index.js create-local-airborne-config \
  -o "MyCompany" \
  -n "myapp-production"

# Create release configs
node /path/to/airborne_cli/src/index.js create-local-release-config -p android
node /path/to/airborne_cli/src/index.js create-local-release-config -p ios

# Add .airborne to .gitignore
echo ".airborne/" >> .gitignore
```

#### Step 2: Build and Deploy

```bash
# 1. Build React Native bundles
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/build/generated/assets/react/release/index.android.bundle \
  --assets-dest android/app/build/generated/res/react/release

npx react-native bundle --platform ios --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios

# 2. Login to Airborne
node /path/to/airborne_cli/src/index.js login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"

# 3. Upload files
node /path/to/airborne_cli/src/index.js create-remote-files -p android --upload -t "v1.0.0"
node /path/to/airborne_cli/src/index.js create-remote-files -p ios --upload -t "v1.0.0"

# 4. Create packages
node /path/to/airborne_cli/src/index.js create-remote-package -p android -t "v1.0.0"
node /path/to/airborne_cli/src/index.js create-remote-package -p ios -t "v1.0.0"
```

### Hotfix Workflow

```bash
# 1. Make your code changes
# ... edit your React Native code ...

# 2. Build new bundles
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/build/generated/assets/react/release/index.android.bundle

# 3. Login (if needed)
node /path/to/airborne_cli/src/index.js login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"

# 4. Upload and deploy
node /path/to/airborne_cli/src/index.js create-remote-files -p android --upload -t "v1.0.1-hotfix"
node /path/to/airborne_cli/src/index.js create-remote-package -p android -t "v1.0.1-hotfix"
```

### Multi-Environment Workflow

```bash
# Production
node /path/to/airborne_cli/src/index.js create-local-airborne-config \
  -n "myapp-production"

# Staging
node /path/to/airborne_cli/src/index.js create-local-airborne-config \
  -n "myapp-staging"

# Use different config files
cp airborne-config.json airborne-config.production.json
cp airborne-config.json airborne-config.staging.json

# Edit namespace in each file
# Then symlink the one you want to use
ln -sf airborne-config.production.json airborne-config.json
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy OTA Update

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build Android bundle
        run: |
          npx react-native bundle --platform android --dev false \
            --entry-file index.js \
            --bundle-output android/app/build/generated/assets/react/release/index.android.bundle \
            --assets-dest android/app/build/generated/res/react/release
      
      - name: Deploy to Airborne
        env:
          CLIENT_ID: ${{ secrets.AIRBORNE_CLIENT_ID }}
          CLIENT_SECRET: ${{ secrets.AIRBORNE_CLIENT_SECRET }}
        run: |
          cd airborne_cli
          npm install
          node src/index.js login --client_id "$CLIENT_ID" --client_secret "$CLIENT_SECRET"
          node src/index.js create-remote-files -p android --upload -t "${{ github.ref_name }}"
          node src/index.js create-remote-package -p android -t "${{ github.ref_name }}"
      
  deploy-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build iOS bundle
        run: |
          npx react-native bundle --platform ios --dev false \
            --entry-file index.js \
            --bundle-output ios/main.jsbundle \
            --assets-dest ios
      
      - name: Deploy to Airborne
        env:
          CLIENT_ID: ${{ secrets.AIRBORNE_CLIENT_ID }}
          CLIENT_SECRET: ${{ secrets.AIRBORNE_CLIENT_SECRET }}
        run: |
          cd airborne_cli
          npm install
          node src/index.js login --client_id "$CLIENT_ID" --client_secret "$CLIENT_SECRET"
          node src/index.js create-remote-files -p ios --upload -t "${{ github.ref_name }}"
          node src/index.js create-remote-package -p ios -t "${{ github.ref_name }}"
```

### GitLab CI

```yaml
stages:
  - build
  - deploy

build:android:
  stage: build
  image: node:20
  script:
    - npm install
    - npx react-native bundle --platform android --dev false
        --entry-file index.js
        --bundle-output android/app/build/generated/assets/react/release/index.android.bundle
  artifacts:
    paths:
      - android/app/build/generated/assets/react/release/
    expire_in: 1 hour

deploy:android:
  stage: deploy
  image: node:20
  dependencies:
    - build:android
  only:
    - tags
  script:
    - cd airborne_cli && npm install
    - node src/index.js login --client_id "$AIRBORNE_CLIENT_ID" --client_secret "$AIRBORNE_CLIENT_SECRET"
    - node src/index.js create-remote-files -p android --upload -t "$CI_COMMIT_TAG"
    - node src/index.js create-remote-package -p android -t "$CI_COMMIT_TAG"
  variables:
    AIRBORNE_CLIENT_ID: $AIRBORNE_CLIENT_ID
    AIRBORNE_CLIENT_SECRET: $AIRBORNE_CLIENT_SECRET
```

### Shell Script for Local Deployment

```bash
#!/bin/bash
# deploy-ota.sh

set -e

PLATFORM=${1:-android}
VERSION=${2:-$(git describe --tags --abbrev=0)}

echo "Building $PLATFORM bundle..."

if [ "$PLATFORM" == "android" ]; then
  npx react-native bundle --platform android --dev false \
    --entry-file index.js \
    --bundle-output android/app/build/generated/assets/react/release/index.android.bundle \
    --assets-dest android/app/build/generated/res/react/release
elif [ "$PLATFORM" == "ios" ]; then
  npx react-native bundle --platform ios --dev false \
    --entry-file index.js \
    --bundle-output ios/main.jsbundle \
    --assets-dest ios
else
  echo "Invalid platform: $PLATFORM"
  exit 1
fi

echo "Deploying to Airborne..."

cd airborne_cli
npm install

node src/index.js login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"

node src/index.js create-remote-files -p "$PLATFORM" --upload -t "$VERSION"
node src/index.js create-remote-package -p "$PLATFORM" -t "$VERSION"

echo "✓ Deployment complete: $PLATFORM $VERSION"
```

Usage:
```bash
chmod +x deploy-ota.sh

# Deploy Android
./deploy-ota.sh android v1.2.0

# Deploy iOS
./deploy-ota.sh ios v1.2.0
```

## Troubleshooting

### Common Issues

#### 1. Config File Already Exists

**Error**: `Airborne config already exists at ...`

**Solution**:
- Use `update-local-release-config` to modify existing configs
- Or delete the existing config and recreate:
  ```bash
  rm airborne-config.json
  node /path/to/airborne_cli/src/index.js create-local-airborne-config
  ```

#### 2. Authentication Failed

**Error**: `Authentication failed` or `401 Unauthorized`

**Solution**:
```bash
# Verify credentials are correct
echo $AIRBORNE_CLIENT_ID
echo $AIRBORNE_CLIENT_SECRET

# Try logging in again
node /path/to/airborne_cli/src/index.js login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"

# Check token file was created
ls -la .airborne/
```

#### 3. File Not Found

**Error**: `File not found: index.android.bundle`

**Solution**:
- Ensure you've built the bundle before uploading
- Check the path in `airborne-config.json` matches the actual file location
- Run the build command:
  ```bash
  npx react-native bundle --platform android --dev false \
    --entry-file index.js \
    --bundle-output android/app/build/generated/assets/react/release/index.android.bundle
  ```

#### 4. Invalid Platform

**Error**: `Platform must be 'android' or 'ios'`

**Solution**:
- Ensure platform is lowercase: `-p android` not `-p Android`
- Use exact strings: `android` or `ios`

#### 5. Missing Dependencies

**Error**: `Cannot find module 'airborne-core-cli'`

**Solution**:
```bash
cd airborne_cli
npm install
```

#### 6. Network Errors

**Error**: `ECONNREFUSED` or `Network error`

**Solution**:
- Check server URL is correct
- Verify server is running and accessible
- Test with curl:
  ```bash
  curl https://your-airborne-server.com/health
  ```
- Check firewall/proxy settings

### Debug Mode

Enable verbose logging:

```bash
export DEBUG=airborne:*
node /path/to/airborne_cli/src/index.js <command>
```

### Getting Help

```bash
# General help
node /path/to/airborne_cli/src/index.js --help

# Command-specific help
node /path/to/airborne_cli/src/index.js create-local-airborne-config --help
node /path/to/airborne_cli/src/index.js create-remote-files --help
```

## Best Practices

1. **Version Control**:
   - Commit `airborne-config.json` and `airborne-release-config-*.json`
   - Do NOT commit `.airborne/` directory
   - Add to `.gitignore`:
     ```gitignore
     .airborne/
     ```

2. **Tagging**:
   - Use semantic versioning for tags: `v1.2.3`
   - Include environment in tag for clarity: `v1.2.3-production`
   - Tag hotfixes appropriately: `v1.2.4-hotfix`

3. **Environment Separation**:
   - Use different namespaces for each environment
   - Keep separate config files per environment
   - Never deploy staging updates to production namespace

4. **Security**:
   - Store credentials in environment variables or secrets manager
   - Rotate client secrets regularly
   - Use CI/CD secrets for automation

5. **Testing**:
   - Test updates in staging environment first
   - Verify bundle loads correctly before deploying to production
   - Keep rollback plan ready

## Next Steps

- [Set up Airborne Server](../airborne_server/Setup.md)
- [Integrate SDKs](../airborne_sdk/README.md)
- [Use Airborne Core CLI](./airborne_core_cli.md) for advanced operations
- [Read API Documentation](../airborne_server/API.md)
