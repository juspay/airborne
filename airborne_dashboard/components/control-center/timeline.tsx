"use client";

import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  Cloud,
  Eye,
  GitCommitHorizontal,
  ShieldCheck,
  Siren,
  TrendingUp,
  Undo2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describeContext } from "@/lib/control-center/format";
import {
  actionLabel,
  describePolicyChange,
  emergencyRestoredVersion,
  requestStatusLabel,
} from "@/lib/control-center/approval";
import type { ApprovalPolicy, ReleaseEvent, ReleaseEventAction } from "@/lib/control-center/types";
import { TONE_TEXT, type Tone } from "./status-badge";
import { RelativeTime } from "./time";
import { BlockSkeleton, EmptyState, ErrorState } from "./states";
import { oneRowPerRequest, requestIdOf, REQUEST_EVENT_STATUS } from "@/lib/control-center/timeline-rows";

const META: Record<ReleaseEventAction, { icon: ComponentType<{ className?: string }>; tone: Tone; label: string }> = {
  created: { icon: GitCommitHorizontal, tone: "muted", label: "Created" },
  ramped: { icon: TrendingUp, tone: "rolling", label: "Target set" },
  concluded: { icon: CheckCircle2, tone: "live", label: "Concluded" },
  discarded: { icon: XCircle, tone: "muted", label: "Discarded" },
  operation_resolved: { icon: Undo2, tone: "muted", label: "Operation resolved" },
  rolled_back: { icon: Undo2, tone: "danger", label: "Rolled back" },
  // Maker-checker. Every request event carries the request, so both people can be named.
  requested: { icon: UserCheck, tone: "approval", label: "Requested" },
  approved: { icon: ShieldCheck, tone: "approval", label: "Approved" },
  rejected: { icon: XCircle, tone: "muted", label: "Rejected" },
  cancelled: { icon: XCircle, tone: "muted", label: "Cancelled" },
  expired: { icon: Clock, tone: "waiting", label: "Expired" },
  stale: { icon: AlertTriangle, tone: "waiting", label: "Went stale" },
  executed: { icon: CheckCircle2, tone: "live", label: "Executed" },
  failed: { icon: AlertTriangle, tone: "danger", label: "Execution failed" },
  emergency_rollback: { icon: Siren, tone: "emergency", label: "Emergency rollback" },
  emergency_acknowledged: { icon: Eye, tone: "emergency", label: "Emergency rollback reviewed" },
  policy_changed: { icon: ShieldCheck, tone: "approval", label: "Approval policy changed" },
  // App-wide CDN cache events. A failure means cached release answers can stay stale for up to a day.
  cache_invalidated: { icon: Cloud, tone: "muted", label: "CDN cache cleared" },
  cache_invalidation_failed: { icon: CloudOff, tone: "waiting", label: "CDN cache not cleared" },
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** A request event's payload is the request: name the action and both people. */
function requestSummary(ev: ReleaseEvent, named = false): string | null {
  const p = ev.payload ?? {};
  const bits: string[] = [];
  const action = str(p.action);
  // A grouped row already names the request in its heading; a loose event does not.
  if (action && !named) bits.push(actionLabel(action).toLowerCase());
  const requester = str(p.requester);
  const decider = str(p.decided_by);
  switch (ev.action) {
    case "requested":
      if (requester) bits.push(`raised by ${requester}`);
      break;
    case "approved":
    case "executed":
      if (requester) bits.push(`raised by ${requester}`);
      if (decider) bits.push(`approved by ${decider}`);
      break;
    case "failed":
      if (requester) bits.push(`raised by ${requester}`);
      if (decider) bits.push(`approved by ${decider}`);
      {
        const result = p.result as Record<string, unknown> | undefined;
        const err = str(result?.error);
        if (err) bits.push(`error: ${err}`);
      }
      break;
    case "rejected":
      if (requester) bits.push(`raised by ${requester}`);
      if (decider) bits.push(`rejected by ${decider}`);
      break;
    case "cancelled":
      if (requester) bits.push(`raised by ${requester}`);
      if (decider && decider !== requester) bits.push(`cancelled by ${decider}`);
      break;
    case "expired":
    case "stale":
      if (requester) bits.push(`raised by ${requester}`);
      if (decider) bits.push(`found by ${decider}`);
      break;
  }
  const reason = str(p.decision_reason) ?? (ev.action === "requested" ? str(p.reason) : null);
  if (reason) bits.push(`reason: ${reason}`);
  return bits.join(" · ") || null;
}

function summarise(ev: ReleaseEvent, named = false): string | null {
  const p = ev.payload ?? {};
  switch (ev.action) {
    case "operation_resolved":
      return `Operator finding: ${String(p.finding)} · ${String(p.reason)}`;
    case "ramped":
      return typeof p.traffic_percentage === "number" ? `rollout target ${p.traffic_percentage}%` : null;
    case "created": {
      const bits: string[] = [];
      if (typeof p.package_version === "number") bits.push(`package v${p.package_version}`);
      if (p.dimensions && typeof p.dimensions === "object") {
        bits.push(describeContext(p.dimensions as Record<string, string>));
      }
      if (typeof p.rollback_of === "string") bits.push(`re-release for rollback of ${p.rollback_of}`);
      return bits.join(" · ") || null;
    }
    case "concluded": {
      const v = p.chosen_variant;
      if (typeof v !== "string") return null;
      return v.toLowerCase().includes("control")
        ? "stayed on the previous release: nothing changed for devices"
        : "made live";
    }
    case "requested":
    case "approved":
    case "rejected":
    case "cancelled":
    case "expired":
    case "stale":
    case "executed":
    case "failed":
      return requestSummary(ev, named);
    case "emergency_rollback": {
      // The server nests the record under `details`; older and sample events keep the fields at the top.
      const d = (p.details && typeof p.details === "object" ? p.details : p) as Record<string, unknown>;
      // The server writes this event after the rollback finished and says so (`rollback_finished`). An event from an
      // older server was written before the rollback ran, so its plan is only what was intended.
      const { version: restored, confirmed, finished } = emergencyRestoredVersion(d);
      const bits: string[] = ["skipped approval"];
      if (restored !== null) bits.push(`${confirmed ? "restored" : "planned to restore"} v${restored}`);
      else if (finished) bits.push("rollback finished");
      if (d.confirm_sensitive_risk === true || d.rollback_sensitive)
        bits.push("risk on a rollback-sensitive release confirmed");
      if (typeof d.reason === "string" && d.reason) bits.push(`reason: ${d.reason}`);
      // Review status is not here: the event is never rewritten, so it cannot say who has acknowledged it. A later
      // "Emergency rollback reviewed" event does.
      return bits.join(" · ");
    }
    case "emergency_acknowledged": {
      const bits: string[] = [];
      const review = (p.review && typeof p.review === "object" ? p.review : {}) as Record<string, unknown>;
      const by = str(review.actor) ?? str(p.actor) ?? str(p.rolled_back_by);
      if (by) bits.push(`rollback by ${by}`);
      if (typeof p.reason === "string" && p.reason) bits.push(`finding: ${p.reason}`);
      return bits.join(" · ") || null;
    }
    case "policy_changed": {
      if (p.policy === "strict_serving") {
        const after = (p.after ?? {}) as { strict?: boolean };
        return `strict serving turned ${after.strict ? "on" : "off"}`;
      }
      const before = (p.before ?? null) as Partial<ApprovalPolicy> | null;
      const after = (p.after ?? {}) as Partial<ApprovalPolicy>;
      const bits = describePolicyChange(before, after);
      return bits.join(" · ") || "policy saved without changes";
    }
    case "cache_invalidated":
      return "after a release write, or a retry";
    case "cache_invalidation_failed": {
      const paths = Array.isArray(p.failed_paths) ? p.failed_paths.length : 0;
      const attempts = typeof p.attempts_per_path === "number" ? p.attempts_per_path : null;
      return `${paths || "some"} CDN path${paths === 1 ? "" : "s"} still cached${attempts ? ` after ${attempts} attempts each` : ""} · devices may get a stale answer until the cache expires or a retry succeeds`;
    }
    case "rolled_back": {
      const bits: string[] = [];
      if (typeof p.action === "string") {
        bits.push(
          p.action === "rereleased"
            ? typeof p.rolled_back_to_package_version === "number"
              ? `re-released v${p.rolled_back_to_package_version}`
              : "re-released the previous package"
            : p.action === "concluded_control"
              ? "traffic returned to the live package"
              : "discarded before start"
        );
      }
      if (typeof p.reason === "string" && p.reason) bits.push(`reason: ${p.reason}`);
      return bits.join(" · ") || null;
    }
    default:
      return null;
  }
}

interface Row {
  ev: ReleaseEvent;
  detail: string | null;
  /** How many consecutive identical events this row stands for. */
  count: number;
  /** The oldest of them; `ev` is the newest. */
  first: ReleaseEvent;
  /** Set for a request: the one row that stands for every event of it, and where the request stands now. */
  request?: { action: string; status: string };
}

/**
 * Newest first. A request is one row, however many events it left: it reads as the request and where it stands
 * now. Other consecutive identical events become one row with a count.
 */
function mergeRows(list: ReleaseEvent[], byRequest: boolean): Row[] {
  const rows: Row[] = [];
  for (const ev of byRequest ? oneRowPerRequest(list) : list) {
    if (byRequest && requestIdOf(ev)) {
      rows.push({
        ev,
        detail: summarise(ev, true),
        count: 1,
        first: ev,
        request: { action: str(ev.payload?.action) ?? "", status: REQUEST_EVENT_STATUS[ev.action] ?? ev.action },
      });
      continue;
    }
    const detail = summarise(ev);
    const last = rows[rows.length - 1];
    if (
      !last?.request &&
      last &&
      last.ev.action === ev.action &&
      last.ev.actor === ev.actor &&
      last.detail === detail
    ) {
      last.count += 1;
      last.first = ev;
    } else {
      rows.push({ ev, detail, count: 1, first: ev });
    }
  }
  return rows;
}

/** Rows shown before "Show all": enough to see what just happened, short enough to find the page's actions. */
export const TIMELINE_RECENT = 5;

export function Timeline({
  events,
  isLoading,
  error,
  onRetry,
  limit = TIMELINE_RECENT,
  byRequest = true,
  className,
  dense,
}: {
  events: ReleaseEvent[] | undefined;
  isLoading: boolean;
  error?: Error;
  onRetry?: () => void;
  /** Rows shown until "Show all". */
  limit?: number;
  /** One row per request. Off on a request's own page, where its steps are the point. */
  byRequest?: boolean;
  className?: string;
  dense?: boolean;
}) {
  const [all, setAll] = useState(false);
  if (isLoading && !events) return <BlockSkeleton className={cn("h-28", className)} />;
  if (error && !events) return <ErrorState title="Timeline unavailable" message={error.message} onRetry={onRetry} />;
  const list = mergeRows(
    [...(events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    byRequest
  );
  const shown = all ? list : list.slice(0, limit);
  if (shown.length === 0)
    return (
      <div className={className}>
        {error && <p role="alert">Refresh failed. Event history is unknown; try again.</p>}
        <EmptyState title="No events yet" />
      </div>
    );

  return (
    <>
      {error && events && (
        <p
          role="alert"
          className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-muted-foreground"
        >
          <strong className="text-foreground">Timeline unavailable.</strong> The last refresh failed, so these events
          are from the last successful load and may be out of date.
          {onRetry && (
            <>
              {" "}
              <button type="button" className="underline" onClick={onRetry}>
                Retry
              </button>
            </>
          )}
        </p>
      )}
      <ol className={cn("relative", className)} aria-label="Release timeline">
        {shown.map(({ ev, detail, count, first, request }, i) => {
          const meta = META[ev.action] ?? META.created;
          const Icon = meta.icon;
          return (
            <li
              key={`${ev.action}-${ev.created_at}-${ev.actor}-${JSON.stringify(ev.payload)}`}
              className={cn("relative flex gap-3 pl-1", dense ? "py-1.5" : "py-2.5")}
            >
              {i < shown.length - 1 && (
                <span className="absolute left-[0.95rem] top-7 bottom-0 w-px bg-border" aria-hidden />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card",
                  TONE_TEXT[meta.tone]
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">
                    {request ? `${actionLabel(request.action)} request` : meta.label}
                  </span>
                  {request && (
                    <span className="text-sm text-muted-foreground">· {requestStatusLabel(request.status)}</span>
                  )}
                  {count > 1 && (
                    <span className="text-sm font-medium tabular-nums" title={`${count} identical events in a row`}>
                      ×{count}
                    </span>
                  )}
                  {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-mono">{ev.actor}</span>
                  <span aria-hidden>·</span>
                  <RelativeTime iso={ev.created_at} prefix={count > 1 ? "latest " : undefined} />
                  {count > 1 && (
                    <>
                      <span aria-hidden>·</span>
                      <RelativeTime iso={first.created_at} prefix="first " />
                    </>
                  )}
                  {ev.synthetic && (
                    <span
                      className="rounded border px-1 py-px text-[10px] uppercase tracking-wide"
                      title="Reconstructed from the experiment: this release predates the event log."
                    >
                      reconstructed
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {list.length > limit && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="mt-1 pl-10 text-xs text-muted-foreground underline hover:text-foreground"
        >
          {all ? `Show the latest ${limit}` : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
