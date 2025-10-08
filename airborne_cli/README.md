# Airborne CLI for React Native

A command-line interface for managing Over-The-Air (OTA) updates in React Native applications using the Airborne platform. This tool streamlines the process of creating, configuring, and deploying OTA updates for both Android and iOS platforms.

## 🚀 Features

- **Configuration Management**: Set up Airborne configurations for React Native projects
- **Platform Support**: Full support for Android and iOS platforms
- **OTA Updates**: Create and deploy Over-The-Air updates seamlessly
- **File Management**: Upload files directly or use external URLs
- **Package Creation**: Build deployable packages from local configurations
- **Authentication**: Secure login with client credentials
- **Interactive CLI**: User-friendly prompts and validations

## 🏁 Quick Start

### 1. Initialize Airborne Configuration

```bash
node airborne_cli/src/index.js create-local-airborne-config airborne-react-native/example
```

This creates an `airborne-config.json` file with your project settings.

### 2. Create Release Configuration

```bash
node airborne_cli/src/index.js create-local-release-config airborne-react-native/example
```

### 3. Authenticate with Airborne Server

```bash
node airborne_cli/src/index.js login --client_id YOUR_CLIENT_ID --client_secret YOUR_CLIENT_SECRET
```

### 4. Upload Files and Create Package

```bash
# Upload files to Airborne server
node airborne_cli/src/index.js create-remote-files -u airborne-react-native/example

# Create package
node airborne_cli/src/index.js create-remote-package airborne-react-native/example
```

## 🔐 Authentication

Before using remote operations, you need to authenticate with the Airborne server:

```bash
node airborne_cli/src/index.js login --client_id <your-client-id> --client_secret <your-client-secret>
```

**Security Note**: Store your credentials securely and avoid committing them to version control. Consider using environment variables:

```bash
node airborne_cli/src/index.jslogin --client_id "$AIRBORNE_CLIENT_ID" --client_secret "$AIRBORNE_CLIENT_SECRET"
```

## ⚙️ Configuration

### Airborne Configuration (`airborne-config.json`)

Created by `create-local-airborne-config` command:

```json
{
  "organisation": "your-org-name",
  "namespace": "your-app-namespace",
  "js_entry_file": "index.js",
  "android": {
    "index_file_path": "android/app/build/generated/assets/react/release/index.android.bundle"
  },
  "ios": {
    "index_file_path": "ios/main.jsbundle"
  }
}
```

### Release Configuration

Platform-specific release configurations are created automatically with appropriate timeouts and file paths.

## 📚 Commands Reference

### Configuration Commands

#### `create-local-airborne-config [directoryPath]`

Initialize Airborne configuration for React Native projects.

**Options:**

- `-o, --organisation <org>` - Organisation name
- `-n, --namespace <namespace>` - Application namespace
- `-j, --js-entry-file <path>` - JavaScript entry file path
- `-a, --android-index-file <path>` - Android bundle output file
- `-i, --ios-index-file <path>` - iOS bundle output file

**Examples:**

```bash
# Interactive mode
node  airborne_cli/src/index.js

# With options
node  airborne_cli/src/index.js  -o "MyCompany" -n "MyApp"
```

#### `create-local-release-config [directoryPath]`

Create platform-specific release configuration files.

**Options:**

- `-p, --platform <platform>` - Target platform (android | ios)
- `-b, --boot-timeout <timeout>` - Boot timeout in milliseconds
- `-r, --release-timeout <timeout>` - Release timeout in milliseconds

**Examples:**

```bash
# Interactive mode
node airborne_cli/src/index.js create-local-release-config

# Specific platform
node airborne_cli/src/index.js create-local-release-config -p android

# With timeouts
node airborne_cli/src/index.js create-local-release-config -p ios -b 30000 -r 60000
```

#### `update-local-release-config [directoryPath]`

Update existing release configuration files.

**Options:**

