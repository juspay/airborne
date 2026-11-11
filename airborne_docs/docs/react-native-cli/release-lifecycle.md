---
title: Release Lifecycle
description: Ramp, conclude, discard and roll back a release by id with airborne-devkit, and what each refusal means.
---

After [`CreateRelease`](/docs/core-cli/command-reference#createrelease) a release serves no traffic until you ramp it. Four devkit commands run the rest of the lifecycle by release id:

- **`ramp-release`** — start a release and set the share of traffic that receives it.
- **`conclude-release`** — make the outcome permanent: promote the release or keep the previous one.
- **`discard-release`** — cancel a release that was never ramped.
- **`rollback-release`** — undo a release from any state.

They read the organisation and application from the `-p, --platform` section of `airborne-config.json` (like the other release commands), or from `--organisation` and `--application`, and take the token from [`login`](/docs/react-native-cli/authentication). Each one takes an optional `[directoryPath]` after the release id (default: the current directory). They print the server's response as JSON on success. On any refusal they print one line with the HTTP status, the error code and the message, and exit with status `1`.

```text
❌ Failed to conclude release: HTTP 409: AB_007: This release has already concluded or been discarded
```

The same operations are available under their Core CLI names (`RampRelease`, `ConcludeRelease`, `DiscardRelease`, `RollbackRelease`); see the [Core CLI command reference](/docs/core-cli/command-reference#release-lifecycle).

## ramp-release

```bash
# Start a created release at 10%
npx airborne-devkit ramp-release <releaseId> -p android --percentage 10

# Raise it, then pause it
npx airborne-devkit ramp-release <releaseId> -p android --percentage 25
npx airborne-devkit ramp-release <releaseId> -p android --percentage 0
```

| Parameter                     | Type    | Required | Description                                                          |
| ----------------------------- | ------- | -------- | -------------------------------------------------------------------- |
| `<releaseId>`                 | string  | Yes      | Id of the release, as returned by `CreateRelease`.                   |
| `--percentage <0-50>`         | integer | Yes      | Traffic percentage for the release.                                  |
| `-p, --platform <platform>`   | string  | Yes\*    | `android`, `ios` or `web`; selects the section of `airborne-config.json`. |
| `--organisation`, `--application` | string | Yes\*  | Use both instead of `--platform` to skip `airborne-config.json`.     |
| `-r, --reason <text>`         | string  | No       | Reason recorded upstream (197 bytes at most, no `Airborne operation`). |

\* Pass `--platform`, or both `--organisation` and `--application`.

The server validates the 0–50 range before dispatch and returns `400` for an out-of-range value without pausing writes. `ramp-release` also rejects values above 50 locally and sends nothing. Use [`conclude-release`](#conclude-release) to send everyone to the release.

## conclude-release

```bash
# Promote the release to everyone
npx airborne-devkit conclude-release <releaseId> -p android --variant release

# End it and keep the previous release live
npx airborne-devkit conclude-release <releaseId> -p android --variant control
```

`--variant release` and `--variant control` look up the variant ids the experiment service generated for this release (`experiment.experiment_variants` from `GetRelease`). You can also pass an exact id. The release must have been ramped first; concluding a release that is still `CREATED` returns `409`.

| Parameter                     | Type   | Required | Description                                                       |
| ----------------------------- | ------ | -------- | ----------------------------------------------------------------- |
| `<releaseId>`                 | string | Yes      | Id of the release.                                                |
| `--variant <release\|control\|id>` | string | Yes | Outcome to make permanent, or an exact variant id.                |
| `-p`, `--organisation`, `--application`, `-r, --reason` | | | As for `ramp-release`.                                |

## discard-release

```bash
npx airborne-devkit discard-release <releaseId> -p android
```

Only a release that was never ramped (`CREATED`) can be discarded. A ramped release has to be concluded on `control` or rolled back. Discarding never needs approval.

## rollback-release

```bash
npx airborne-devkit rollback-release <releaseId> -p android --reason "crash on launch"
```

A created release is discarded, a ramped release is concluded on its control variant, and a live release is replaced by a re-release of the previous live one. Check the outcome first with the Core CLI `GetControlCenterRollbackPreview` command, and see [`RollbackRelease`](/docs/core-cli/command-reference#rollbackrelease) for conflicts, partial failures and recovery.

| Parameter                     | Type    | Required | Description                                                     |
| ----------------------------- | ------- | -------- | --------------------------------------------------------------- |
| `-r, --reason <text>`         | string  | Yes      | Why the release is rolled back.                                 |
| `--emergency`                 | boolean | No       | Use the constrained emergency path; only a current checker can.  |
| `--confirm-sensitive-risk`    | boolean | No       | Required when the release is marked rollback-sensitive.          |

## When a command is refused

| Output                              | Meaning and next step                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `HTTP 403: approval_required`       | The application requires approvals. Raise a deployment request with `CreateControlCenterDeploymentRequest` instead of changing the release directly. |
| `HTTP 409: AB_007: …`               | The release is not in a state that allows this change. Read it with `GetRelease` before trying again.            |
| `HTTP 409: unresolved: … (operation <id>)` | An earlier write is unconfirmed and writes for the application are paused. Do not retry: review and resolve the operation as described under [`RollbackRelease`](/docs/core-cli/command-reference#rollbackrelease). |
| `HTTP 400: …`                       | The request itself is wrong, such as an unknown variant or a reserved text in `--reason`.                        |
| `404 release_not_found` / `502 upstream_*` / `503` / `504` | Missing releases return 404. Upstream failures return 502/503/504; inspect state before retrying a write. |
| `Not logged in`                     | Run `airborne-devkit login` in the same directory first.                                                         |

## Next

- [Core CLI command reference](/docs/core-cli/command-reference#release-lifecycle)
- [Create & target a release](/docs/guides/create-and-target-a-release)
- [Control Center server notes](/docs/server/control-center)
