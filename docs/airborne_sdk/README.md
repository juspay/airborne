# Airborne SDK Documentation

Welcome to the Airborne SDK documentation. Airborne provides Over-The-Air (OTA) update capabilities for mobile applications across multiple platforms.

## Available SDKs

Airborne offers native SDKs and integration solutions for the following platforms:

### [React Native](./React_Native.md)
Complete React Native integration with support for both old and new architectures (TurboModules). Provides JavaScript/TypeScript APIs with native initialization on both iOS and Android.

**Use Case**: React Native applications that need OTA updates for JavaScript bundles and assets.

### [Android](./Android.md)
Native Android SDK written in Kotlin. Provides full OTA capabilities for Android applications with flexible initialization and configuration.

**Use Case**: Native Android applications or React Native Android modules.

### [iOS](./iOS.md)
Native iOS SDK written in Swift with Objective-C support. Provides comprehensive OTA update management for iOS applications.

**Use Case**: Native iOS applications or React Native iOS modules.

## Key Features

All Airborne SDKs provide:

- ✅ **Over-The-Air Updates**: Deploy updates without app store submission
- ✅ **Lazy Loading**: Download critical content first, defer non-critical content
- ✅ **Fallback Support**: Automatic fallback to bundled assets if OTA fails
- ✅ **Dimension-based Configuration**: Serve different content based on user segments
- ✅ **Event Tracking**: Monitor update lifecycle and performance
- ✅ **Security**: Secure download and verification of update packages
- ✅ **Offline Support**: Work seamlessly with or without network connectivity

## Getting Started

Choose your platform to get started:

1. **[React Native Integration Guide](./React_Native.md)** - For React Native apps
2. **[Android Integration Guide](./Android.md)** - For native Android apps
3. **[iOS Integration Guide](./iOS.md)** - For native iOS apps

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
├─────────────────────────────────────────────────────────────┤
│                      Airborne SDK                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Release    │  │   Package    │  │    Event     │     │
│  │ Config Mgmt  │  │  Downloader  │  │   Tracker    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                   Native Platform APIs                       │
│           (Network, Storage, Crypto, etc.)                   │
└─────────────────────────────────────────────────────────────┘
```

## Common Concepts

### Namespace
A unique identifier for your application within the Airborne system. Used to isolate configurations and updates across different apps or environments.

**Example**: `"com.mycompany.myapp"` or `"myapp-production"`

### Release Configuration
A JSON document that describes:
- Available packages and their versions
- File assets and their download URLs
- Timeout configurations
- Lazy download specifications

### Dimensions
Key-value pairs that customize the release configuration based on:
- User segments (e.g., `"userType": "premium"`)
- Geographic location (e.g., `"city": "bangalore"`)
- Device properties (e.g., `"deviceType": "tablet"`)
- Feature flags (e.g., `"betaFeatures": "enabled"`)

### Lazy Downloads
Non-critical assets that are downloaded in the background after the app boots. This improves initial load time while ensuring all content is eventually available.

## Support & Resources

- **Documentation**: See platform-specific guides linked above
- **API Reference**: Available in each SDK's README
- **Server Setup**: [Airborne Server Setup Guide](../airborne_server/Setup.md)
- **CLI Tools**: [Airborne CLI](../airborne_cli/README.md) and [Core CLI](../airborne_core_cli/README.md)

## Version Compatibility

| SDK | Minimum Version | Target Version |
|-----|----------------|----------------|
| Android | API 21 (Android 5.0) | API 35 (Android 15) |
| iOS | iOS 12.0+ | iOS 18.0 |
| React Native | 0.70+ | 0.76+ |

## Next Steps

1. Choose your platform and follow its integration guide
2. Set up the [Airborne Server](../airborne_server/Setup.md) for development
3. Use the [CLI tools](../airborne_cli/README.md) to create and deploy updates
4. Test your integration with the provided examples
