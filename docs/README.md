# Airborne Documentation

> **Airborne** empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their Android, iOS, and React Native applications.

Welcome to the comprehensive documentation for Airborne - an open-source OTA update platform that enables seamless deployment of updates to mobile applications without requiring app store submissions.

## 📚 Documentation Structure

### 🚀 [Getting Started](./airborne_server/Setup.md)

New to Airborne? Start here to set up your local development environment and understand the core concepts.

- [Server Setup Guide](./airborne_server/Setup.md) - Set up Airborne server locally using Docker/Podman
- [Quick Start Tutorial](./airborne_server/Setup.md#quick-start) - Get your first OTA update running in minutes

---

### 📱 SDK Integration

Platform-specific guides for integrating Airborne into your mobile applications.

#### [SDK Overview](./airborne_sdk/README.md)

High-level overview of all available SDKs and their capabilities.

#### Platform Guides

| Platform | Documentation | Use Case |
|----------|--------------|----------|
| **React Native** | [Integration Guide](./airborne_sdk/React_Native.md) | For React Native applications (both old & new architecture) |
| **Android** | [Integration Guide](./airborne_sdk/Android.md) | For native Android applications |
| **iOS** | [Integration Guide](./airborne_sdk/iOS.md) | For native iOS applications |

**What you'll learn:**
- Installation and dependency management
- Native initialization
- API usage and examples
- Platform-specific configurations
- Troubleshooting common issues

---

### 🛠️ CLI Tools

Command-line tools for managing OTA updates and server operations.

#### [CLI Overview](./airborne_cli/README.md)

Comparison and overview of both CLI tools.

#### Tool-Specific Guides

| Tool | Documentation | Best For |
|------|--------------|----------|
| **Airborne CLI** | [User Guide](./airborne_cli/airborne_cli.md) | React Native developers deploying updates |
| **Airborne Core CLI** | [User Guide](./airborne_cli/airborne_core_cli.md) | Server administrators and DevOps |

**What you'll learn:**
- Installation and setup
- Authentication and configuration
- Command reference
- CI/CD integration
- Automation scripts

---

### 🖥️ Server Documentation

Backend server setup, configuration, and API documentation.

#### [Server Setup](./airborne_server/Setup.md)

Complete guide to setting up the Airborne server locally or in production.

**Topics covered:**
- Prerequisites and installation
- Service configuration (PostgreSQL, Keycloak, LocalStack, Superposition)
- Development workflow
- Database migrations
- Environment configuration
- Troubleshooting

#### Additional Server Resources

- [API Documentation](../API_DOCUMENTATION.md) - Complete REST API reference
- [Database Schema](./airborne_server/Database.md) - Database structure and relationships *(if available)*
- [Authentication Guide](./airborne_server/Authentication.md) - Keycloak setup and user management *(if available)*

---

## 🎯 Quick Navigation

### By Role

#### **Mobile Developer**
1. [Choose your platform SDK](./airborne_sdk/README.md)
2. Follow the [platform-specific integration guide](./airborne_sdk/)
3. Use the [Airborne CLI](./airborne_cli/airborne_cli.md) to deploy updates

#### **React Native Developer**
1. Read the [React Native Integration Guide](./airborne_sdk/React_Native.md)
2. Set up [Airborne CLI](./airborne_cli/airborne_cli.md)
3. Follow the [deployment workflow](./airborne_cli/airborne_cli.md#workflows)

#### **DevOps Engineer**
1. Set up the [Airborne Server](./airborne_server/Setup.md)
2. Learn the [Core CLI](./airborne_cli/airborne_core_cli.md)
3. Implement [CI/CD integration](./airborne_cli/README.md#cicd-integration)

#### **Backend Developer**
1. Set up the [Airborne Server](./airborne_server/Setup.md)
2. Study the [API Documentation](../API_DOCUMENTATION.md)
3. Explore [database schema](./airborne_server/Setup.md#services-overview)

---

## 📖 Common Workflows

### Deploying Your First OTA Update (React Native)

1. **Setup**
   - [Install and configure Airborne CLI](./airborne_cli/airborne_cli.md#installation)
   - [Initialize project configuration](./airborne_cli/airborne_cli.md#create-local-airborne-config-directorypath)

2. **Build**
   - Build React Native bundle
   - [Create release configuration](./airborne_cli/airborne_cli.md#create-local-release-config-directorypath)

3. **Deploy**
   - [Authenticate with server](./airborne_cli/airborne_cli.md#login-directorypath)
   - [Upload files](./airborne_cli/airborne_cli.md#create-remote-files-directorypath)
   - [Create package](./airborne_cli/airborne_cli.md#create-remote-package-directorypath)

[See complete workflow →](./airborne_cli/airborne_cli.md#complete-deployment-workflow)

### Integrating Airborne SDK (Android)

1. [Add dependencies](./airborne_sdk/Android.md#installation)
2. [Initialize in Application class](./airborne_sdk/Android.md#step-1-set-up-application-class)
3. [Implement callbacks](./airborne_sdk/Android.md#step-3-create-tracker-implementation)
4. [Test integration](./airborne_sdk/Android.md#testing)

[See complete guide →](./airborne_sdk/Android.md)

### Setting Up Production Environment

1. [Deploy Airborne Server](./airborne_server/Setup.md)
2. [Configure Keycloak](./airborne_server/Setup.md#keycloak-authentication--authorization)
3. [Set up database](./airborne_server/Setup.md#postgresql-database)
4. [Configure S3/LocalStack](./airborne_server/Setup.md#localstack-aws-services-mock)
5. [Deploy first release](./airborne_cli/airborne_core_cli.md#deployment-workflow)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mobile Applications                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Android    │  │     iOS      │  │ React Native │         │
│  │     SDK      │  │     SDK      │  │     SDK      │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Airborne API   │
                    │   (REST API)    │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐   ┌───────▼────────┐   ┌────▼──────┐
    │ PostgreSQL│   │   Keycloak     │   │ S3/Local- │
    │   (Data)  │   │ (Auth & Users) │   │   Stack   │
    └───────────┘   └────────────────┘   └───────────┘
```

**Components:**
- **Mobile SDKs**: Native libraries for Android, iOS, and React Native
- **Airborne Server**: REST API backend for managing releases and configurations
- **PostgreSQL**: Stores packages, releases, and configurations
- **Keycloak**: Authentication and authorization
- **S3/LocalStack**: File storage for OTA packages

[Read more about server architecture →](./airborne_server/Setup.md#services-overview)

---

## 🚀 Key Features

### For Developers
- ✅ **Easy Integration**: Simple SDK APIs with comprehensive documentation
- ✅ **Multiple Platforms**: Support for Android, iOS, and React Native
- ✅ **Hot Reload**: Updates applied without app restart (where possible)
- ✅ **Rollback Support**: Automatic fallback to bundled assets on failure
- ✅ **Type Safety**: Full TypeScript support for React Native

### For DevOps
- ✅ **CI/CD Ready**: CLI tools designed for automation
- ✅ **Dimension-based Updates**: Serve different updates based on user segments
- ✅ **Version Control**: Track all releases and packages
- ✅ **Metrics & Analytics**: Built-in event tracking
- ✅ **Self-hosted**: Full control over your infrastructure

### For Product Teams
- ✅ **Instant Updates**: Deploy fixes without app store review
- ✅ **A/B Testing**: Serve different content to different user groups
- ✅ **Feature Flags**: Toggle features via OTA updates
- ✅ **Gradual Rollout**: Control update distribution
- ✅ **Emergency Patches**: Quick hotfix deployment

---

## 📋 Requirements

### For Using SDKs

| Platform | Minimum Version | Recommended |
|----------|----------------|-------------|
| Android | API 21 (Android 5.0) | API 35 (Android 15) |
| iOS | iOS 12.0 | iOS 18.0 |
| React Native | 0.70 | 0.76+ |
| Node.js (CLI) | 20+ | 22+ |

### For Running Server

| Component | Version |
|-----------|---------|
| Docker/Podman | Latest |
| PostgreSQL | 13+ |
| Rust | 1.70+ (for building from source) |
| Node.js | 20+ (for dashboard) |

[See complete prerequisites →](./airborne_server/Setup.md#prerequisites)

---

## 🎓 Tutorials & Examples

### Example Applications

- **React Native**: [`airborne-react-native/example`](../airborne-react-native/example)
  - New Architecture example
  - Old Architecture: [`ExampleOldArch`](../airborne-react-native/ExampleOldArch)
  - Split Bundle: [`ExampleSplitBundle`](../airborne-react-native/ExampleSplitBundle)

- **Android**: Check SDK example projects
- **iOS**: [`airborne_sdk_iOS/Example`](../airborne_sdk_iOS/hyper-ota/Example)

### Step-by-Step Tutorials

1. [Your First OTA Update (React Native)](./airborne_sdk/React_Native.md#quick-start)
2. [Implementing Feature Flags](./airborne_sdk/React_Native.md#feature-flags-with-ota)
3. [Setting Up CI/CD](./airborne_cli/README.md#cicd-integration)
4. [User Segmentation with Dimensions](./airborne_cli/airborne_core_cli.md#dimension-management)

---

## 🔧 Troubleshooting

### Common Issues

- **SDK Integration Issues**: See platform-specific troubleshooting
  - [React Native](./airborne_sdk/React_Native.md#troubleshooting)
  - [Android](./airborne_sdk/Android.md#troubleshooting)
  - [iOS](./airborne_sdk/iOS.md#troubleshooting)

- **CLI Issues**: [Airborne CLI Troubleshooting](./airborne_cli/airborne_cli.md#troubleshooting)

- **Server Issues**: [Server Setup Troubleshooting](./airborne_server/Setup.md#troubleshooting)

### Getting Help

- 📖 Check the relevant documentation section
- 🐛 [Report issues on GitHub](https://github.com/juspay/airborne/issues)
- 💬 [Join discussions](https://github.com/juspay/airborne/discussions)

---

## 🤝 Contributing

Airborne is open-source and welcomes contributions!

- **Code**: Submit pull requests on GitHub
- **Documentation**: Help improve these docs
- **Issues**: Report bugs and request features

[Contributing Guidelines →](../CONTRIBUTING.md) *(if available)*

---

## 📄 License

Airborne is licensed under the [Apache License 2.0](../LICENSE).

---

## 📚 Additional Resources

### External Links

- **GitHub Repository**: [juspay/airborne](https://github.com/juspay/airborne)
- **Maven Repository** (Android): [maven.juspay.in](https://maven.juspay.in/hyper-sdk/)
- **npm Packages**:
  - [airborne-react-native](https://www.npmjs.com/package/airborne-react-native)
  - [airborne-core-cli](https://www.npmjs.com/package/airborne-core-cli)

### Related Documentation

- [Changelog](../CHANGELOG.md) - Version history and release notes
- [Project Brief](../memory-bank/projectbrief.md) - Project overview and goals *(if available)*
- [API Documentation](../API_DOCUMENTATION.md) - Complete REST API reference

---

## 🗺️ Documentation Map

```
docs/
├── README.md (you are here)
│
├── airborne_server/
│   ├── Setup.md                 # Complete server setup guide
│   ├── Database.md              # Database schema (if available)
│   └── Authentication.md        # Auth configuration (if available)
│
├── airborne_sdk/
│   ├── README.md                # SDK overview
│   ├── React_Native.md          # React Native integration
│   ├── Android.md               # Android integration
│   └── iOS.md                   # iOS integration
│
└── airborne_cli/
    ├── README.md                # CLI tools overview
    ├── airborne_cli.md          # React Native CLI
    └── airborne_core_cli.md     # Server administration CLI
```

---

## 🎯 Next Steps

### If you're new to Airborne:
1. Read the [Server Setup Guide](./airborne_server/Setup.md)
2. Choose your platform and follow the SDK guide
3. Deploy your first update using the CLI

### If you're integrating the SDK:
1. Pick your platform guide from [SDK Documentation](./airborne_sdk/README.md)
2. Follow the integration steps
3. Test with the example applications

### If you're setting up production:
1. Complete the [Server Setup](./airborne_server/Setup.md)
2. Configure [Keycloak](./airborne_server/Setup.md#keycloak-authentication--authorization)
3. Set up [CI/CD pipelines](./airborne_cli/README.md#cicd-integration)
4. Deploy using [Core CLI](./airborne_cli/airborne_core_cli.md)

---

**Happy coding with Airborne! 🚀**

For questions, issues, or contributions, visit the [GitHub repository](https://github.com/juspay/airborne).
