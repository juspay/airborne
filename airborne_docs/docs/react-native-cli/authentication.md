---
title: Authentication
description: Authenticate the Airborne React Native CLI with client credentials and learn where the token is stored.
---

Before any workflow or resource command, you authenticate `airborne-devkit` with a **client ID** and **client secret**. The CLI exchanges them for an access token and stores it locally, so the rest of your commands run authenticated without re-entering credentials.

## Logging in

```bash
npx airborne-devkit login --client_id <client-id> --client_secret <client-secret> [directoryPath]
```

**Parameters:**

| Parameter         | Type   | Required | Description                                                     |
| ----------------- | ------ | -------- | --------------------------------------------------------------- |
| `--client_id`     | string | Yes      | Client ID provided by Airborne.                                 |
| `--client_secret` | string | Yes      | Client Secret provided by Airborne.                             |
| `[directoryPath]` | string | No       | Directory in which to store the auth tokens (defaults to the current directory). |

On success the CLI prints `Login successful` and writes the token to disk.

## Getting client credentials

Generate a client ID and client secret from the Airborne dashboard. See [access tokens in the dashboard](/docs/dashboard/access-tokens) for how to create and manage them.

In CI, pass them through environment variables rather than hard-coding them:

```bash
npx airborne-devkit login \
  --client_id "$AIRBORNE_CLIENT_ID" \
  --client_secret "$AIRBORNE_CLIENT_SECRET"
```

## Where the token is stored

After a successful login the CLI saves the access and refresh tokens to:

```
<directoryPath>/.airborne/credentials.json
```

where `<directoryPath>` is the directory you passed (or the current working directory by default). The file is written with restrictive permissions, and the CLI automatically appends `.airborne` to your project's `.gitignore` so credentials are never committed.

:::note
When the `CI` environment variable is set to `true`, the token is instead written to `/tmp/airborne_tokens.json`. This keeps automated pipelines from depending on a per-project `.airborne` directory.
:::

Subsequent `airborne-devkit` commands (both the workflow commands and the re-exposed [Core CLI](/docs/core-cli/command-reference) operations) automatically read this token and attach it to each request — you do not pass `--token` yourself.

:::caution
Treat your client credentials and the stored tokens as secrets. Do not share them or commit them to version control.
:::

## Re-authenticating

Tokens expire over time. If a command starts failing with an authentication or "please log in" error, simply run `login` again to refresh the stored token:

```bash
npx airborne-devkit login --client_id <client-id> --client_secret <client-secret>
```

This overwrites the existing `.airborne/credentials.json` with a fresh token.

## Next

- [Local configuration](/docs/react-native-cli/local-configuration)
- [Command reference](/docs/react-native-cli/command-reference)
