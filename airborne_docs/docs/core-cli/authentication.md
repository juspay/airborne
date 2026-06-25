---
title: Authentication
description: Obtain a bearer token with PostLogin and pass it to Core CLI commands via the --token parameter.
---

The Airborne Core CLI authenticates with a **bearer token**. You obtain the token by exchanging a client ID and client secret through the `PostLogin` command, then supply that token to every other operation via the `--token` parameter.

:::note
Run [`configure --base-url`](/core-cli/getting-started#configure-the-api-base-url) before authenticating, so the CLI knows which Airborne API to talk to.
:::

## Getting client credentials

Generate a client ID and client secret from the Airborne dashboard. See [access tokens in the dashboard](/dashboard/access-tokens) for how to create and manage them.

## Obtaining a token with PostLogin

```bash
airborne-core-cli PostLogin --client_id <client-id> --client_secret <client-secret>
```

**Parameters:**

| Parameter         | Type   | Required | Description                       |
| ----------------- | ------ | -------- | --------------------------------- |
| `--client_id`     | string | Yes      | Client ID provided by Airborne.   |
| `--client_secret` | string | Yes      | Client Secret provided by Airborne. |

On success, `PostLogin` returns a JSON response containing an access token (and a refresh token). Copy the access token value — you pass it to other commands as `--token`.

You can also supply the credentials through a JSON parameters file:

```bash
airborne-core-cli PostLogin @login.json
```

Where `login.json` contains:

```json
{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

:::note
Unlike the [React Native CLI](/react-native-cli/authentication), the Core CLI does not persist the token to disk for you. `PostLogin` returns the token; capturing and reusing it is up to you. The React Native CLI's `login` command wraps this same operation and stores the result automatically.
:::

## Using the token

Pass the access token to any authenticated operation with `--token`:

```bash
airborne-core-cli ListOrganisations --token <access-token>

airborne-core-cli CreateApplication \
  --application myapp \
  --organisation myorg \
  --token <access-token>
```

The `--token` parameter is **required** on every operation except `PostLogin` and `configure`. You can also include it in a JSON parameters file:

```json
{
  "organisation": "myorg",
  "application": "myapp",
  "token": "your_access_token_here"
}
```

In scripts, capture the token into an environment variable and reference it:

```bash
airborne-core-cli ListReleases \
  --organisation myorg \
  --application myapp \
  --token "$AIRBORNE_TOKEN"
```

:::caution
Treat the access token and your client credentials as secrets. Do not commit them to version control; prefer environment variables or a secure secret store in CI.
:::

## Next

- [Command reference](/core-cli/command-reference)
