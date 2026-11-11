// Access-token expiry and server auth failures, in words a person can act on.
// Pure functions: no file or network access, so they can be tested directly.

const LOGIN = "airborne-devkit login --client_id <client id> --client_secret <client secret>";

// When the stored access token stops working: the recorded expiry, else the JWT's own exp claim, else unknown.
export function tokenExpiry(credentials) {
  if (credentials?.expires_at) {
    const at = Date.parse(credentials.expires_at);
    if (!Number.isNaN(at)) return at;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(String(credentials?.access_token).split(".")[1], "base64url").toString("utf8")
    );
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // Not a JWT; the server will say if it rejects it.
  }
  return null;
}

export function expiredMessage(expiredAt) {
  const when = expiredAt ? ` (it expired at ${new Date(expiredAt).toISOString()})` : "";
  return (
    `Your Airborne access token has expired${when}. Access tokens are short-lived and the CLI does not store your client secret, so log in again:\n` +
    `  ${LOGIN}\n` +
    "Use the access token created for this organisation and application; a token for another application is rejected."
  );
}

// Returns the access token, or throws a message saying how to get one.
export function checkToken(credentials, now = Date.now()) {
  if (!credentials?.access_token) {
    throw new Error(`Not logged in. Create an access token in the dashboard, then run:\n  ${LOGIN}`);
  }
  const expiry = tokenExpiry(credentials);
  if (expiry !== null && expiry <= now) throw new Error(expiredMessage(expiry));
  return credentials.access_token;
}

// True when a server or SDK message means the bearer token was rejected.
export function isAuthFailure(message) {
  return /ExpiredSignature|token (has )?expired|jwt expired|HTTP 401|\b401\b.*unauthori|Failed to verify OIDC token/i.test(String(message));
}

// Replace a raw rejection with a login instruction; leave every other message alone.
export function explainAuthFailure(message) {
  const text = String(message?.message ?? message);
  if (/^(Publish stopped|Your Airborne access token|Not logged in|The server rejected the access token)/.test(text)) return text;
  if (/ExpiredSignature|expired/i.test(text) && isAuthFailure(text)) return expiredMessage(null);
  if (isAuthFailure(text)) {
    return `The server rejected the access token: ${text}\nLog in again with the token created for this organisation and application:\n  ${LOGIN}`;
  }
  return text;
}
