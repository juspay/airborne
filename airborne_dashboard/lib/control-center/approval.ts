// Maker-checker helpers. Nothing here enforces anything: the server decides on every write, and the UI
// reads these only to label buttons and to explain the server's answers in its own words.

import type {
  ApiError,
  AppStatus,
  ApprovalPolicy,
  BaseStateRelease,
  DeploymentAction,
  DeploymentRequest,
  DeploymentRequestStatus,
  DimensionContext,
  ReleaseProtection,
  RollbackSensitiveReason,
} from "./types";
import { classifyRollbackError, type RollbackFailure } from "./rollback-error";
import type { Tone } from "@/components/control-center/status-badge";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** What the request would do, as a noun. */
export function actionLabel(action: DeploymentAction | string): string {
  switch (action) {
    case "create":
      return "Release";
    case "ramp":
      return "Target change";
    case "conclude":
      return "Make live";
    case "update":
      return "Override edit";
    case "rollback":
      return "Rollback";
    case "discard":
      return "Discard";
    case "set_rollback_sensitive":
      return "Rollback-sensitive marker";
    case "set_strict_serving":
      return "Strict serving";
    default:
      return action;
  }
}

/** The button wording when the policy is on. Direct actions keep their own labels. */
export function requestButtonLabel(action: DeploymentAction, releaseStatus?: string): string {
  switch (action) {
    case "create":
      return "Request release";
    case "ramp":
      return releaseStatus === "CREATED" ? "Request rollout start" : "Request target change";
    case "conclude":
      return "Request make live";
    case "rollback":
      return "Request rollback";
    case "update":
      return "Request override edit";
    case "discard":
      return "Request discard";
    case "set_rollback_sensitive":
      return "Request marker change";
    case "set_strict_serving":
      return "Request serving change";
  }
}

export function requestStatusLabel(status: DeploymentRequestStatus | string): string {
  switch (status) {
    case "pending":
      return "Awaiting approval";
    case "executing":
      return "Executing";
    case "executed":
      return "Approved and executed";
    case "failed":
      return "Approved, execution failed";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "stale":
      return "Stale";
    default:
      return status;
  }
}

export function requestStatusTone(status: DeploymentRequestStatus | string): Tone {
  switch (status) {
    case "pending":
      return "approval";
    case "executing":
      return "rolling";
    case "executed":
      return "live";
    case "failed":
      return "danger";
    case "stale":
    case "expired":
      return "waiting";
    default:
      return "muted";
  }
}

export function isOpenRequest(status: DeploymentRequestStatus | string): boolean {
  return status === "pending" || status === "executing";
}

export function sensitivityLabel(reason: RollbackSensitiveReason | string): string {
  switch (reason) {
    case "security":
      return "security fix";
    case "one_way_migration":
      return "one-way migration";
    default:
      return reason;
  }
}

