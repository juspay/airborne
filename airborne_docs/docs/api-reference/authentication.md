---
title: Authentication
description: How to obtain a bearer token for the Airborne API — the OIDC login flow, personal access tokens, and the Authorization header.
---

Every authenticated call carries a bearer token:

```
Authorization: Bearer <access_token>
```

The server validates the token as an OIDC JWT: it must be signed with RS256/384/512, verify against the provider's JWKS, and have the right audience (`OIDC_CLIENT_ID`) and issuer. The caller's identity is the (lowercased) `email` claim. Tokens expire; the allowed clock skew is `OIDC_CLOCK_SKEW_SECS` (default 60s). See [Authentication configuration](/docs/server/configuration#authentication--oidc).

There are three ways to obtain a token.

## 1. OIDC authorization-code flow (interactive)

This is what the dashboard uses. It is a two-step exchange around a browser redirect.

### Step 1 — get the authorization URL

```
GET /api/users/oauth/url
```

| Query param | Type | Required | Description |
| --- | --- | --- | --- |
| `offline` | boolean | No | Request a refresh token (offline access). |
| `idp` | string | No | Identity-provider hint (e.g. `google`). |

Response:

```json
{
  "auth_url": "https://<issuer>/authorize?...",
  "state": "<opaque-state>"
}
```

Redirect the user to `auth_url`. When [Redis is configured](/docs/server/configuration#redis), the server stores the PKCE verifier and nonce keyed by the `state` (10-minute, single-use).

### Step 2 — exchange the code

After the IdP redirects back to `{PUBLIC_ENDPOINT}/oauth/callback` with `code` and `state`, exchange them:

```
POST /api/users/oauth/login
```

```json
{ "code": "<authorization-code>", "state": "<state-from-step-1>" }
```

The response is a [`User`](#the-user-object) whose `user_token` holds the tokens.

:::note[Sign-up]
If the provider supports sign-up, `POST /api/users/oauth/signup` (same body) provisions a new user during the exchange. `POST /api/users/create` and `POST /api/users/login` are available only when the configured provider supports password login (the default OIDC providers do not).
:::

## 2. Personal access tokens (recommended for automation)

For scripts, CI, and the CLIs, mint a **personal access token** (PAT) once, then exchange its credentials for a live access token whenever you need one. The PAT is scoped to the user who created it and stores that user's refresh token encrypted with the client secret — the secret itself is never stored server-side, so it is shown only once.

1. **Create** the PAT (authenticated, org/app-scoped) — `POST /api/token`. Returns `client_id` (a UUID) and `client_secret`.
2. **Exchange** the credentials for a live token — `POST /api/token/issue` (public):

```
POST /api/token/issue
```

```json
{ "client_id": "<uuid>", "client_secret": "<secret>" }
```

The response is a [`UserToken`](#the-usertoken-object). This is the `PostLogin` operation in the Smithy contract, and it is what the CLIs use behind `--token`.

Create, list, and revoke personal access tokens from the dashboard — see [Access tokens](/docs/dashboard/access-tokens).

## 3. Current user

```
GET /api/users
```

Returns the authenticated caller's [`User`](#the-user-object) with the organisations they can access (`user_token` is omitted here). This is the `GetUser` Smithy operation.

## Objects

### The `User` object

| Field | Type | Description |
| --- | --- | --- |
| `user_id` | string | Stable user identifier. |
| `username` | string | Display / login name. |
| `organisations` | array | Organisations (and nested applications) the user can access. |
| `is_super_admin` | boolean | Whether the user is a platform super-admin. |
| `user_token` | object \| null | A [`UserToken`](#the-usertoken-object) on login/signup; `null` on `GET /api/users`. |

### The `UserToken` object

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | string | Bearer token for the `Authorization` header. |
| `token_type` | string | Token type (e.g. `Bearer`). |
| `expires_in` | integer | Access-token lifetime in seconds. |
| `refresh_token` | string | Refresh token. |
| `refresh_expires_in` | integer | Refresh-token lifetime in seconds. |

:::note[No logout endpoint]
There is no server-side logout. Clients simply discard the token; it becomes invalid at expiry.
:::
