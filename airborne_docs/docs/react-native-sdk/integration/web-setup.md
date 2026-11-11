---
title: Web setup
description: Boot a react-native-web app from Airborne so web releases use the same packages, targeting, and ramps as Android and iOS.
---

Airborne can deliver a `react-native-web` bundle with the same release config, targeting, and ramps used on Android and iOS. Create a **separate application** for web, because its bundle differs from the native ones.

## How the boot maps to native

| Native | Web |
| --- | --- |
| App binary | Host page plus the loader and the files deployed with it |
| `app_version` dimension | Version of that host page |
| Bundled release config | `bundled.releaseConfig` passed to `bootAirborne` |
| Downloaded package on disk | Cache Storage, one cache per package version |
| JS bundle path handed to React Native | Script injected from a `blob:` URL |

The rules are unchanged: a package is used only if its index and all important files arrive before `boot_timeout`. Otherwise the last good package boots and the download continues for the next session. Lazy files never block boot. Each resource is independent.

## Host page

The loader must run before your app, so build it into the host page rather than the OTA bundle:

```ts
import { bootAirborne } from 'airborne-react-native/web';
import bundledReleaseConfig from './release_config.json';

bootAirborne({
  releaseConfigUrl: 'https://airborne.example.com/release/<organisation>/<application>',
  namespace: '<application>',
  dimensions: { app_version: '1.0.0' },
  bundled: { releaseConfig: bundledReleaseConfig, baseUrl: '/bundled/' },
});
```

The bundle must be a **single classic script** that needs no other script chunks at startup.

## Server and storage

- Set `RELEASE_CORS_ALLOWED_ORIGINS` to your site's origin. CORS on `/release/*` is off by default.
- Allow your site's origin to `GET` files from the file bucket or CDN.
- If you use a Content-Security-Policy, add `blob:` to `script-src`.
- Serve the host page with a short cache lifetime so a new loader reaches users quickly.

## CLI

Use `-p web`. Web has no `react-native bundle` step, so the CLI runs `web.build_command` from `airborne-config.json` (default `npm run build:web`) with `AIRBORNE_OUTPUT_DIR` and `AIRBORNE_INDEX_FILE` set.

## JavaScript API

`readReleaseConfig`, `getFileContent`, and `getBundlePath` work as on native. `getBundlePath` returns a URL. Web also adds `getFileUrl(namespace, filePath)` for images.

## Differences from native

- Web requires a browser with Cache Storage, which is only available on secure origins and `localhost`. Checksum verification also needs a secure origin.
- Assets in Cache Storage can be evicted by the browser. An evicted package falls back to the bundled files.

## Opt-in boot recovery

Deploy the new loader in the host page and enable recovery there:

```ts
bootAirborne({
  // ...releaseConfigUrl, namespace, dimensions, bundled
  bootGuardEnabled: true,
  onEvent: event => console.log(event.type, event.packageVersion),
});
```

Call `markBootSuccess(namespace)` from `airborne-react-native` after the root has
rendered successfully. Enable only after your deployed OTA entry points include
this acknowledgement. The host loader and OTA bundle share durable namespace state.
A crashing script is tried twice; the third page launch falls back locally even if
the endpoint still selects the bad version. See the [JavaScript API](../reference/javascript-api.md#markbootsuccessnamespace-promisevoid)
for force-quit, post-render crash, storage, and multi-tab limits.
