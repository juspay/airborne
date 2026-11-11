---
title: Callbacks & Events
description: The callback concepts the Airborne SDK exposes and the full catalogue of lifecycle and error events delivered to onEvent.
---

The Airborne SDK reports its progress to your app through a set of callbacks and a stream of structured events. Use them to know when boot is ready, to monitor release health, and to react as lazy-downloaded files become available. The callbacks are the same on Android (`AirborneInterface`) and iOS (`AirborneDelegate`); see the [Android API](/docs/react-native-sdk/reference/android-api) and [iOS API](/docs/react-native-sdk/reference/ios-api) references for exact signatures.

## Callback concepts

**Boot completion** — the SDK signals that boot has finished and the bundle is ready. On native this is the `startApp` callback (`startApp(indexPath:)` on Android, `startApp(indexBundleURL:)` on iOS). In React Native, instead of a callback the SDK blocks the `getJSBundle` function until the bundle is resolved, so React Native naturally boots from the right path.

**Tracker callback** — the SDK delivers a series of events to the integrating app via `onEvent`. These let you monitor metrics across the release lifecycle and report errors. The full set is catalogued below.

**Lazy download callback** — the SDK reports when specific lazy-downloaded files become available for use. On Android this is the `LazyDownloadCallback` (`fileInstalled`, `lazySplitsInstalled`); on iOS it is the `onLazyPackageDownloadComplete` and `onAllLazyPackageDownloadsComplete` delegate methods.

## The onEvent payload

Every event delivered to `onEvent` carries the same set of fields:

- `category` — the broad category, e.g. `lifecycle`.
- `subCategory` — the subcategory, e.g. `hyperota` (`subcategory` on iOS).
- `level` — severity, e.g. `info` or `error`.
- `label` — a category label for the event, e.g. `ota_update`.
- `key` — the specific event identifier (e.g. `boot`).
- `value` — a structured payload whose shape depends on the event.

The sections below list each event with its payload exactly as the SDK emits it.

## Lifecycle events

### started

Fired when the SDK has started initialization.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "first_time_setup",
  key: "started",
  value: {}
}
```

### completed

Fired when the SDK has completed initialization.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "first_time_setup",
  key: "completed",
  value: {}
}
```

### init_with_local_config_versions

Fired if the SDK boots with the local config version.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "init_with_local_config_versions",
  value: { app_update_id: "<UUID>" }
}
```

### release_config_fetch

Fired on release config download completion.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "release_config_fetch",
  value: {
    release_config_url: "<url>",
    status: 200,
    time_taken: "<time_taken>",
    app_update_id: "<UUID>"
  }
}
```

### package_update_download_started

Fired when package download starts.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "package_update_download_started",
  value: {
    package_version: "v6",
    app_update_id: "<UUID>"
  }
}
```

### rc_version_updated

Fired when a new release config is loaded.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "rc_version_updated",
  value: {
    new_rc_version: "2",
    app_update_id: "<UUID>"
  }
}
```

### config_updated

Fired when a new config block is loaded.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "config_updated",
  value: { new_config_version: "v1", app_update_id: "<UUID>" }
}
```

### package_update_result

Fired on completion of package download.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "package_update_result",
  value: {
    result: "SUCCESS",
    package_version: "v6",
    time_taken: 282,
    app_update_id: "<UUID>"
  }
}
```

### updated_resources

Fired on completion of resource download.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "updated_resources",
  value: { resources: "[]", app_update_id: "<UUID>" }
}
```

### lazy_package_update_info

Fired on completion of lazy block download.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "lazy_package_update_info",
  value: { package_splits_download: "No updates in app", app_update_id: "<UUID>" }
}
```

### end

Fired on completion of all downloads.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "end",
  value: { time_taken: 319, app_update_id: "<UUID>" }
}
```

### boot

Fired on triggering the boot callback.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ApplicationManager",
  key: "boot",
  value: {
    release_config_version: "2",
    config_version: "v1",
    package_version: "v6",
    resource_versions: [],
    time_taken: 363
  }
}
```

## Boot guard events

Emitted only when the host opts in to the [boot guard](/docs/react-native-sdk/reference/javascript-api#boot-guard). The other payload fields follow the standard shape above.

### rollback

A package booted twice without `markBootSuccess` and is now blocked. This launch runs the last acknowledged package, or the bundled one.

```typescript
{ level: "info", key: "rollback", value: { packageVersion: "v7" } }
```

### blocked-package

The server still serves a blocked package. It is not installed. On iOS, `value.source` says where it was refused: `installed`, `staged`, `release_config` or `download`.

```typescript
{ level: "info", key: "blocked-package", value: { packageVersion: "v7" } }
```

### Guard diagnostics

The guard reports its own state changes and failures. None of them stop the app from booting.

| Platform | Key | Level | Meaning |
| --- | --- | --- | --- |
| Android | `boot_guard_error` | error | State could not be read or written, or a snapshot or last-good file failed. |
| Android | `boot_guard_info` | info | Informational, for example a snapshot skipped because a newer package was installed during the session. |
| iOS | `boot_guard_reset` | info | State discarded (`reason`: binary changed or guard turned off). |
| iOS | `boot_guard_unblocked` | info | A different server-delivered package was installed, so the block was lifted. |
| iOS | `boot_guard_snapshot_skipped` | info | No snapshot taken because a newer package was installed during the session. |
| iOS | `boot_guard_snapshot_failed`, `boot_guard_persist_failed`, `boot_guard_reset_failed` | error | Snapshot, state write or reset failed. The previous last-good package is kept. |

## Error events

### read_release_config_error

Fired when there is an error downloading the release config.

```typescript
{
  category: "lifecycle",
  subCategory: "hyperota",
  level: "error",
  label: "ApplicationManager",
  key: "read_release_config_error",
  value: { error: "<Stack trace>" }
}
```

## See also

- [Android API](/docs/react-native-sdk/reference/android-api) — `AirborneInterface.onEvent` and the lazy download callback.
- [iOS API](/docs/react-native-sdk/reference/ios-api) — `AirborneDelegate.onEvent` and the lazy package callbacks.
- [JavaScript API](/docs/react-native-sdk/reference/javascript-api) — reading the release config and bundle from JS.
