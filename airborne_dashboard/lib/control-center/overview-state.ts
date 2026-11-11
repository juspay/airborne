import type { AppStatus } from "./types";

/** A successful release read does not establish that approvals or writes are safe. */
export function overviewStateWarning(app: Pick<AppStatus, "auxiliary_error"> | null | undefined): string | null {
  return app?.auxiliary_error != null
    ? "The state of approvals, reviews, serving policy and paused writes could not be read. Refresh before making changes."
    : null;
}

export function approvalStateReady(
  app: Pick<AppStatus, "auxiliary_error" | "approval_required"> | null | undefined,
  policyReady: boolean,
  policyError: boolean
): boolean {
  return Boolean(
    app &&
      app.auxiliary_error == null &&
      typeof app.approval_required === "boolean" &&
      (!app.approval_required || (policyReady && !policyError))
  );
}
