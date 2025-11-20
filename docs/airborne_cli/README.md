# Airborne CLI Documentation

Welcome to the Airborne CLI tools documentation. Airborne provides two CLI tools for managing OTA updates:

## CLI Tools Overview

### [Airborne CLI](./airborne_cli.md)

**React Native specific CLI** (npm package: `airborne-devkit`) - a wrapper around Airborne Core CLI that orchestrates commands specifically for React Native applications. **Note: This CLI only works with React Native applications.**

**Key Features**:

- Wraps all Airborne Core CLI commands with React Native-specific workflows
- Initialize Airborne configuration for React Native projects
- Create release configurations for Android and iOS
- Upload files and create packages
- Manage local and remote configurations
- Interactive prompts for easy setup
- **Token management**: Automatically stores and reuses authentication tokens (no need to provide token on every command)

**Best For**: React Native developers deploying OTA updates

**NPM Package**: `airborne-devkit`

### [Airborne Core CLI](./airborne_core_cli.md)

**Low-level CLI** (npm package: `airborne-core-cli`) for direct interaction with the Airborne server API.

**Key Features**:

- Comprehensive server API access
- Organization and application management
- File and package operations
- Release management
- Dimension-based configuration
- Serve releases locally for testing
- **Token handling**: Login command prints the token output instead of storing it - requires manual token management

**Best For**: Advanced use cases where you need direct API control, or as a base that Airborne CLI wraps around

**NPM Package**: `airborne-core-cli`

**Note**: Since Airborne CLI wraps all Airborne Core CLI commands and adds automatic token management, most users (including server administrators and DevOps teams) should prefer using Airborne CLI for non-React Native applications as well.

## Quick Comparison

| Feature                     | Airborne CLI (`airborne-devkit`)     | Airborne Core CLI (`airborne-core-cli`)            |
| --------------------------- | ------------------------------------ | -------------------------------------------------- |
| **NPM Package**             | `airborne-devkit`                    | `airborne-core-cli`                                |
| **Relationship**            | Wrapper around Airborne Core CLI     | Standalone low-level CLI                           |
| **Commands**                | All Core CLI commands + RN workflows | Base commands only                                 |
| **Target Users**            | Most users (RN & non-RN)             | Advanced users needing direct API control          |
| **Application Support**     | React Native only                    | Any application                                    |
| **Complexity**              | User-friendly, interactive           | Powerful, scriptable                               |
| **Focus**                   | React Native workflows               | Server API operations                              |
| **Token Management**        | Automatic (stores & reuses)          | Manual (login prints token, not stored)            |
| **Configuration**           | React Native projects                | Any application                                    |
| **File Handling**           | Bundle-focused                       | Generic file management                            |
| **Release Management**      | Simplified                           | Full control                                       |
| **Organization Management** | Yes (via wrapped commands)           | Yes                                                |
| **Dimension Management**    | Yes (via wrapped commands)           | Yes                                                |
| **Local Testing**           | Yes (via wrapped commands)           | Yes (serve releases)                               |
| **Recommended For**         | ✅ Most use cases                    | Advanced scenarios requiring manual token handling |

## Getting Started

### For React Native Developers

Start with **[Airborne CLI](./airborne_cli.md)**:

```bash
# Install from npm
npm install -g airborne-devkit
# or use npx (no installation needed)

# Navigate to your React Native project
cd my-react-native-app

# Initialize configuration
npx airborne-devkit create-local-airborne-config

# Create release config (choose platform)
npx airborne-devkit create-local-release-config -p android
# OR
npx airborne-devkit create-local-release-config -p ios

# Configure base URL
npx airborne-devkit configure --base-url https://airborne.juspay.in

# Deploy (choose platform)
npx airborne-devkit login --client_id YOUR_ID --client_secret YOUR_SECRET

# For Android
npx airborne-devkit create-remote-files -p android --upload
npx airborne-devkit create-remote-package -p android

# OR for iOS
npx airborne-devkit create-remote-files -p ios --upload
npx airborne-devkit create-remote-package -p ios
```

### For Server Administrators

Start with **[Airborne Core CLI](./airborne_core_cli.md)**:

