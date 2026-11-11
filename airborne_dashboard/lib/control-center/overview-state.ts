import type { AppStatus } from "./types";

/** A successful release read does not establish that approvals or writes are safe. */
export function overviewStateWarning(app: Pick<AppStatus, "auxiliary_error"> | null | undefined): string | null {
  return app?.auxiliary_error != null
    ? "The state of approvals, reviews, serving policy and paused writes could not be read. Refresh before making changes."
    : null;
}
