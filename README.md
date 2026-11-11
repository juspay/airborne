# Airborne

Self-hosted over-the-air JavaScript and asset releases for React Native, Android and iOS. Target compatible app versions, ramp deliberately, and retain bundled code for first boot. Native code changes still require a store build.

## Start here: the 10-minute path

With Docker Compose, Rust (the pinned toolchain), Node/npm, Python 3, curl and jq installed:

```sh
make quickstart
```

This starts an isolated local sandbox with real Keycloak authentication, PostgreSQL, Superposition and LocalStack, seeds `quickstart / first-app`, and prints its dashboard URL and credentials file. It uses fresh project names, loopback-only random ports and private state under `.quickstart/`. It skips Redis, RedisInsight, analytics and the docs server. Ctrl-C stops and removes only that sandbox's containers and volumes; logs remain. Do not use this plaintext local configuration in production.

Ten minutes is a walkthrough budget after prerequisites, images and compilation are ready, not a guaranteed cold install time. Image downloads and the first Rust build can take longer. To time setup without leaving it running: `python3 scripts/quickstart.py --smoke`.

1. Sign in using the printed credentials. Open `quickstart / first-app`.
2. Follow the [React Native integration guide](https://airborne.juspay.in/docs/guides/integrate-react-native/). **Native wiring still needs manual edits and a rebuild**; the script does not patch your app. Configure the printed local API endpoint and send `app_version=1.0.0`. A physical device needs a reachable host endpoint; the loopback sandbox is intended for local development.
3. Bundle and upload files, then cut a package with the CLI described in that guide.
4. Create a release in the dashboard. Select `version_cohort=v1`, whose exact compatible range is `1.0.0`. Review targeting; strict serving rejects untargeted releases, including the first.
5. Ramp (up to 50%, preserving the control variant), inspect the test client, then conclude with the experimental variant for all matching devices. Creation alone serves nobody. Relaunch the app and confirm it fetches and boots the new package.

For your own app, create `app_version` (standard), then `version_cohort` (cohort depending on `app_version`) under Dimensions, and define its compatible range under Cohorts. Never reuse a version range for incompatible native binaries.

## Choose an SDK

- [Android SDK](airborne_sdk_android/README.md)
- [iOS SDK](airborne_sdk_iOS/README.md)
- [React Native SDK](airborne-react-native/README.md)
- [React Native example](airborne-react-native/example)

## Airborne, Expo Updates and CodePush

| Choice | Useful when | Costs and limits |
| --- | --- | --- |
| Airborne | You want to operate this server, version cohorts and per-app approval policy in your infrastructure. | More services and operational work; manual native wiring; compatibility ranges rely on operator correctness; no automatic fleet rollback from telemetry. Ramps cap at 50% until explicit conclusion. |
| Expo Updates / EAS Update | You want Expo's documented configuration and hosted update workflow, channels, runtime-version matching and rollouts. | You must maintain compatible native runtimes; native changes still need a new binary. Airborne does not offer EAS's integrated setup workflow. |
| CodePush | You have an existing CodePush client and need to assess its independent server path. | App Center retired on March 31, 2025; evaluate the standalone CodePush distribution and its maintenance obligations rather than assuming the old hosted service is available. Airborne is not a drop-in CodePush endpoint. |

Sources checked October 31, 2026: [Expo setup](https://docs.expo.dev/eas-update/getting-started/), [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [rollouts](https://docs.expo.dev/eas-update/rollouts/), [rollbacks](https://docs.expo.dev/eas-update/rollbacks/), [Microsoft retirement and standalone CodePush](https://learn.microsoft.com/en-us/appcenter/retirement). `expo-updates` is a client library; EAS Update is its hosted service, so these are not synonymous.

## Operate and contribute

See [server setup](airborne_docs/docs/server), [dashboard releases](airborne_docs/docs/dashboard/releases.mdx), and [maker-checker tradeoffs](airborne_docs/docs/guides/maker-checker-tradeoffs.md). Production requires your own identity, storage, TLS, backups and monitoring configuration. Rollback can be blocked by policy or protections; CDN submission does not prove edge availability, and inactive clients may not update promptly.

Contributions should include relevant tests and matching documentation. See [LICENSE](LICENSE).

## SDK internals

## SDK Configuration and Download Flow Details

This section delves into the specifics of the Airborne SDK's configuration file structure and the download/usage flows it manages.

### Core Concepts

We are seeing 2 broad categories of files that have to be downloaded:

- **Package**: An atomic unit, which consists of files and properties requiring all files to be present to boot. A package can be further divided into two sets:
  - **Important**: If these files are not present by the boot timeout, then this package is not used.
  - **Lazy**: If the priority files are downloaded by boot timeout, then these files will download in parallel and inform the application upon completion.
- **Resources**: These are files that will work in any combination. All resources that load before the boot timeout are used in that session.

### Configuration File Structure

The SDK requires a configuration file with the following structure:

```json
{
  "version": "1",
  "config": {
    "version": "1.0.0",
    "release_config_timeout": 1000,
    "boot_timeout": 1000,
    "properties": {}
  },
  "package": {
    "name": "Application_Name",
    "version": "1.0.0",
    "index": {
      "url": "https://assets.juspay.in/bundles/index.js",
      "filePath": "index.js"
    },
    "properties": {},
    "important": [
      {
        "url": "https://assets.juspay.in/bundles/initial.js",
        "filePath": "initial.js"
      }
    ],
    "lazy": [
      {
        "url": "https://assets.juspay.in/images/card.png",
        "filePath": "card.png"
      }
    ]
  },
  "resources": [
    {
      "url": "https://assets.juspay.in/configs/config.js",
      "filePath": "config.js"
    }
  ]
}
```

The above structure has 4 parts: `version`, `config`, `package`, and `resources`.

- **Version**: This is the version of the structure of the above file.
- **Config**: Contains the configuration for the SDK to decide the behavior of downloads. It contains the following keys:
  - `version`: Used to indicate the current version of the config.
  - `release_config_timeout`: Timeout for this file to complete downloading. This is used in the next session.
  - `boot_timeout`: Timeout for both the package and resource block to complete downloading. This is called boot time since it is an indicator that the application can use the package to begin booting.
  - `properties`: This is a user-defined field block which can be used to send any config keys to the application.
- **Package**: A package is an atomic unit. The package block as mentioned above is a transactional set of files. The package block contains the spec for the package. It contains the following keys:
  - `name`: The name of the application represented by this package.
  - `version`: The version of this package. Note: if the version is not changed, the SDK will not initiate the download of the package.
  - `properties`: This is a user-defined field block which can be used to send any config keys to configure their application. This block is used to send keys specific to this version of the package, unlike the block in `config` which will give the latest available.
  - `index`: A special entry for the file used as the entry point to the package.
  - `important`: List of files required at the start of the application. The application cannot boot without these files.
  - `lazy`: List of files which extend the `important` block; This can be used for non-critical code files, images, etc.
- **Resources**: List of files which will attempt to download before the `boot_timeout`. All files that complete before timeout will be available during boot.

### Download and Usage Flow

#### Case 1: Happy Case

The entire `package.important` block is available before boot timeout.

![Case 1: Happy Case](readme-images/Case%201%20Happy%20Case.png)

#### Case 2: Package Timeout

If the `package.important` block is not completely downloaded on time, the entire package set is not used. The SDK will supply the previous package along with relevant configurations to its users.

![Case 2: Package Timeout](readme-images/Case%202%20Package%20Timeout.png)

#### Case 3: Resource Timeout

If the resource block is not completely downloaded by the time of load, then all files downloaded before the timeout are used. Files downloaded after are not available in this session. This ensures that file read operations in one session are idempotent.

![Case 3: Resource Timeout](readme-images/Case%203%20Resource%20Timeout.png)

### Feature list

- Splits (Webpack - split) support for bundles
- Security via signature validation
- CLI for pushing releases
- React plugin to use sdk
- Juspay server / Self hosted
- Adoption Analytics

### Optional Add-ons: The Airborne Backend Systems

For developers who need comprehensive backend solutions to manage updates and analytics:

#### **[Airborne Server](airborne_server/README.md)**

A robust backend system that can manage application versions, store update packages, and deliver them to your SDK-integrated applications.

- **Key functionalities**: User authentication (OIDC-based; Keycloak-compatible), organization/application management, package storage, release configurations, and a dashboard UI.
- **Technology stack**: Rust (Actix Web), PostgreSQL, Keycloak, Docker, LocalStack (for AWS emulation).

#### **[Airborne Analytics Server](airborne_analytics_server/README.md)**

A high-performance analytics platform that provides comprehensive OTA update insights and monitoring.

- **Key functionalities**: Real-time event streaming, adoption metrics, failure analysis, performance tracking, multi-tenant analytics.
- **Technology stack**: Rust (Actix Web), Kafka, ClickHouse/Victoria Metrics, Grafana for visualization.
- **Features**: Event ingestion API, real-time dashboards, adoption rates, version distribution analysis, device tracking.

**Note**: While powerful, using these servers is optional. The SDKs can be configured to work with other update distribution and analytics mechanisms if preferred.