```bash
# Install from npm
npm install -g airborne-core-cli
# or use npx (no installation needed)

# Configure server endpoint
npx airborne-core-cli configure --base-url https://your-server.com

# Login
npx airborne-core-cli login --client-id YOUR_ID --client-secret YOUR_SECRET

# Create organization
npx airborne-core-cli CreateOrganisation --name "MyOrg" --token "your_token"

# Create application
npx airborne-core-cli CreateApplication --organisation "MyOrg" --application "MyApp" --token "your_token"

# Upload and create package
npx airborne-core-cli UploadFile --file ./bundle.js --tag v1.0.0 --organisation "MyOrg" --application "MyApp" --token "your_token"
npx airborne-core-cli CreatePackage --index "file_id" --files "file_id" --tag v1.0.0 --organisation "MyOrg" --application "MyApp" --token "your_token"
```

## Installation

### Airborne CLI (React Native)

**NPM Package**: `airborne-devkit`

```bash
# Install globally
npm install -g airborne-devkit

# Or install locally in your project
npm install --save-dev airborne-devkit

# Run with npx (no installation needed)
npx airborne-devkit --help
```

### Airborne Core CLI

**NPM Package**: `airborne-core-cli`

```bash
# Install globally
npm install -g airborne-core-cli

# Or install locally in your project
npm install --save-dev airborne-core-cli

# Run with npx (no installation needed)
npx airborne-core-cli --help
```

## Common Workflows

### Deploying a React Native Update

```bash
# 1. Build your React Native bundle
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/build/generated/assets/react/release/index.android.bundle

# 2. Create/update release config
npx airborne-devkit create-local-release-config -p android

# 3. Configure base URL (one-time setup)
npx airborne-devkit configure --base-url https://airborne.juspay.in

# 4. Authenticate
npx airborne-devkit login --client_id $CLIENT_ID --client_secret $CLIENT_SECRET

# 5. Upload files
npx airborne-devkit create-remote-files -p android --upload -t "v1.2.0"

# 6. Create package
npx airborne-devkit create-remote-package -p android -t "v1.2.0"
```

### Setting Up a New Organization

```bash
# 1. Configure endpoint
npx airborne-core-cli configure --base-url https://airborne.example.com

# 2. Login
npx airborne-core-cli login --client-id $CLIENT_ID --client-secret $CLIENT_SECRET

# 3. Create organization
npx airborne-core-cli CreateOrganisation --name "MyCompany" --token "your_token"

# 4. Create application
npx airborne-core-cli CreateApplication \
  --organisation "MyCompany" \
  --application "MyApp" \
  --token "your_token"

# 5. Create dimensions
npx airborne-core-cli CreateDimension \
  --dimension "userType" \
  --description "User subscription type" \
  --dimension_type "standard" \
  --organisation "MyCompany" \
  --application "MyApp" \
  --token "your_token"
```

### Testing Releases Locally

```bash
# Using Airborne Core CLI to serve releases locally

# 1. Create a local release configuration
npx airborne-core-cli ServeReleaseV2 \
  --namespace myapp \
  --platform android \
  --port 3000 \
  --config ./local-release-config.json

# 2. Point your app to http://localhost:3000/release/myapp/android

# 3. Test the update flow without deploying to production
```

## Authentication

Both CLIs use client credentials for authentication, but handle tokens differently:

### Getting Client Credentials

Obtain client credentials from the Airborne website:

