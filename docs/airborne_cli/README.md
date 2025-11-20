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

| Feature                     | Airborne CLI (`airborne-devkit`)        | Airborne Core CLI (`airborne-core-cli`)            |
| --------------------------- | --------------------------------------- | -------------------------------------------------- |
| **NPM Package**             | `airborne-devkit`                       | `airborne-core-cli`                                |
| **Relationship**            | Wrapper around Airborne Core CLI        | Standalone low-level CLI                           |
| **Commands**                | All Core CLI commands + RN workflows    | Base commands only                                 |
| **Target Users**            | Most users (RN & non-RN)                | Advanced users needing direct API control          |
| **Application Support**     | React Native only                       | Any application                                    |
| **Complexity**              | User-friendly, interactive              | Powerful, scriptable                               |
| **Focus**                   | React Native workflows                  | Server API operations                              |
| **Token Management**        | Automatic (stores & reuses)             | Manual (login prints token, not stored)            |
| **Configuration**           | React Native projects                   | Any application                                    |
| **File Handling**           | Bundle-focused                          | Generic file management                            |
| **Release Management**      | Simplified                              | Full control                                       |
| **Organization Management** | Yes (via wrapped commands)              | Yes                                                |
| **Dimension Management**    | Yes (via wrapped commands)              | Yes                                                |
| **Local Testing**           | Yes (via wrapped commands)              | Yes (serve releases)                               |
| **Recommended For**         | ✅ Most use cases                       | Advanced scenarios requiring manual token handling |

## Getting Started

### For React Native Developers

Start with **[Airborne CLI](./airborne_cli.md)**:

```bash
# Navigate to your React Native project
cd my-react-native-app

# Initialize configuration
node path/to/airborne_cli/src/index.js create-local-airborne-config

# Create release config
node path/to/airborne_cli/src/index.js create-local-release-config -p android

# Deploy
node path/to/airborne_cli/src/index.js login --client_id YOUR_ID --client_secret YOUR_SECRET
node path/to/airborne_cli/src/index.js create-remote-files -p android --upload
node path/to/airborne_cli/src/index.js create-remote-package -p android
```

### For Server Administrators

Start with **[Airborne Core CLI](./airborne_core_cli.md)**:

```bash
# Configure server endpoint
airborne-core-cli configure --base-url https://your-server.com

# Login
airborne-core-cli login --client-id YOUR_ID --client-secret YOUR_SECRET

# Create organization
airborne-core-cli create-org --name "MyOrg" --description "My Organization"

# Create application
airborne-core-cli create-app --org-id org_123 --name "MyApp"

# Upload and create package
airborne-core-cli upload-file --file ./bundle.js --tag v1.0.0
airborne-core-cli create-package --config ./package-config.json
```

## Installation

### Airborne CLI (React Native)

**NPM Package**: `airborne-devkit`

```bash
# Install from npm
npm install -g airborne-devkit

# Or install locally in your project
npm install --save-dev airborne-devkit
```

**From Repository** (located at `airborne_cli/`):

```bash
cd airborne_cli
npm install

# Run commands
node src/index.js --help
```

### Airborne Core CLI

**NPM Package**: `airborne-core-cli`

```bash
# Install from npm
npm install -g airborne-core-cli

# Or install locally in your project
npm install --save-dev airborne-core-cli
```

**From Repository** (located at `airborne-core-cli/`):

```bash
cd airborne-core-cli
npm install

# Install globally (optional)
npm link

# Run commands
airborne-core-cli --help
```

## Common Workflows

### Deploying a React Native Update

```bash
# 1. Build your React Native bundle
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/build/generated/assets/react/release/index.android.bundle

# 2. Create/update release config
node airborne_cli/src/index.js create-local-release-config -p android

# 3. Authenticate
node airborne_cli/src/index.js login --client_id $CLIENT_ID --client_secret $CLIENT_SECRET

# 4. Upload files
node airborne_cli/src/index.js create-remote-files -p android --upload -t "v1.2.0"

# 5. Create package
node airborne_cli/src/index.js create-remote-package -p android -t "v1.2.0"
```

### Setting Up a New Organization

```bash
# 1. Configure endpoint
airborne-core-cli configure --base-url https://airborne.example.com

# 2. Login
airborne-core-cli login --client-id $CLIENT_ID --client-secret $CLIENT_SECRET

# 3. Create organization
airborne-core-cli create-org --name "MyCompany" --description "Company OTA updates"

# 4. Create application
airborne-core-cli create-app --org-id org_abc123 --name "MyApp"

# 5. Create dimensions
airborne-core-cli create-dimension --key "userType" --value "premium"
airborne-core-cli create-dimension --key "city" --value "bangalore"
```

### Testing Releases Locally

```bash
# Using Airborne Core CLI to serve releases locally

# 1. Create a local release configuration
airborne-core-cli serve-release-v2 --namespace myapp --platform android \
  --port 3000 --config ./local-release-config.json

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
node airborne_cli/src/index.js login \
  --client_id your_client_id \
  --client_secret your_client_secret
```

**Airborne Core CLI**:

```bash
airborne-core-cli login \
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
node airborne_cli/src/index.js login \
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
          cd airborne_cli
          npm install
          node src/index.js login --client_id "$CLIENT_ID" --client_secret "$CLIENT_SECRET"
          node src/index.js create-remote-files -p android --upload -t "${{ github.ref_name }}"
          node src/index.js create-remote-package -p android -t "${{ github.ref_name }}"
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
# Install globally
cd airborne-core-cli
npm link

# Or use full path
node /path/to/airborne-core-cli/bin.js --help
```

#### 4. Configuration Not Found

**Error**: `No config file found`

**Solution**:

```bash
# For Airborne Core CLI
airborne-core-cli configure --base-url https://your-server.com

# For Airborne CLI
cd your-project
node path/to/airborne_cli/src/index.js create-local-airborne-config
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