/** Why moving users off a sensitive release is protected. From MAKER-CHECKER-TRADEOFFS.md. */
export function sensitivityConsequence(reason: RollbackSensitiveReason | string): string {
  switch (reason) {
    case "security":
      return "sends users back to the vulnerable version it fixed";
    case "one_way_migration":
      return "can leave devices running code that cannot read their migrated data";
    default:
      return "may be unsafe for users already on it";
  }
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface PolicyProblem {
  field: "makers" | "checkers" | "request_ttl_hours" | "pairing";
  message: string;
}

/**
 * The server's enabling rule, so the editor can explain a refusal before sending it. The server's own
 * wording for the whole rule is "Each maker needs a different checker; at least two distinct people required".
 */
export function validatePolicy(p: ApprovalPolicy): PolicyProblem[] {
  const problems: PolicyProblem[] = [];
  if (!Number.isInteger(p.request_ttl_hours) || p.request_ttl_hours < 1 || p.request_ttl_hours > 720) {
    problems.push({ field: "request_ttl_hours", message: "Requests must expire after 1 to 720 hours." });
  }
  if (!p.enabled) return problems;
  if (p.makers.length === 0) problems.push({ field: "makers", message: "Add at least one maker." });
  if (p.checkers.length === 0) problems.push({ field: "checkers", message: "Add at least one checker." });
  if (p.emergency_rollback && new Set(p.checkers).size < 2) {
    problems.push({ field: "checkers", message: "Emergency rollback requires two different checkers." });
  }
  const people = new Set([...p.makers, ...p.checkers]);
  if (people.size < 2) {
    problems.push({ field: "pairing", message: "At least two distinct people are required." });
  }
  const stuck = p.makers.filter((m) => !p.checkers.some((c) => c !== m));
  if (people.size >= 2 && stuck.length > 0) {
    problems.push({
      field: "pairing",
      message: `${stuck.join(", ")} could never get a request approved: every checker is that same person. Each maker needs a different checker.`,
    });
  }
  return problems;
}

export function isMaker(policy: ApprovalPolicy | undefined, me: string | null): boolean {
  return Boolean(policy?.enabled && me && policy.makers.includes(me));
}

export function isChecker(policy: ApprovalPolicy | undefined, me: string | null): boolean {
  return Boolean(policy?.enabled && me && policy.checkers.includes(me));
}

/** What changed between two policies, for the disable warning and the timeline. */
export function describePolicyChange(before: Partial<ApprovalPolicy> | null, after: Partial<ApprovalPolicy>): string[] {
  const bits: string[] = [];
  if ((before?.enabled ?? false) !== (after.enabled ?? false)) {
    bits.push(after.enabled ? "approval turned on" : "approval turned off");
  }
  const diff = (label: string, a: string[] = [], b: string[] = []) => {
    const added = b.filter((x) => !a.includes(x));
    const removed = a.filter((x) => !b.includes(x));
    if (added.length) bits.push(`${label} added: ${added.join(", ")}`);
    if (removed.length) bits.push(`${label} removed: ${removed.join(", ")}`);
  };
  diff("makers", before?.makers, after.makers);
  diff("checkers", before?.checkers, after.checkers);
  if (before?.request_ttl_hours !== undefined && before.request_ttl_hours !== after.request_ttl_hours) {
    bits.push(`expiry ${before.request_ttl_hours}h → ${after.request_ttl_hours}h`);
  }
  if (before?.emergency_rollback !== undefined && before.emergency_rollback !== after.emergency_rollback) {
    bits.push(after.emergency_rollback ? "emergency rollback allowed" : "emergency rollback turned off");
  }
  return bits;
}

// ---------------------------------------------------------------------------
// Which actions need a request. Mirrors the server's `needs_approval`; the server's answer wins.
// ---------------------------------------------------------------------------

export function protectionFor(
  app: AppStatus | undefined,
  releaseId: string
): RollbackSensitiveReason | null | undefined {
  if (app?.release_protections == null) return undefined;
  const p: ReleaseProtection | undefined = app?.release_protections?.find((x) => x.release_id === releaseId);
  return p?.rollback_sensitive ?? null;
}

/** Unknown marker state requires explicit acceptance, just like a known marker. */
export function requiresEmergencyRiskAcceptance(marker: RollbackSensitiveReason | null | undefined): boolean {
  return marker !== null;
}

/** The spec's table. Discard never needs approval; lowering a target does only on a sensitive release. */
export function needsApproval(
  action: DeploymentAction,
  releaseStatus: string,
  currentTarget: number,
  newTarget: number,
  sensitive: boolean
): boolean {
  switch (action) {
    case "discard":
      return false;
    case "ramp":
      return newTarget > currentTarget || sensitive;
    case "rollback":
      return releaseStatus === "CONCLUDED" || (releaseStatus !== "CREATED" && sensitive);
    default:
      return true;
  }
}

/**
 * The release permission the server checks on whoever decides a request of this kind (`permission_action`), whether
 * they approve, reject or cancel it. Rollback and make-live share conclude; the marker and strict serving are updates.
 */
export function permissionForAction(
  action: DeploymentAction | string
): "create" | "update" | "ramp" | "discard" | "conclude" {
  switch (action) {
    case "create":
      return "create";
    case "update":
    case "set_rollback_sensitive":
    case "set_strict_serving":
      return "update";
    case "ramp":
      return "ramp";
    case "discard":
      return "discard";
    default:
      return "conclude";
  }
}

/**
 * True when no target the ramp dialog can offer would be applied directly, so a non-maker has nothing to do there.
 * A start (from CREATED, every target is above the current 0%) and a sensitive release always need a request; on
 * anything else, lowering the target is direct and has no maker check on the server.
 */
export function everyRampTargetNeedsRequest(policyOn: boolean, releaseStatus: string, sensitive: boolean): boolean {
  return policyOn && (releaseStatus === "CREATED" || sensitive);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The release this request is about, as it was when the request was raised. */
export function baseRelease(req: DeploymentRequest): BaseStateRelease | undefined {
  const id = req.payload.release_id;
  if (!id) return undefined;
  return req.base_state?.releases?.find((r) => r.id === id);
}

/** The package version the request concerns, if it can be read from the request itself. */
/** The package a request concerns. The server states it on the request; a create's snapshot also carries it. */
/**
 * Whether approving this request sends the release to more devices than it reaches now. Making live always does;
 * a ramp does when its target is above the one it was raised against. An unreadable target is treated as raising,
 * because the cost of reading it that way is one extra tick.
 */
export function raisesExposure(req: DeploymentRequest): boolean {
  if (req.action === "conclude") return true;
  if (req.action !== "ramp") return false;
  const target = num(req.payload.body?.traffic_percentage);
  const base = num(baseRelease(req)?.traffic_percentage);
  if (target === null) return true;
  return base === null ? target > 0 : target > base;
}

export function requestPackageVersion(req: DeploymentRequest): number | null {
  const snap = (req.payload.snapshot ?? {}) as Record<string, unknown>;
  const pkg = snap.package as Record<string, unknown> | undefined;
  return num(req.package_version) ?? num(pkg?.version) ?? null;
}

/** The reach (dimension context) of the release a request was raised against. The server calls it `context`. */
export function requestDimensions(req: DeploymentRequest): DimensionContext {
  const base = baseRelease(req);
  const fromBase = base?.dimensions ?? obj(base?.context);
  const fromBody = obj(req.payload.body?.dimensions);
  return ((Object.keys(obj(fromBase)).length > 0 ? fromBase : fromBody) ?? {}) as DimensionContext;
}

/** One line a checker can scan in the queue: what exactly would change. */
export function summariseRequest(req: DeploymentRequest): string {
  const body = req.payload.body ?? {};
  const base = baseRelease(req);
  const v = requestPackageVersion(req);
  const vLabel = v !== null ? `v${v}` : "release";
  switch (req.action) {
    case "ramp": {
      const target = num(body.traffic_percentage);
      const current = num(base?.traffic_percentage);
      if (target === null) return `${vLabel}: change rollout target`;
      if (current === null) return `${vLabel}: rollout target to ${target}%`;
      return `${vLabel}: rollout target ${current}% → ${target}%`;
    }
    case "conclude":
      return `${vLabel}: make live for everyone in reach`;
    case "create": {
      const pkgId = str(body.package_id);
      return `new release${v !== null ? ` of v${v}` : pkgId ? ` of ${pkgId}` : ""}`;
    }
    case "update":
      return `${vLabel}: edit overrides`;
    case "rollback":
      return `${vLabel}: roll back to the previous release`;
    case "discard":
      return `${vLabel}: discard before start`;
    case "set_rollback_sensitive": {
      const marker = body.rollback_sensitive;
      return marker
        ? `${vLabel}: mark as ${sensitivityLabel(String(marker))}`
        : `${vLabel}: clear rollback-sensitive marker`;
    }
    case "set_strict_serving":
      return body.strict === true ? "turn strict serving on" : "turn strict serving off";
    default:
      return req.action;
  }
}

export function isExpired(req: DeploymentRequest, now: Date = new Date()): boolean {
  const t = new Date(req.expires_at).getTime();
  return Number.isFinite(t) && t <= now.getTime();
}

export function isMine(req: DeploymentRequest, me: string | null): boolean {
  return Boolean(me) && req.requester === me;
}

// ---------------------------------------------------------------------------
// Errors. Each kind gets a truthful sentence; the server's own message is always shown too.
// ---------------------------------------------------------------------------

export type ApprovalFailure =
  /** A direct action the server now requires a request for. */
  | { kind: "approval_required"; message: string; application: string | null }
  | { kind: "self_approval"; message: string }
  | { kind: "stale"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "not_pending"; message: string }
  | { kind: "tampered"; message: string }
  | { kind: "not_checker"; message: string }
  | { kind: "not_maker"; message: string }
  | { kind: "not_requester"; message: string }
  | { kind: "reason_required"; message: string }
  | { kind: "unresolved"; message: string; failure: Extract<RollbackFailure, { kind: "unresolved" }> }
  | { kind: "forbidden"; message: string }
  /** The approval was recorded and the action itself failed: the request is now `failed`. */
  | { kind: "execution_failed"; message: string; requestId?: string }
  /** The request was re-read and is `executed`: the change was applied although this call reported an error. */
  | { kind: "already_executed"; message: string }
  | { kind: "not_found"; message: string }
  /**
   * A decide that returned an error we cannot place (an upstream 5xx, a lost response). The server may have decided
   * nothing, or may have approved and executed. Only a re-read of the request can say which.
   */
  | { kind: "unconfirmed"; message: string; status: number | undefined }
  | { kind: "other"; message: string; status: number | undefined };

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function classifyApprovalError(
  error: unknown,
  phase: "raise" | "decide" | "direct" = "decide"
): ApprovalFailure {
  const e = error as ApiError;
  const body = obj(e?.body);
  const serverMessage = str(body.message) ?? (e instanceof Error ? e.message : String(error));
  const message = serverMessage;
  const status = e?.status;
  const code = str(body.code);
  const lower = message.toLowerCase();

  if (code === "approval_required" || (status === 403 && lower.includes("approval required"))) {
    return { kind: "approval_required", message, application: str(body.application) };
  }
  const rb = classifyRollbackError(error);
  if (rb?.kind === "unresolved") return { kind: "unresolved", message, failure: rb };

  // The action failed after the approval was recorded. The server sends this only once it has saved the request as
  // `failed`, and keeps the action's own HTTP status, so the status says nothing about what happened to the request:
  // the code and `request_status` do. No re-read is needed to know.
  if (code === "execution_failed" && str(body.request_status) === "failed") {
    return { kind: "execution_failed", message, requestId: str(body.request_id) ?? undefined };
  }
  // The server's own code for each refusal (`maker_checker.rs`, `coded`). It is authoritative whatever the status.
  const coded = code && Object.prototype.hasOwnProperty.call(DECIDE_CODES, code) ? DECIDE_CODES[code] : undefined;
  if (coded) return { kind: coded, message } as ApprovalFailure;

  // Servers that predate the codes: the wording for each refusal, with the status it is sent with. A phrase only
  // counts under its own status, so an upstream error that happens to say "stale" is not read as a refusal.
  for (const [kind, statuses, phrases] of DECIDE_PHRASES) {
    if (status !== undefined && statuses.includes(status) && phrases.some((p) => lower.includes(p))) {
      return { kind, message } as ApprovalFailure;
    }
  }
  if (status === 403) return { kind: "forbidden", message };
  if (phase === "decide") {
    if (status === 404) return { kind: "not_found", message };
    // Anything else on a decide (a 5xx, a timeout, an unknown 4xx): it may have changed nothing, or the approval may
    // have run. Do not say which; the caller re-reads the request and uses `reconcileDecision`.
    return { kind: "unconfirmed", message, status };
  }
  return { kind: "other", message, status };
}

type PhraseKind = Exclude<
  ApprovalFailure["kind"],
  "approval_required" | "unresolved" | "forbidden" | "execution_failed" | "already_executed" | "unconfirmed" | "other"
>;

/** The `code` the server sends with each decide, acknowledge and create-request refusal. The helper test checks them against the server source. */
export const DECIDE_CODES: Readonly<Record<string, PhraseKind>> = {
  self_approval: "self_approval",
  request_stale: "stale",
  request_expired: "expired",
  not_pending: "not_pending",
  hash_mismatch: "tampered",
  not_checker: "not_checker",
  not_maker: "not_maker",
  not_requester: "not_requester",
};

/** Only for servers that send no `code`. Exported so the helper test can check every phrase against the server source. */
export const DECIDE_PHRASES: ReadonlyArray<readonly [PhraseKind, readonly number[], readonly string[]]> = [
  ["self_approval", [403], ["own request"]],
  ["stale", [409], ["request stale"]],
  ["expired", [409], ["request expired"]],
  ["not_pending", [409], ["no longer pending"]],
  ["tampered", [409], ["hash mismatch"]],
  ["not_checker", [403], ["checker membership"]],
  ["not_maker", [403], ["maker membership", "eligible maker"]],
  ["not_requester", [403], ["only requester"]],
  ["reason_required", [400], ["reason required"]],
  ["not_found", [404], ["request not found", "unknown decision"]],
];

/**
 * After a decide failed with an error the server did not code (an upstream 5xx, a lost response), the request was
 * re-read. `before` is the request as the dialog opened it. A request that is now `failed` (and was not before this
 * attempt) is the one case where "approved, but the action failed" is true; one that is now `executed` was applied
 * despite the error. Anything else stays as classified. An `execution_failed` code already says it and is left alone.
 */
export function reconcileDecision(
  failure: ApprovalFailure,
  before: Pick<DeploymentRequest, "status" | "updated_at">,
  current: Pick<DeploymentRequest, "status" | "updated_at">
): ApprovalFailure {
  if (failure.kind !== "unconfirmed" && failure.kind !== "other") return failure;
  const moved = current.status !== before.status || current.updated_at !== before.updated_at;
  if (!moved) return failure;
  if (current.status === "failed") return { kind: "execution_failed", message: failure.message };
  if (current.status === "executed") return { kind: "already_executed", message: failure.message };
  return failure;
}

export { isUnconfirmedWrite } from "./write-outcome";

/** The user-facing sentence for each failure, before the server's own words. */
export function describeApprovalFailure(f: ApprovalFailure, context: { action?: string } = {}): string {
  switch (f.kind) {
    case "approval_required":
      return `The server requires approval for this change${f.application ? ` in ${f.application}` : ""}. Nothing was changed. Raise a request instead; a different checker then approves it.`;
    case "self_approval":
      return "You raised this, so a different checker must approve it. Nothing was changed.";
    case "stale":
      return "The live or active state has changed since this request was raised, so the server marked it stale and refused to execute it. Nothing was changed. Raise a new request against the current state.";
    case "expired":
      return "This request expired before it was approved. The server marked it expired and nothing was changed. Raise a new request if the change is still wanted.";
    case "not_pending":
      return "This request has already been decided, so it cannot be decided again. Reload to see its current state. A failed execution can be approved again by a different checker once the cause is dealt with.";
    case "tampered":
      return "The request's content does not match the hash recorded when it was raised, so the server refused it. Nothing was changed.";
    case "not_checker":
      return "You are not a checker for this application under the current policy, so you cannot decide this request.";
    case "not_maker":
      return "The requester is no longer a maker for this application, so the request cannot be approved. Nothing was changed.";
    case "not_requester":
      return "Only the person who raised a request can cancel it. A checker can reject it instead.";
    case "reason_required":
      return "A reason is required.";
    case "unresolved":
      return "Release writes for this application are paused because an earlier change has an unconfirmed outcome. The request stays as it is until that is resolved.";
    case "forbidden":
      return "The server refused this: you do not have the permission it requires.";
    case "execution_failed":
      return `The approval was recorded, but the ${context.action ?? "action"} itself failed, so the request is now marked failed. It will not be retried on its own; once the cause is dealt with, a different checker can approve it again.`;
    case "already_executed":
      return "The request now reads as executed: the change was applied even though this call reported an error. Do not approve it again. Check the release to confirm.";
    case "not_found":
      return "The server could not find this request. It may have been removed, or it belongs to another application. Reload to see what is there.";
    case "unconfirmed":
      return `The server answered with an error${f.status ? ` (HTTP ${f.status})` : " or did not answer"}, and the outcome is not confirmed: the request may still be pending, or the change may have run. The request is being re-read. Check its status before trying again; an approved request cannot be approved twice.`;
    case "other":
      return f.status !== undefined && f.status >= 400 && f.status < 500
        ? "The server refused this. Nothing was changed."
        : "The server did not confirm the outcome. Re-read the current state before trying again.";
  }
}

// ---------------------------------------------------------------------------
// Emergency reviews
// ---------------------------------------------------------------------------

/**
 * The package an emergency rollback restored. The server writes a review only after the rollback has finished, and
 * says so with `rollback_finished: true` and the package it restored to. A review without that flag (one written by
 * an older server, which recorded it before the rollback ran) does not say whether anything happened: its `plan` is
 * only what was intended.
 */
export function emergencyRestoredVersion(review: {
  rollback_finished?: unknown;
  rolled_back_to_package_version?: unknown;
  plan?: { resulting_package_version?: unknown } | null;
}): { version: number | null; confirmed: boolean; finished: boolean } {
  const finished = review.rollback_finished === true;
  const done = finished ? num(review.rolled_back_to_package_version) : null;
  if (finished) return { version: done, confirmed: done !== null, finished };
  return { version: num(review.plan?.resulting_package_version), confirmed: false, finished };
}

/**
 * While a policy is enabled the server refuses dimension, cohort, file-tag, property and build writes with
 * `approval_required`, and there is no request action for them. The server's text tells the caller to raise a request,
 * which cannot be done for these writes, so the pages say what is actually true.
 */
export function frozenWriteNotice(error: unknown): { title: string; description: string } | null {
  if (classifyApprovalError(error, "direct").kind !== "approval_required") return null;
  return {
    title: "Frozen while approval is on",
    description:
      "This application requires approval, and dimension, cohort and targeting changes cannot be raised as requests. An organisation owner or admin has to turn approval off to change them, then back on.",
  };
}

/**
 * Whether the button to acknowledge an emergency rollback should be enabled. The server asks for checker membership
 * and nothing else (not that the policy is still enabled, not the conclude permission), so that is all this asks. If
 * the policy could not be read the button stays enabled and the server decides.
 */
export function canAcknowledgeEmergency(
  policy: Pick<ApprovalPolicy, "checkers"> | undefined,
  me: string | null,
  policyUnreadable = false
): boolean {
  if (!me) return false;
  if (!policy) return policyUnreadable;
  return policy.checkers.includes(me);
}

/**
 * A successful emergency creates a review; this 409 proves a review is still pending.
 * Failed or interrupted attempts create no review and may be resumed.
 */
export function isEmergencyReviewPending(error: unknown): boolean {
  const e = error as ApiError | undefined;
  const message = str(obj(e?.body).message) ?? (e instanceof Error ? e.message : "");
  return e?.status === 409 && message.toLowerCase().includes("previous emergency still needs");
}

export type AcknowledgeFailure =
  /** 404: nobody has an unacknowledged emergency on this release any more, usually because someone else acknowledged. */
  | { kind: "gone"; message: string }
  | { kind: "not_checker"; message: string }
  | { kind: "same_actor"; message: string }
  | { kind: "reason_required"; message: string }
  | { kind: "unresolved"; message: string; failure: Extract<RollbackFailure, { kind: "unresolved" }> }
  | { kind: "unconfirmed"; message: string; status: number | undefined }
  | { kind: "refused"; message: string };

/** The acknowledge endpoint has no request behind it, so it is classified on its own, not as a decide. */
export function classifyAcknowledgeError(error: unknown): AcknowledgeFailure {
  const e = error as ApiError;
  const body = obj(e?.body);
  const message = str(body.message) ?? (e instanceof Error ? e.message : String(error));
  const lower = message.toLowerCase();
  const status = e?.status;
  const rb = classifyRollbackError(error);
  if (rb?.kind === "unresolved") return { kind: "unresolved", message, failure: rb };
  switch (str(body.code)) {
    case "emergency_not_found":
      return { kind: "gone", message };
    case "same_checker":
      return { kind: "same_actor", message };
    case "not_checker":
      return { kind: "not_checker", message };
  }
  // Servers that predate the codes.
  if (status === 404) return { kind: "gone", message };
  if (status === 403 && lower.includes("different checker")) return { kind: "same_actor", message };
  if (status === 403 && lower.includes("checker")) return { kind: "not_checker", message };
  if (status === 400 && lower.includes("reason required")) return { kind: "reason_required", message };
  if (status !== undefined && status >= 400 && status < 500) return { kind: "refused", message };
  return { kind: "unconfirmed", message, status };
}

export function describeAcknowledgeFailure(f: AcknowledgeFailure): { title: string; text: string } {
  switch (f.kind) {
    case "gone":
      return {
        title: "Already acknowledged, or not found",
        text: "No unacknowledged emergency rollback was found for this release. Another checker has most likely acknowledged it. Nothing was recorded by this attempt; the list is being reloaded.",
      };
    case "not_checker":
      return {
        title: "Not a checker for this application",
        text: "Only a current checker for this application can acknowledge an emergency rollback. Nothing was recorded.",
      };
    case "same_actor":
      return {
        title: "A different checker must acknowledge",
        text: "The person who ran the emergency rollback cannot also acknowledge it. Nothing was recorded.",
      };
    case "reason_required":
      return {
        title: "A finding is required",
        text: "Write what you found when you reviewed it. Nothing was recorded.",
      };
    case "unresolved":
      return {
        title: "Writes are paused for this application",
        text: "An earlier change has an unconfirmed outcome, so the server refuses writes until it is resolved. Nothing was recorded.",
      };
    case "unconfirmed":
      return {
        title: "Outcome not confirmed",
        text: `The server answered with an error${f.status ? ` (HTTP ${f.status})` : " or did not answer"}. The acknowledgement may or may not have been recorded; the list is being reloaded. If the review is still there, try again.`,
      };
    case "refused":
      return { title: "Refused", text: "The server refused this. Nothing was recorded." };
  }
}

export function canOfferEmergency(policy: ApprovalPolicy | null | undefined, me: string | null | undefined): boolean {
  return Boolean(
    policy?.enabled &&
      policy.emergency_rollback &&
      policy.checkers.length >= 2 &&
      isChecker(policy ?? undefined, me ?? null)
  );
}