1. Navigate to [https://airborne.juspay.in](https://airborne.juspay.in)
2. Create an organization (if you don't have one)
3. Create an application within your organization
4. Inside the application, you will find an option to create a token
5. Generate the token to get your Client ID and Client Secret

### Login Command

**Airborne CLI** (`airborne-devkit`):

```bash
npx airborne-devkit login \
  --client_id your_client_id \
  --client_secret your_client_secret
```

**Airborne Core CLI**:

```bash
npx airborne-core-cli login \
  --client-id your_client_id \
  --client-secret your_client_secret
```

### Token Management - Key Difference

**Airborne CLI (`airborne-devkit`)**:

- **Automatic token management**: Stores authentication tokens locally and reuses them
- You only need to login once, subsequent commands automatically use the stored token
- Token stored in `.airborne/` directory in your project
- No need to provide token on every command

**Airborne Core CLI**:

- **Manual token handling**: Login command prints the token to console instead of storing it
- Does NOT store tokens automatically
- You must manually copy and provide the token on every command
- Suitable only for advanced scenarios where manual token control is required

**Security Note**: Never commit token files to version control. Add to `.gitignore`:

```gitignore
.airborne/
.config
```

## Environment Variables

Set credentials via environment variables for CI/CD:

```bash
export AIRBORNE_CLIENT_ID="your_client_id"
export AIRBORNE_CLIENT_SECRET="your_client_secret"
export AIRBORNE_SERVER_URL="https://airborne.example.com"

# Use in commands
npx airborne-devkit login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy OTA Update

on:
  push:
    tags:
      - "v*"

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install

      - name: Build React Native bundle
        run: |
          npx react-native bundle --platform android --dev false \
            --entry-file index.js \
            --bundle-output android/app/build/generated/assets/react/release/index.android.bundle

      - name: Deploy to Airborne
        env:
          CLIENT_ID: ${{ secrets.AIRBORNE_CLIENT_ID }}
          CLIENT_SECRET: ${{ secrets.AIRBORNE_CLIENT_SECRET }}
        run: |
          npx airborne-devkit configure --base-url https://airborne.juspay.in
          npx airborne-devkit login --client_id "$CLIENT_ID" --client_secret "$CLIENT_SECRET"
          npx airborne-devkit create-remote-files -p android --upload -t "${{ github.ref_name }}"
          npx airborne-devkit create-remote-package -p android -t "${{ github.ref_name }}"
```

### GitLab CI Example

```yaml
deploy-ota:
  stage: deploy
  image: node:20
  only:
    - tags
  script:
    - npm install
    - npx react-native bundle --platform android --dev false
      --entry-file index.js
      --bundle-output android/app/build/generated/assets/react/release/index.android.bundle
    - cd airborne_cli && npm install
    - node src/index.js login --client_id "$AIRBORNE_CLIENT_ID" --client_secret "$AIRBORNE_CLIENT_SECRET"
    - node src/index.js create-remote-files -p android --upload -t "$CI_COMMIT_TAG"
    - node src/index.js create-remote-package -p android -t "$CI_COMMIT_TAG"
      --entry-file index.js
      --bundle-output android/app/build/generated/assets/react/release/index.android.bundle
    - npx airborne-devkit configure --base-url https://airborne.juspay.in
    - npx airborne-devkit login --client_id "$AIRBORNE_CLIENT_ID" --client_secret "$AIRBORNE_CLIENT_SECRET"
    - npx airborne-devkit create-remote-files -p android --upload -t "$CI_COMMIT_TAG"
    - npx airborne-devkit create-remote-package -p android -t "$CI_COMMIT_TAG"
  variables:
    AIRBORNE_CLIENT_ID: $AIRBORNE_CLIENT_ID
    AIRBORNE_CLIENT_SECRET: $AIRBORNE_CLIENT_SECRET
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Error**: `401 Unauthorized` or `Invalid credentials`

**Solution**:

- Verify client ID and secret are correct
- Check if client has proper permissions in Keycloak
- Ensure server URL is correct
- Try logging in again

#### 2. File Upload Failed

**Error**: `Failed to upload file` or `Network error`

**Solution**:

- Check network connectivity
- Verify server is accessible
- Ensure file paths are correct
- Check file size limits

#### 3. Command Not Found

**Error**: `command not found: airborne-core-cli`

**Solution**:

```bash
# Install from npm
npm install -g airborne-core-cli

# Or use npx (no installation needed)
npx airborne-core-cli --help
```

#### 4. Configuration Not Found

**Error**: `No config file found`

**Solution**:

```bash
# For Airborne Core CLI
npx airborne-core-cli configure --base-url https://your-server.com

# For Airborne CLI
cd your-project
npx airborne-devkit create-local-airborne-config
```

## Next Steps

- **React Native Developers**: Read [Airborne CLI Guide](./airborne_cli.md)
- **Server Administrators**: Read [Airborne Core CLI Guide](./airborne_core_cli.md)
- **Server Setup**: [Airborne Server Setup Guide](../airborne_server/Setup.md)
- **SDK Integration**: [SDK Documentation](../airborne_sdk/README.md)

## Additional Resources

- **GitHub Repository**: [juspay/airborne](https://github.com/juspay/airborne)
- **Server API Documentation**: [API Documentation](../airborne_server/API.md)
- **Examples**: Check the `example/` directories in each CLI folder
