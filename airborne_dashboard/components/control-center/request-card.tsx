"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Flag, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast, toastError, toastSuccess } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  actionLabel,
  baseRelease,
  classifyApprovalError,
  describeApprovalFailure,
  isChecker,
  isExpired,
  isMine,
  isOpenRequest,
  raisesExposure,
  reconcileDecision,
  requestDimensions,
  requestPackageVersion,
  sensitivityLabel,
  summariseRequest,
  type ApprovalFailure,
} from "@/lib/control-center/approval";
import { absoluteTime, describeContext, liveForContext, platformApp, statusLabel } from "@/lib/control-center/format";
import { useApprovalActions, useAsyncAction, useNow } from "@/lib/control-center/hooks";
import { flagForRelease, formatRate, type ReleaseEvidence } from "@/lib/control-center/telemetry";
import type {
  AppStatus,
  ApprovalPolicy,
  DeploymentRequest,
  DimensionContext,
  Platform,
  ReconciledKeys,
  ReleaseEvent,
  RequestDecision,
} from "@/lib/control-center/types";
import { ApprovalNotice, ApprovalProblem, ServerSaid } from "./approval-notices";
import { PlatformMark } from "./platform-mark";
import { Pkg, Mono } from "./version";
import { Reach } from "./reach-card";
import { ReconciledNotice } from "./rollback-notices";
import { RelativeTime } from "./time";
import { RequestStatusChip, RollbackSensitiveChip, StateChip } from "./status-badge";
import { ServingChip, servingExplanation } from "./serving-policy";
import { servingState } from "@/lib/control-center/format";
import type { ServingPolicy } from "@/lib/control-center/types";
import { Timeline } from "./timeline";
import { EvidenceBlock, FlagAcknowledge } from "./telemetry";
import { releasePath, requestPath } from "./paths";

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

// ---------------------------------------------------------------------------
// Queue row
// ---------------------------------------------------------------------------

