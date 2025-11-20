# Airborne CLI Documentation

Welcome to the Airborne CLI tools documentation. Airborne provides two CLI tools for managing OTA updates:

## CLI Tools Overview

### [Airborne CLI](./airborne_cli.md)
**React Native focused CLI** for managing OTA updates in React Native applications.

**Key Features**:
- Initialize Airborne configuration for React Native projects
- Create release configurations for Android and iOS
- Upload files and create packages
- Manage local and remote configurations
- Interactive prompts for easy setup

**Best For**: React Native developers deploying OTA updates

### [Airborne Core CLI](./airborne_core_cli.md)
**Low-level CLI** for direct interaction with the Airborne server API.

**Key Features**:
- Comprehensive server API access
- Organization and application management
- File and package operations
- Release management
- Dimension-based configuration
- Serve releases locally for testing

**Best For**: Server administrators, CI/CD pipelines, advanced users

## Quick Comparison

| Feature | Airborne CLI | Airborne Core CLI |
|---------|--------------|-------------------|
| **Target Users** | React Native developers | Server admins, DevOps |
| **Complexity** | User-friendly, interactive | Powerful, scriptable |
| **Focus** | React Native workflows | Server API operations |
| **Authentication** | Client credentials | Client credentials |
| **Configuration** | React Native projects | Any application |
| **File Handling** | Bundle-focused | Generic file management |
| **Release Management** | Simplified | Full control |
| **Organization Management** | No | Yes |
| **Dimension Management** | No | Yes |
| **Local Testing** | No | Yes (serve releases) |

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

Located in the repository at `airborne_cli/`:

```bash
cd airborne_cli
npm install

# Run commands
node src/index.js --help
```

### Airborne Core CLI

Located in the repository at `airborne-core-cli/`:

```bash
cd airborne-core-cli
npm install

# Install globally (optional)
npm link

# Run commands
airborne-core-cli --help
```

Or use the standalone binary (no Node.js required):

```bash
# Download from releases
# Linux
wget https://github.com/juspay/airborne/releases/download/v0.15.1/airborne-core-cli-linux-x64

# macOS
wget https://github.com/juspay/airborne/releases/download/v0.15.1/airborne-core-cli-macos-x64

# Make executable
chmod +x airborne-core-cli-*

# Run
./airborne-core-cli-linux-x64 --help
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

Both CLIs use the same authentication mechanism:

### Client Credentials

Obtain from your Airborne server administrator or Keycloak:

1. Navigate to Keycloak admin console
2. Select your realm
3. Go to Clients
4. Create or select a client
5. Get Client ID and Client Secret

### Login Command

**Airborne CLI**:
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

### Token Storage

Both CLIs store authentication tokens locally:

- **Airborne CLI**: `.airborne/` directory in your project
- **Airborne Core CLI**: `.config` file in CLI installation directory

**Security Note**: Never commit these files to version control. Add to `.gitignore`:

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
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
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

### Debug Mode

Enable verbose logging:

**Airborne CLI**:
```bash
export DEBUG=airborne:*
node airborne_cli/src/index.js <command>
```

**Airborne Core CLI**:
```bash
airborne-core-cli --verbose <command>
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
