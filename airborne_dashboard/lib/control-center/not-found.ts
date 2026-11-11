// Is this error the server saying a thing does not exist, as opposed to a read that failed?

const MISSING_CODES = ["release_not_found", "release_or_workspace_not_found"];

/**
 * True for a 404 from a release read. The server answers an unknown release id with 404 and a code of
 * `release_not_found` or `release_or_workspace_not_found` (an upstream 404 that does not say which). The page shows
 * "Release not found" for it, not a read failure with a Retry button: trying again cannot make the release exist.
 */
export function isReleaseNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; body?: unknown };
  const code = e.body && typeof e.body === "object" ? (e.body as { code?: unknown }).code : undefined;
  return e.status === 404 || (typeof code === "string" && MISSING_CODES.includes(code));
}