- `-p, --platform <platform>` - Target platform (android | ios)
- `-b, --boot-timeout <timeout>` - New boot timeout in milliseconds
- `-r, --release-timeout <timeout>` - New release timeout in milliseconds

### Remote Operations

#### `login [directoryPath]`

Authenticate with the Airborne server.

**Options:**

- `--client_id <clientId>` - Client ID (required)
- `--client_secret <clientSecret>` - Client Secret (required)

#### `create-remote-files [directoryPath]`

Process local files and create remote file records.

**Options:**

- `-p, --platform <platform>` - Target platform (android | ios) (required)
- `-t, --tag <tag>` - Tag for file identification
- `-u, --upload` - Upload files directly to Airborne server

**Examples:**

```bash
# Create file records with external URLs
node airborne_cli/src/index.js create-remote-files -p android

# Upload files to Airborne server
node airborne_cli/src/index.js create-remote-files -p ios --upload

# With custom tag
node airborne_cli/src/index.js create-remote-files -p android -t "v1.2.0" --upload
```

#### `create-remote-package [directoryPath]`

Create a deployable package from local release configuration.

**Options:**

- `-p, --platform <platform>` - Target platform (android | ios) (required)
- `-t, --tag <tag>` - Package tag for identification

**Examples:**

```bash
# Create package
node airborne_cli/src/index.js create-remote-package -p android

# With version tag
node airborne_cli/src/index.js create-remote-package -p ios -t "v2.1.0"
```

## 🔄 Complete Workflow Example

Here's a complete example of setting up OTA updates for a React Native project:

```bash
# 1. Navigate to your React Native project
cd my-react-native-app

# 2. Initialize Airborne configuration
node  airborne_cli/src/index.js  \
  -o "MyCompany" \
  -n "MyApp" \
  -j "index.js"

# 3. Create release configurations for both platforms
node airborne_cli/src/index.js create-local-release-config -p android -b 30000 -r 60000
node airborne_cli/src/index.js create-local-release-config -p ios -b 30000 -r 60000

# 4. Build your React Native bundles (standard RN commands)
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/build/generated/assets/react/release/index.android.bundle \
  --assets-dest android/app/build/generated/res/react/release

npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios

# 5. Authenticate with Airborne
node airborne_cli/src/index.js login --client_id "$AIRBORNE_CLIENT_ID" --client_secret "$AIRBORNE_CLIENT_SECRET"

# 6. Upload files and create packages
node airborne_cli/src/index.js create-remote-files -p android --upload -t "v1.0.0"
node airborne_cli/src/index.js create-remote-package -p android -t "v1.0.0"

node airborne_cli/src/index.js create-remote-files -p ios --upload -t "v1.0.0"
node airborne_cli/src/index.js create-remote-package -p ios -t "v1.0.0"
```

## 📁 File Structure

After running the commands, your project will have:

```
your-project/
├── airborne-config.json                    # Main Airborne configuration
├── airborne-release-config-android.json    # Android release config
├── airborne-release-config-ios.json        # iOS release config
├── .airborne                               # Authentication token and other things (keep secure)
└── ... (your existing React Native files)
```

## 🔧 Troubleshooting

### Common Issues

**1. "Airborne config already exists" Error**

- The configuration file already exists in the directory
- Use `update-local-release-config` to modify existing configurations

**2. Authentication Errors**

- Verify your client credentials are correct and active
- Check network connectivity to Airborne servers
- Ensure you have write permissions in the target directory

**3. Platform Validation Errors**

- Platform must be exactly "android" or "ios" (lowercase)
- Use `-p` option to specify platform explicitly

**4. File Upload Issues**

- Ensure all referenced files exist in the specified paths
- Check file permissions and sizes
- Verify your authentication token is valid

### Getting Help

For additional help with any command, use the `--help` flag:

```bash
node airborne_cli/src/index.js --help
node  airborne_cli/src/index.js  --help
```

## 🛠️ Development

### Requirements

- Node.js 18+
- React Native CLI
- Valid Airborne server credentials