/** How long until a pending request lapses, as the checker needs to read it. */
export function ExpiresIn({ iso, className }: { iso: string; className?: string }) {
  const now = useNow();
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = t - now.getTime();
  if (ms <= 0) {
    return (
      <span className={cn("text-red-700 dark:text-red-300", className)} title={absoluteTime(iso)}>
        expired
      </span>
    );
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const soon = ms < 2 * 3_600_000;
  return (
    <span className={cn(soon ? "text-amber-700 dark:text-amber-300" : "", className)} title={absoluteTime(iso)}>
      expires in {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </span>
  );
}

export function RequestRow({
  org,
  request,
  platform,
  me,
  className,
  dense,
  app,
}: {
  org: string;
  request: DeploymentRequest;
  platform: Platform | null;
  me: string | null;
  className?: string;
  /** A narrow column: stack the parts and drop the application, which the column already names. */
  dense?: boolean;
  /** The application's state now. With it, a request that widens a flagged release shows the failure rate. */
  app?: AppStatus;
}) {
  const mine = isMine(request, me);
  const open = isOpenRequest(request.status);
  const flag = open && raisesExposure(request) ? flagForRelease(app, request.payload.release_id ?? "") : undefined;
  return (
    <li className={cn("relative", className)}>
      <Link
        href={requestPath(org, request.application, request.id)}
        className={cn(
          "group/req flex flex-col gap-2 px-4 py-3 text-sm hover:bg-accent/10",
          !dense && "sm:flex-row sm:items-center sm:gap-4"
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-2 sm:w-[13rem] sm:shrink-0", dense && "hidden")}>
          <PlatformMark platform={platform} />
          <span className="truncate font-mono text-xs text-muted-foreground" title={request.application}>
            {request.application}
          </span>
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{actionLabel(request.action)}</span>
            <span className="text-xs text-muted-foreground">{summariseRequest(request)}</span>
          </div>
          {flag && (
            <p className="mt-1">
              <StateChip
                tone={flag.status === "seems_bad" ? "danger" : "waiting"}
                icon={Flag}
                variant="inline"
                title="From unverified device reports. Approving widens this release; Airborne has changed nothing."
              >
                {flag.status === "seems_bad" ? "Deployment seems bad" : "Suspicious reports"}:{" "}
                {formatRate(flag.failureRate)} reported failing on v{flag.row.package_version}
              </StateChip>
            </p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono">{request.requester}</span>
            {mine && <span className="rounded border px-1 py-px text-[10px] uppercase tracking-wide">you</span>}
            <span aria-hidden>·</span>
            <RelativeTime iso={request.created_at} />
            {open && (
              <>
                <span aria-hidden>·</span>
                <ExpiresIn iso={request.expires_at} />
              </>
            )}
            {request.reason && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate" title={request.reason}>
                  {request.reason}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RequestStatusChip
            status={request.status === "pending" && isExpired(request) ? "expired" : request.status}
            variant="badge"
          />
          <ArrowUpRight
            className={cn(
              "hidden h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/req:opacity-100",
              !dense && "sm:block"
            )}
          />
        </div>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The exact change, against what is live. A checker must be able to see precisely what they approve.
// ---------------------------------------------------------------------------

function Cell({ label, children, tone }: { label: string; children: ReactNode; tone?: "muted" | "accent" }) {
  return (
    <div className={cn("min-w-0 rounded-md border p-3", tone === "accent" && "border-violet-500/40 bg-violet-500/5")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function Json({ value, label }: { value: unknown; label: string }) {
  return (
    <details className="group rounded-md border">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <pre className="max-h-80 overflow-auto border-t bg-muted/30 p-3 font-mono text-[11px] leading-snug">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v}%`;
}

/** Reads a config-ish object without assuming its exact shape. */
function configFacts(body: Record<string, unknown> | undefined): { label: string; value: ReactNode }[] {
  if (!body) return [];
  const rows: { label: string; value: ReactNode }[] = [];
  const pkgId = str(body.package_id);
  if (pkgId) rows.push({ label: "Package", value: <Mono className="text-foreground">{pkgId}</Mono> });
  const cfg = obj(body.config);
  if (cfg) {
    const bt = num(cfg.boot_timeout);
    const rt = num(cfg.release_config_timeout);
    if (bt !== null) rows.push({ label: "Boot timeout", value: `${bt} ms` });
    if (rt !== null) rows.push({ label: "Config timeout", value: `${rt} ms` });
    const props = obj(cfg.properties);
    if (props) {
      const n = Object.keys(props).length;
      rows.push({ label: "Properties", value: n === 0 ? "none" : `${n} key${n === 1 ? "" : "s"}` });
    }
  }
  const pkg = obj(body.package);
  if (pkg) {
    const imp = Array.isArray(pkg.important) ? pkg.important.length : null;
    const lazy = Array.isArray(pkg.lazy) ? pkg.lazy.length : null;
    if (imp !== null || lazy !== null) {
      rows.push({ label: "Files", value: `${imp ?? 0} important · ${lazy ?? 0} lazy` });
    }
  }
  if (Array.isArray(body.resources)) rows.push({ label: "Resources", value: `${body.resources.length}` });
  const marker = body.rollback_sensitive;
  if (marker !== undefined) {
    rows.push({
      label: "Marker",
      value: marker ? <RollbackSensitiveChip reason={String(marker)} variant="inline" /> : "not rollback-sensitive",
    });
  }
  return rows;
}

export function RequestChange({
  org,
  request,
  app,
  unreadable,
  className,
}: {
  org: string;
  request: DeploymentRequest;
  /** The application now, from the overview. Undefined when the overview has not loaded. */
  app: AppStatus | undefined;
  /** The overview failed rather than loading: "now" is unknown, not on its way. */
  unreadable?: boolean;
  className?: string;
}) {
  const notLoaded = unreadable ? <span className="text-muted-foreground">unknown</span> : "…";
  const body = request.payload.body ?? {};
  const base = baseRelease(request);
  const snapshot = obj(request.payload.snapshot);
  const releaseId = request.payload.release_id;
  const pkg = requestPackageVersion(request);
  const dims: DimensionContext = requestDimensions(request);
  const liveNow = liveForContext(app, dims);
  const activeNow = releaseId ? app?.active.find((a) => a.release_id === releaseId) : undefined;
  const nowTarget = activeNow?.traffic_percentage ?? (app?.live.some((l) => l.release_id === releaseId) ? 100 : null);
  const baseTarget = num(base?.traffic_percentage);
  const driftedTarget = app !== undefined && baseTarget !== null && nowTarget !== null && nowTarget !== baseTarget;
  const open = isOpenRequest(request.status);

  const releaseLink = releaseId ? (
    <Link
      href={releasePath(org, request.application, releaseId)}
      className="inline-flex items-baseline gap-2 hover:underline"
    >
      {pkg !== null && (
        <Pkg version={pkg} title={request.config_version ? `config ${request.config_version}` : undefined} />
      )}
      <span className="text-xs text-muted-foreground" title={`release ${releaseId}`}>
        release
      </span>
    </Link>
  ) : null;

  let change: ReactNode;
  switch (request.action) {
    case "ramp": {
      const target = num(body.traffic_percentage);
      change = (
        <div className="space-y-2">
          <Cell label="Target change">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {app ? pct(nowTarget) : notLoaded} → {pct(target)}
            </span>
            {driftedTarget && <p className="text-xs text-muted-foreground">When raised: {pct(baseTarget)}</p>}
          </Cell>
        </div>
      );
      break;
    }
    case "conclude":
      change = (
        <div className="grid gap-3 sm:grid-cols-3">
          <Cell label="When raised">
            {pkg !== null && <Pkg version={pkg} size="lg" />}
            <p className="text-xs text-muted-foreground">at a {pct(baseTarget)} target</p>
          </Cell>
          <Cell label="Live now for this reach">
            {app ? (
              liveNow ? (
                <>
                  <Pkg version={liveNow.package_version} size="lg" />
                  <p className="text-xs text-muted-foreground">
                    <RelativeTime iso={liveNow.concluded_at} prefix="since " />
                  </p>
                </>
              ) : (
                <span className="text-muted-foreground">nothing live</span>
              )
            ) : (
              notLoaded
            )}
          </Cell>
          <Cell label="After approval" tone="accent">
            {pkg !== null && <Pkg version={pkg} size="lg" className="text-violet-700 dark:text-violet-300" />}
            <p className="text-xs text-muted-foreground">live for everyone in reach (100%)</p>
          </Cell>
        </div>
      );
      break;
    case "rollback": {
      const plan = snapshot ?? {};
      const resulting = num(plan.resulting_package_version);
      const action = str(plan.action);
      const keys = obj(plan.reconciled_keys) as ReconciledKeys | null;
      const blocked = obj(plan.blocked);
      change = (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Cell label="When raised">
              {pkg !== null && <Pkg version={pkg} size="lg" />}
              <p className="text-xs text-muted-foreground">
                {base?.status ? statusLabel(String(base.status)) : "live"}
              </p>
            </Cell>
            <Cell label="Live now for this reach">
              {app ? (
                liveNow ? (
                  <Pkg version={liveNow.package_version} size="lg" />
                ) : (
                  <span className="text-muted-foreground">nothing live</span>
                )
              ) : (
                notLoaded
              )}
            </Cell>
            <Cell label="After approval" tone="accent">
              {resulting !== null ? (
                <Pkg version={resulting} size="lg" className="text-violet-700 dark:text-violet-300" />
              ) : (
                <span className="text-muted-foreground">not stated by the plan</span>
              )}
              <p className="text-xs text-muted-foreground">
                {action === "rereleased"
                  ? "re-released as a new release"
                  : action === "concluded_control"
                    ? "traffic returns to the live package"
                    : action === "discarded"
                      ? "discarded before start"
                      : "rollback as planned by the server"}
              </p>
            </Cell>
          </div>
          {keys && (keys.kept_current?.length > 0 || keys.dropped?.length > 0) && (
            <ReconciledNotice keys={keys} resultingVersion={resulting} />
          )}
          {blocked && (
            <ApprovalNotice title="The plan was blocked when raised" tone="danger">
              <ServerSaid message={str(blocked.message) ?? JSON.stringify(blocked)} />
            </ApprovalNotice>
          )}
        </div>
      );
      break;
    }
    case "set_strict_serving": {
      // The snapshot is the policy as it was when raised; the overview says what it is now.
      const before = (snapshot ?? null) as ServingPolicy | null;
      const nowPolicy = app?.serving_policy;
      const after = body.strict === true;
      const afterState = servingState({ strict: after, deployment_override: false, effective_strict: after });
      change = (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Cell label="When raised">
              {before ? (
                <ServingChip policy={before} variant="inline" />
              ) : (
                <span className="text-muted-foreground">not recorded</span>
              )}
            </Cell>
            <Cell label="Now">
              {app ? (
                nowPolicy ? (
                  <>
                    <ServingChip policy={nowPolicy} variant="inline" />
                    {before && before.strict !== nowPolicy.strict && (open || request.status === "stale") && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">changed since raised</p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">not reported</span>
                )
              ) : (
                notLoaded
              )}
            </Cell>
            <Cell label="After approval" tone="accent">
              <span className="font-medium">Strict serving {after ? "on" : "off"}</span>
              {afterState && <p className="text-xs text-muted-foreground">{servingExplanation(afterState)}</p>}
            </Cell>
          </div>
        </div>
      );
      break;
    }
    case "set_rollback_sensitive": {
      const after = body.rollback_sensitive;
      const now = app?.release_protections?.find((p) => p.release_id === releaseId)?.rollback_sensitive ?? null;
      change = (
        <div className="grid gap-3 sm:grid-cols-2">
          <Cell label="Marker now">
            {app?.release_protections == null ? (
              "not reported"
            ) : now ? (
              <RollbackSensitiveChip reason={now} variant="inline" />
            ) : (
              "not rollback-sensitive"
            )}
          </Cell>
          <Cell label="After approval" tone="accent">
            {after ? (
              <RollbackSensitiveChip reason={String(after)} variant="inline" />
            ) : (
              "marker cleared: direct lowering and rollback allowed again"
            )}
          </Cell>
        </div>
      );
      break;
    }
    default: {
      // create / update / discard: the body is the exact request the action would be made with.
      const rows = configFacts(body);
      const snapPkg = obj(snapshot?.package);
      const overrides = obj(snapshot?.overrides);
      change = (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Cell label="Live now for this reach">
              {app ? (
                liveNow ? (
                  <>
                    <Pkg version={liveNow.package_version} size="lg" title={`config ${liveNow.config_version}`} />
                  </>
                ) : (
                  <span className="text-muted-foreground">nothing live</span>
                )
              ) : (
                notLoaded
              )}
            </Cell>
            <Cell label={request.action === "discard" ? "After approval" : "Proposed"} tone="accent">
              {request.action === "discard" ? (
                "release discarded before start"
              ) : (
                <>
                  {num(snapPkg?.version) !== null && (
                    <Pkg
                      version={num(snapPkg?.version) as number}
                      size="lg"
                      className="text-violet-700 dark:text-violet-300"
                    />
                  )}
                  <dl className="mt-1 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
                    {rows.map((r) => (
                      <div key={r.label} className="contents">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{r.label}</dt>
                        <dd className="min-w-0">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Cell>
          </div>
          {overrides && (
            <Json
              value={overrides}
              label={`Resolved overrides (${Object.keys(overrides).length} key${Object.keys(overrides).length === 1 ? "" : "s"})`}
            />
          )}
        </div>
      );
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {releaseLink && (
        <p className="text-sm">
          <span className="text-muted-foreground">Release </span>
          {releaseLink}
          {base?.status && (
            <span className="text-xs text-muted-foreground"> · {statusLabel(String(base.status))} when raised</span>
          )}
        </p>
      )}
      {change}
      {!isDefault(dims) && <p className="text-xs text-muted-foreground">Reach: {describeContext(dims)}</p>}
      <Json
        value={{ action: request.action, payload: request.payload, payload_hash: request.payload_hash }}
        label="Exact payload the approval is bound to (immutable; hash shown)"
      />
    </div>
  );
}

function isDefault(d: DimensionContext): boolean {
  return Object.keys(d).length === 0;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export function RequestDecision({
  org,
  request,
  policy,
  me,
  /** The signed-in user holds the release permission the action needs, as far as the client knows. */
  permitted,
  evidence,
  evidenceLoading,
  onChanged,
  className,
}: {
  org: string;
  request: DeploymentRequest;
  policy: ApprovalPolicy | undefined;
  me: string | null;
  permitted: boolean;
  /** What device reports say about this request's release now, read from the overview. */
  evidence: ReleaseEvidence;
  /** The overview that carries those reports has not answered yet. */
  evidenceLoading?: boolean;
  onChanged?: () => void;
  className?: string;
}) {
  // One dialog in one place. A failed decision re-reads the request, whose status then moves the panel to another
  // branch; a dialog rendered inside each branch would be remounted by that and lose the answer it is showing.
  const [dialog, setDialog] = useState<RequestDecision | null>(null);
  return (
    <>
      <DecisionPanel
        {...{ org, request, policy, me, permitted, evidence, evidenceLoading, className }}
        onOpen={setDialog}
      />
      <DecisionDialog
        open={dialog !== null}
        decision={dialog ?? "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        org={org}
        request={request}
        evidence={evidence}
        evidenceLoading={evidenceLoading}
        onChanged={onChanged}
      />
    </>
  );
}

/** What approving does, one line under the failure rate. */
function widenNote(request: DeploymentRequest): string | null {
  if (request.action === "conclude") return "Approving makes this release live for everyone in reach.";
  if (request.action !== "ramp") return null;
  const target = num(request.payload.body?.traffic_percentage);
  const base = num(baseRelease(request)?.traffic_percentage);
  if (target === null) return "Approving changes the rollout target.";
  return base === null
    ? `Approving sets the rollout target to ${target}%.`
    : `Approving raises the rollout target from ${base}% to ${target}%.`;
}

function DecisionPanel({
  org,
  request,
  policy,
  me,
  permitted,
  evidence,
  evidenceLoading,
  onOpen,
  className,
}: {
  org: string;
  request: DeploymentRequest;
  policy: ApprovalPolicy | undefined;
  me: string | null;
  permitted: boolean;
  evidence: ReleaseEvidence;
  evidenceLoading?: boolean;
  onOpen: (decision: RequestDecision) => void;
  className?: string;
}) {
  const now = useNow();
  const app = request.application;
  const mine = isMine(request, me);
  const checker = isChecker(policy, me);
  const expired = isExpired(request, now);
  const status = request.status;

  // The reports matter wherever approving would widen a release, and wherever a release is flagged at all.
  const raises = raisesExposure(request);
  const flagged = evidence.kind === "flagged";
  const showEvidence = Boolean(request.payload.release_id) && (raises || flagged);
  // Widening a flagged release: the safe answer leads. Approve is still there, and still the person's call.
  const rejectLeads = raises && flagged && !mine;

  const noPermissionTitle = `You do not have the permission to ${actionLabel(request.action).toLowerCase()} in ${app}, which the server also asks of anyone who rejects or cancels.`;
  const approveTitle = mine
    ? "You raised this, so a different checker must approve it."
    : expired
      ? "This request has expired and cannot be approved."
      : !policy?.enabled
        ? "Approval is no longer on for this application; the server will refuse."
        : !checker
          ? `You are not a checker for ${app}.`
          : !permitted
            ? noPermissionTitle
            : undefined;
  if (status === "failed") {
    // The server lets a checker other than the requester approve a failed request again, against current state.
    return (
      <div className={cn("space-y-3", className)}>
        <Outcome request={request} org={org} />
        {showEvidence && (
          <EvidenceBlock org={org} app={app} evidence={evidence} loading={evidenceLoading} note={widenNote(request)} />
        )}
        {mine ? (
          <ApprovalNotice title="You raised this, so a different checker must retry it.">
            <p className="text-muted-foreground">Nobody can approve their own request, including a retry.</p>
          </ApprovalNotice>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpen("approve")}
              disabled={Boolean(approveTitle)}
              title={approveTitle}
            >
              <ShieldCheck /> Approve again (retry)
            </Button>
            <span className="text-xs text-muted-foreground">
              Runs it again against the current state. If the release state has changed, the request goes stale.
            </span>
          </div>
        )}
      </div>
    );
  }

  if (!isOpenRequest(status)) {
    return (
      <div className={cn("space-y-2", className)}>
        <Outcome request={request} org={org} />
      </div>
    );
  }
  if (status === "executing") {
    return (
      <ApprovalNotice title="Approved. Executing now…" className={className}>
        <p className="text-muted-foreground">
          {request.decided_by} approved this and the server is running the change. This page refreshes on its own.
        </p>
      </ApprovalNotice>
    );
  }

  const rejectTitle = !policy?.enabled
    ? "Approval is no longer on for this application; the server will refuse."
    : !checker
      ? `Only a checker for ${app} can reject.`
      : !permitted
        ? noPermissionTitle
        : undefined;
  // The server checks the action's permission on whoever cancels too.
  const cancelTitle = permitted ? undefined : noPermissionTitle;

  return (
    <div className={cn("space-y-3", className)}>
      {mine && (
        <ApprovalNotice title="You raised this, so a different checker must approve it.">
          <p className="text-muted-foreground">
            Nobody can approve their own request, whatever their role. You can cancel it.
          </p>
        </ApprovalNotice>
      )}
      {!mine && expired && (
        <ApprovalNotice title="This request has expired" tone="warning">
          <p className="text-muted-foreground">
            It lapsed at {absoluteTime(request.expires_at)} and the server will refuse to approve it. Ask the requester
            to raise a new one if the change is still wanted.
          </p>
        </ApprovalNotice>
      )}
      {!mine && !expired && !checker && policy?.enabled && (
        <ApprovalNotice title={`Only a checker for ${app} can decide this`} tone="warning">
          <p className="text-muted-foreground">Checkers: {policy.checkers.join(", ") || "none listed"}.</p>
        </ApprovalNotice>
      )}
      {showEvidence && (
        <EvidenceBlock org={org} app={app} evidence={evidence} loading={evidenceLoading} note={widenNote(request)} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {rejectLeads && (
          <Button onClick={() => onOpen("reject")} disabled={Boolean(rejectTitle)} title={rejectTitle}>
            <XCircle /> Reject
          </Button>
        )}
        <Button
          variant={rejectLeads ? "outline" : "default"}
          onClick={() => onOpen("approve")}
          disabled={Boolean(approveTitle)}
          title={approveTitle}
        >
          <ShieldCheck /> Approve and execute
        </Button>
        {!mine && !rejectLeads && (
          <Button
            variant="outline"
            onClick={() => onOpen("reject")}
            disabled={Boolean(rejectTitle)}
            title={rejectTitle}
          >
            <XCircle /> Reject
          </Button>
        )}
        {mine && (
          <Button
            variant="outline"
            onClick={() => onOpen("cancel")}
            disabled={Boolean(cancelTitle)}
            title={cancelTitle}
          >
            <XCircle /> Cancel request
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          <ExpiresIn iso={request.expires_at} />
        </span>
      </div>
    </div>
  );
}

function DecisionDialog({
  open,
  decision,
  onOpenChange,
  org,
  request,
  evidence,
  evidenceLoading,
  onChanged,
}: {
  open: boolean;
  decision: RequestDecision;
  onOpenChange: (o: boolean) => void;
  org: string;
  request: DeploymentRequest;
  evidence: ReleaseEvidence;
  evidenceLoading?: boolean;
  onChanged?: () => void;
}) {
  const actions = useApprovalActions();
  const { pending, error, rawError, run, clearError } = useAsyncAction();
  const [reason, setReason] = useState("");
  const [acceptFlag, setAcceptFlag] = useState(false);
  const [done, setDone] = useState<DeploymentRequest | null>(null);
  useEffect(() => {
    if (open) {
      setReason("");
      setAcceptFlag(false);
      setDone(null);
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, decision]);

  const app = request.application;
  // The request as it was when Approve was pressed. The refresh after a failed decide replaces `request`, and the
  // comparison tells a failure this attempt caused (failed, executed) from a state that was already there.
  const before = useRef<Pick<DeploymentRequest, "status" | "updated_at">>(request);
  const failure: ApprovalFailure | null = rawError
    ? reconcileDecision(classifyApprovalError(rawError, "decide"), before.current, request)
    : null;
  // After a refusal the request's state has moved on (stale, expired, failed): nothing to retry here. An
  // unconfirmed outcome can be retried: the server will not run an approved request twice.
  const terminal =
    failure !== null &&
    failure.kind !== "other" &&
    failure.kind !== "unconfirmed" &&
    failure.kind !== "reason_required";

  const submit = async () => {
    before.current = { status: request.status, updated_at: request.updated_at };
    const res = await run(async () => {
      try {
        return await actions.decide(org, app, request.id, decision, reason.trim());
      } catch (e) {
        // A refusal can move the request to stale or expired, which closes this dialog: say so here too. An
        // unconfirmed outcome gets no toast: it is settled by the re-read, and the dialog says what it found.
        const f = classifyApprovalError(e, "decide");
        if (f.kind !== "reason_required" && f.kind !== "unconfirmed") {
          toastError(
            decision === "approve" ? "Not approved" : "Not recorded",
            describeApprovalFailure(f, { action: actionLabel(request.action).toLowerCase() })
          );
        }
        throw e;
      } finally {
        onChanged?.();
      }
    });
    if (res) {
      setDone(res);
      (decision === "approve" && evidence.kind === "flagged"
        ? (title: string, detail: string) => toast({ title, description: detail })
        : toastSuccess)(
        decision === "approve"
          ? res.status === "executed"
            ? "Approved and executed"
            : `Approved · ${res.status}`
          : decision === "reject"
            ? "Request rejected"
            : "Request cancelled",
        `${actionLabel(request.action)} · ${app}`
      );
    }
  };

  const retry = request.status === "failed";
  // A flag never blocks approval. Widening a flagged release makes the approver read the failure rate and tick it.
  const raises = raisesExposure(request);
  const flag = evidence.kind === "flagged" ? evidence.flag : undefined;
  const needsFlagAck = decision === "approve" && raises && flag !== undefined && !acceptFlag;
  const showEvidence = decision !== "cancel" && Boolean(request.payload.release_id) && (raises || flag !== undefined);
  const title =
    decision === "approve"
      ? `${retry ? "Approve again" : "Approve and execute"}: ${actionLabel(request.action).toLowerCase()}`
      : decision === "reject"
        ? "Reject this request"
        : "Cancel your request";
  const description =
    decision === "approve"
      ? retry
        ? "The first attempt failed. This runs the same change again on your authority, after the server re-checks that the release state is unchanged and that this request has not expired. Inspect the release and its operations first."
        : "Approval executes the change immediately, on your authority, recording both you and the requester. The server re-checks that the release state is unchanged and that this request has not expired."
      : decision === "reject"
        ? "The requester sees your reason. Nothing is changed."
        : "Nothing is changed. Raise a new request if you want to try again.";

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Change</dt>
          <dd>{summariseRequest(request)}</dd>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Application</dt>
          <dd className="font-mono text-xs">{app}</dd>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Requested by</dt>
          <dd className="font-mono text-xs">{request.requester}</dd>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Their reason</dt>
          <dd>{request.reason}</dd>
        </dl>

        {showEvidence && !flag && !done && (
          <EvidenceBlock org={org} app={app} evidence={evidence} loading={evidenceLoading} compact />
        )}

        {done ? (
          <Outcome request={done} org={org} />
        ) : (
          <>
            {decision === "approve" && raises && flag && (
              <FlagAcknowledge
                flag={flag}
                packageVersion={requestPackageVersion(request) ?? Number(flag.row.package_version)}
                consequence={widenNote(request) ?? "Approving widens this release."}
                checked={acceptFlag}
                onCheckedChange={setAcceptFlag}
                disabled={pending || terminal}
                ariaLabel="Approve despite the failure rate"
              />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cc-decision-reason">
                {decision === "reject" ? "Reason (required, shown to the requester)" : "Note (optional, recorded)"}
              </Label>
              <Textarea
                id="cc-decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                disabled={pending || terminal}
                placeholder={
                  decision === "approve"
                    ? "e.g. checked the crash dashboard; agree with widening"
                    : decision === "reject"
                      ? "e.g. wait for the iOS fix to ship first"
                      : "e.g. raised against the wrong release"
                }
              />
            </div>
            {error && failure && (
              <ApprovalProblem
                failure={failure}
                org={org}
                app={app}
                releaseId={request.payload.release_id}
                packageVersion={requestPackageVersion(request) ?? undefined}
                action={actionLabel(request.action).toLowerCase()}
                onNavigate={() => onOpenChange(false)}
              />
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {done || terminal ? "Close" : "Back"}
          </Button>
          {!done && !terminal && (
            <Button
              variant={decision === "approve" ? (flag && raises ? "outline" : "default") : "destructive"}
              onClick={submit}
              disabled={pending || needsFlagAck || (decision === "reject" && reason.trim().length === 0)}
            >
              {pending
                ? decision === "approve"
                  ? "Approving and executing…"
                  : "Recording…"
                : decision === "approve"
                  ? "Approve and execute now"
                  : decision === "reject"
                    ? "Reject"
                    : "Cancel request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What happened to a decided request, in the words the server recorded. */
export function Outcome({ request, org }: { request: DeploymentRequest; org: string }) {
  const result = request.result ?? {};
  const err = str(result.error);
  const recovery = str(result.recovery);
  const newId = str(result.new_release_id) ?? (request.action === "create" ? str(result.id) : null);
  const restored = num(result.rolled_back_to_package_version);
  switch (request.status) {
    case "executed":
      return (
        <ApprovalNotice title="Approved and executed" icon={CheckCircle2}>
          <p className="text-muted-foreground">
            Approved by <span className="font-mono text-xs">{request.decided_by}</span>{" "}
            <RelativeTime iso={request.updated_at} />, raised by{" "}
            <span className="font-mono text-xs">{request.requester}</span>.
            {request.decision_reason && <> Note: {request.decision_reason}.</>}
            {restored !== null && (
              <>
                {" "}
                Restored <Pkg version={restored} />.
              </>
            )}
          </p>
          {newId && (
            <Link href={releasePath(org, request.application, newId)} className="text-xs font-medium underline">
              Open the resulting release <ArrowRight className="inline h-3 w-3" aria-hidden />
            </Link>
          )}
          {Object.keys(result).length > 0 && <Json value={result} label="Execution result" />}
        </ApprovalNotice>
      );
    case "failed":
      return (
        <ApprovalNotice title="Approved, but the execution failed" tone="danger" role="alert">
          <p className="text-muted-foreground">
            <span className="font-mono text-xs">{request.decided_by}</span> approved this, the action was attempted and
            failed. It is not retried on its own.{" "}
            {recovery ?? "Inspect the release and its operations before raising another request."}
          </p>
          {err && <ServerSaid message={err} />}
        </ApprovalNotice>
      );
    case "rejected":
      return (
        <ApprovalNotice title="Rejected" tone="warning" icon={XCircle}>
          <p className="text-muted-foreground">
            By <span className="font-mono text-xs">{request.decided_by}</span> <RelativeTime iso={request.updated_at} />
            .{request.decision_reason && <> Reason: {request.decision_reason}.</>} Nothing was changed.
          </p>
        </ApprovalNotice>
      );
    case "cancelled":
      return (
        <ApprovalNotice title="Cancelled" tone="warning" icon={XCircle}>
          <p className="text-muted-foreground">
            By <span className="font-mono text-xs">{request.decided_by ?? request.requester}</span>{" "}
            <RelativeTime iso={request.updated_at} />.
            {request.decision_reason && <> Reason: {request.decision_reason}.</>} Nothing was changed.
          </p>
        </ApprovalNotice>
      );
    case "expired":
      return (
        <ApprovalNotice title="Expired before a decision" tone="warning">
          <p className="text-muted-foreground">
            It lapsed at {absoluteTime(request.expires_at)}. Nothing was changed. Raise a new request if the change is
            still wanted.
          </p>
        </ApprovalNotice>
      );
    case "stale":
      return (
        <ApprovalNotice title="Stale: the release state changed before approval" tone="warning">
          <p className="text-muted-foreground">
            The live or active state no longer matches what this request was raised against, so the server refused to
            execute it
            {request.decided_by ? (
              <>
                {" "}
                when <span className="font-mono text-xs">{request.decided_by}</span> tried
              </>
            ) : null}
            . Nothing was changed. Raise a new request against the current state.
          </p>
        </ApprovalNotice>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Facts and timeline
// ---------------------------------------------------------------------------

export function RequestFacts({ request, platform }: { request: DeploymentRequest; platform: Platform | null }) {
  const row = (label: string, value: ReactNode) => (
    <div className="contents" key={label}>
      <dt className="self-center text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
  const marker = request.payload.body?.rollback_sensitive;
  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {row("Action", actionLabel(request.action))}
      {row("Application", platformApp(platform, request.application))}
      {row("Requested by", <span className="font-mono text-xs">{request.requester}</span>)}
      {row("Reason", request.reason)}
      {row("Raised", <span title={absoluteTime(request.created_at)}>{absoluteTime(request.created_at)}</span>)}
      {row(
        "Expires",
        <span>
          {absoluteTime(request.expires_at)}{" "}
          {isOpenRequest(request.status) && (
            <span className="text-xs text-muted-foreground">
              (<ExpiresIn iso={request.expires_at} />)
            </span>
          )}
        </span>
      )}
      {request.decided_by && row("Decided by", <span className="font-mono text-xs">{request.decided_by}</span>)}
      {typeof marker === "string" &&
        row(
          "Marker",
          <StateChip tone="danger" icon={ShieldCheck} variant="inline">
            {sensitivityLabel(marker)}
          </StateChip>
        )}
      {row("Request", <Mono className="break-all text-foreground">{request.id}</Mono>)}
      {row(
        "Payload hash",
        <Mono className="break-all" title={request.payload_hash}>
          {request.payload_hash.slice(0, 16)}…
        </Mono>
      )}
    </dl>
  );
}

/**
 * The request's own history. Real release events (filtered to this request) win when available;
 * otherwise the request's fields are enough to show who raised it and who decided.
 */
export function RequestTimeline({
  request,
  events,
  isLoading,
  error,
  onRetry,
}: {
  request: DeploymentRequest;
  events: ReleaseEvent[] | undefined;
  isLoading: boolean;
  error?: Error;
  onRetry?: () => void;
}) {
  const list = useMemo(() => {
    const own = (events ?? []).filter((e) => obj(e.payload)?.id === request.id);
    const have = new Set(own.map((e) => e.action));
    const synth: ReleaseEvent[] = [];
    if (!have.has("requested")) {
      synth.push({
        action: "requested",
        actor: request.requester,
        created_at: request.created_at,
        payload: { ...request },
        synthetic: true,
      });
    }
    const decided = request.status !== "pending";
    if (decided) {
      const action = request.status === "executing" ? "approved" : request.status;
      if (!have.has(action as ReleaseEvent["action"])) {
        synth.push({
          action: action as ReleaseEvent["action"],
          actor: request.decided_by ?? request.requester,
          created_at: request.updated_at,
          payload: { ...request },
          synthetic: true,
        });
      }
      if (request.status === "executed" && !have.has("approved")) {
        synth.push({
          action: "approved",
          actor: request.decided_by ?? "",
          created_at: request.updated_at,
          payload: { ...request },
          synthetic: true,
        });
      }
    }
    return [...own, ...synth];
  }, [events, request]);
  return <Timeline events={list} isLoading={isLoading && !events} error={error} onRetry={onRetry} byRequest={false} />;
}

export function ReachForRequest({ request }: { request: DeploymentRequest }) {
  return <Reach dimensions={requestDimensions(request)} />;
}
