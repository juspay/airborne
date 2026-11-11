import type { ApiError, RollbackAction, RollbackBlocked, RollbackBlockedCode } from "./types";

/** What an unresolved-operation 409 tells the operator to check. Every field is optional: show only what the server sent. */
export interface UnresolvedDetails {
  operationId: string | null;
  workspace: string | null;
  /** The experiment (release) the unconfirmed write targeted. */
  targetReleaseId: string | null;
  expectedStatus: string | null;
  expectedTraffic: number | null;
  expectedChosenVariant: string | null;
  /** The unique marker the write put in its upstream change reason. */
  marker: string | null;
  beforeStatus: string | null;
  beforeTraffic: number | null;
  /** The statement the server offers for a database operator, after confirming the request was rejected. */
  ownAttempt: boolean;
}

interface Extras {
  /** Set when the failure happened after a replacement release was recorded or found. */
  replacementReleaseId: string | null;
  operationId: string | null;
  /** `rollback_chain` only: the release this one was created to roll back. */
  rollbackOf: string | null;
}

export type RollbackFailure =
  /** The rollback is refused and nothing changed. Not retryable until the cause is dealt with. */
  | ({
      kind: "blocked";
      code: Exclude<RollbackBlockedCode, "unresolved">;
      message: string;
      currentLiveReleaseId: string | null;
      /** `incompatible` only: the release itself is already discarded or concluded on control, so there is nothing to restore. */
      finished: boolean;
    } & Extras)
  /** A replacement was edited by someone else since the rollback began. Never resumed automatically. */
  | ({ kind: "replacement_changed"; message: string } & Extras)
  /** An upstream write's outcome is not confirmed: writes for the app are refused until it is. */
  | ({ kind: "unresolved"; message: string; details: UnresolvedDetails } & Extras)
  /** A replacement may exist but a later step failed. Retrying resumes. */
  | ({ kind: "partial"; message: string; stage: string } & Extras)
  /** No usable answer (network error or a bare 5xx). Retrying is safe: a completed rollback is returned as recorded. */
  | { kind: "unknown"; message: string }
  | { kind: "other"; message: string };

const BLOCK_CODES: ReadonlySet<string> = new Set([
  "superseded",
  "ongoing",
  "no_predecessor",
  "incompatible",
  "artifact_verification_unknown",
  "missing_files",
  "rollback_chain",
]);

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function unresolvedDetails(body: Record<string, unknown>): UnresolvedDetails {
  const expected = obj(body.expected);
  const before = obj(body.before);
  return {
    operationId: str(body.operation_id),
    workspace: str(body.upstream_workspace),
    targetReleaseId: str(expected.id) ?? str(before.id),
    expectedStatus: str(expected.status),
    expectedTraffic: num(expected.traffic_percentage),
    expectedChosenVariant: str(expected.chosen_variant),
    marker: str(expected.change_reason),
    beforeStatus: str(before.status),
    beforeTraffic: num(before.traffic_percentage),
    ownAttempt: body.own_attempt === true,
  };
}

/** Reads the structured fields the rollback endpoints add to their error bodies. */
export function classifyRollbackError(error: unknown): RollbackFailure | null {
  if (!error) return null;
  const e = error as ApiError;
  const message = e instanceof Error ? e.message : String(error);
  const body = obj(e.body);
  const code = str(body.code);
  const extras: Extras = {
    replacementReleaseId: str(body.replacement_release_id),
    operationId: str(body.rollback_operation_id) ?? str(body.operation_id),
    rollbackOf: str(body.rollback_of),
  };

  if (code === "unresolved") {
    return { kind: "unresolved", message, details: unresolvedDetails(body), ...extras };
  }
  if (code === "replacement_changed") return { kind: "replacement_changed", message, ...extras };

  const live = str(body.current_live_release_id);
  if (code && BLOCK_CODES.has(code)) {
    return {
      kind: "blocked",
      code: code as Exclude<RollbackBlockedCode, "unresolved">,
      message,
      currentLiveReleaseId: live,
      // A genuine incompatibility is a 422; the server answers 409 when the release is already finished.
      finished: code === "incompatible" && e.status === 409,
      ...extras,
    };
  }
  // A stale 409 from a server that sends the live release without a code.
  if (e.status === 409 && live) {
    return { kind: "blocked", code: "superseded", message, currentLiveReleaseId: live, finished: false, ...extras };
  }
  if (
    (e.status === 502 || e.status === 409) &&
    str(body.stage) &&
    body.stage !== "completed" &&
    body.operation_state !== "completed"
  ) {
    return { kind: "partial", message, stage: str(body.stage) as string, ...extras };
  }
  if (e.status === undefined || e.status >= 500) return { kind: "unknown", message };
  return { kind: "other", message };
}

/** The preview's `blocked` object, in the same shape a failed POST produces, so one component explains both. */
export function failureFromBlocked(
  blocked: RollbackBlocked | null | undefined,
  action: RollbackAction | null,
  rollbackOf?: string | null
): RollbackFailure | null {
  if (!blocked) return null;
  const extras: Extras = {
    replacementReleaseId: str(blocked.replacement_release_id),
    operationId: str(blocked.operation_id),
    rollbackOf: str(rollbackOf),
  };
  const message = blocked.message || "The rollback is blocked.";
  if (blocked.code === "unresolved") {
    return {
      kind: "unresolved",
      message,
      // The preview carries the operation id and message only; the full diagnostics come with a write's 409.
      details: {
        operationId: extras.operationId,
        workspace: null,
        targetReleaseId: null,
        expectedStatus: null,
        expectedTraffic: null,
        expectedChosenVariant: null,
        marker: null,
        beforeStatus: null,
        beforeTraffic: null,
        ownAttempt: false,
      },
      ...extras,
    };
  }
  // The preview enum has no "replacement_changed": the server reports it as incompatible plus the replacement's id.
  if (blocked.code === "incompatible" && extras.replacementReleaseId) {
    return { kind: "replacement_changed", message, ...extras };
  }
  return {
    kind: "blocked",
    code: blocked.code,
    message,
    currentLiveReleaseId: str(blocked.current_live_release_id),
    // No action means the release has no rollback at all (discarded or concluded on control).
    finished: blocked.code === "incompatible" && action === null,
    ...extras,
  };
}

/** Failures after which the same request must not be sent again until something else changes. */
export function isTerminalFailure(f: RollbackFailure | null): boolean {
  return f?.kind === "blocked" || f?.kind === "replacement_changed" || f?.kind === "unresolved";
}

/**
 * A `502 cache_invalidation_failed` after a write. The deployment itself may well have committed: the
 * server says so with `mutation_may_have_committed`. The caller must re-read state and offer a cache-only retry.
 */
export interface CacheInvalidationFailure {
  message: string;
  failedPaths: string[];
  mutationMayHaveCommitted: boolean;
}

export function classifyCacheError(error: unknown): CacheInvalidationFailure | null {
  if (!error) return null;
  const e = error as ApiError;
  const body = obj(e.body);
  if (str(body.code) !== "cache_invalidation_failed") return null;
  const paths = Array.isArray(body.failed_paths)
    ? body.failed_paths.filter((p): p is string => typeof p === "string")
    : [];
  return {
    message: e instanceof Error ? e.message : String(error),
    failedPaths: paths,
    mutationMayHaveCommitted: body.mutation_may_have_committed === true,
  };
}
