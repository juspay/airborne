"use client";

import { OverviewStateNotice } from "@/components/control-center/overview-state-notice";
import { OperationRecovery } from "./operation-recovery";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, CloudOff, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeContext, isDefaultContext, primaryActive } from "@/lib/control-center/format";
import { appTelemetryState, flaggedRows } from "@/lib/control-center/telemetry";
import type { AppStatus } from "@/lib/control-center/types";
import { PlatformMark } from "./platform-mark";
import { Pkg, Mono } from "./version";
import {
  ApprovalRequiredChip,
  LookupFailedChip,
  NeedsReviewChip,
  NothingLiveChip,
  StateChip,
  StatusChip,
  toneForStatus,
} from "./status-badge";
import { appPath, approvalPolicyPath, releasePath } from "./paths";
import { RolloutTargetBar } from "./rollout-target";
import { RelativeTime } from "./time";
import { ServingChip } from "./serving-policy";
import { CacheStaleNotice } from "./cache-notice";
import { AdoptionLine, AppFlagChip } from "./telemetry";

/** Column template shared by the header row and every app row so they line up. */
export const ROW_GRID =
  "md:grid md:grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.9fr)_minmax(16rem,1.8fr)_5.5rem] md:items-center md:gap-x-4";

export function RowHeader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        ROW_GRID,
        "hidden px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      <span>Platform</span>
      <span>Live</span>
      <span>Rolling out</span>
      <span className="text-right">Activity</span>
    </div>
  );
}

export function accentFor(app: AppStatus): string {
  // Red means flagged: a failed lookup, paused writes, or a deployment the telemetry says seems bad.
  if (app.error || app.unresolved_operations?.length) return "border-l-red-500";
  if (appTelemetryState(app) === "seems_bad") return "border-l-red-500";
  if (app.cache_invalidation?.status === "failed") return "border-l-amber-500";
  if (app.emergency_needs_review?.some((r) => !r.acknowledged_by)) return "border-l-orange-500";
  const a = primaryActive(app);
  if (a?.status === "INPROGRESS") return "border-l-sky-500";
  if (a?.status === "CREATED") return "border-l-border";
  return "border-l-transparent";
}

export function AppStatusRow({
  org,
  app,
  className,
  trailing,
  showPlatform = true,
  showChips = true,
  showCacheNotice = true,
  context,
}: {
  org: string;
  app: AppStatus;
  className?: string;
  trailing?: ReactNode;
  showPlatform?: boolean;
  /** The policy and attention chips under the name; off where the page header already shows them. */
  showChips?: boolean;
  /** Off where the group already shows one line for every stale CDN cache in it. */
  showCacheNotice?: boolean;
  /** Where the application sits (organisation, group), for lists that mix organisations. */
  context?: string;
}) {
  const active = primaryActive(app);
  const extraActive = app.active.length - (active ? 1 : 0);
  const generalLive = app.live.find((l) => isDefaultContext(l.dimensions));
  const defaultLive = generalLive ?? app.live[0];
  // Only locale- or otherwise targeted releases are live: the cell must not read as what ordinary devices get.
  const onlyTargeted = !generalLive && Boolean(defaultLive);
  const extraLive = app.live.length - (defaultLive ? 1 : 0);
  const flagged = flaggedRows(app).length > 0;

  return (
    <div
      className={cn(
        ROW_GRID,
        "group/row relative flex flex-col gap-2 border-l-2 px-4 py-3 text-sm",
        accentFor(app),
        className
      )}
    >
      <OverviewStateNotice app={app} />
      {/* Platform + app */}
      <div className="flex min-w-0 items-center justify-between gap-2 md:block">
        <div className="min-w-0">
          {showPlatform && <PlatformMark platform={app.platform} />}
          <Link
            href={appPath(org, app.application)}
            className={cn(
              "block truncate font-mono text-xs text-muted-foreground hover:text-foreground hover:underline",
              showPlatform && "mt-0.5"
            )}
            title={`Open ${app.application}: serving policy, approvals and state`}
          >
            {app.application}
          </Link>
          {context && (
            <span className="block truncate text-[11px] text-muted-foreground/80" title={context}>
              {context}
            </span>
          )}
          {showChips && flagged && (
            // The one thing on the row that asks to be read first: the flag, with its percentage, alone on its line.
            <div className="mt-1.5">
              <AppFlagChip org={org} app={app} variant="badge" className="text-xs" />
            </div>
          )}
          {showChips &&
            (app.serving_policy ||
              app.approval_required ||
              app.cache_invalidation?.status === "failed" ||
              (app.emergency_needs_review?.some((r) => !r.acknowledged_by) ?? false)) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* Routine facts step aside while a flag is up. */}
                {!flagged && (
                  <ServingChip
                    policy={app.serving_policy}
                    variant="inline"
                    className="text-[11px]"
                    href={appPath(org, app.application)}
                  />
                )}
                {app.cache_invalidation?.status === "failed" && (
                  <StateChip
                    tone="waiting"
                    icon={CloudOff}
                    variant="inline"
                    className="text-[11px]"
                    title="The latest CDN cache invalidation failed: devices may get a stale release answer."
                  >
                    CDN cache stale
                  </StateChip>
                )}
                {app.approval_required && (!flagged || (app.pending_requests ?? 0) > 0) && (
                  <Link href={approvalPolicyPath(org, app.application)} className="hover:underline">
                    <ApprovalRequiredChip variant="inline" pending={app.pending_requests} className="text-[11px]" />
                  </Link>
                )}
                {app.emergency_needs_review?.some((r) => !r.acknowledged_by) && (
                  <NeedsReviewChip
                    variant="inline"
                    className="text-[11px]"
                    count={app.emergency_needs_review.filter((r) => !r.acknowledged_by).length}
                  />
                )}
              </div>
            )}
        </div>
        <span className="md:hidden">
          <RelativeTime iso={app.last_activity_at} className="text-xs text-muted-foreground" />
        </span>
      </div>

      {/* Live */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground md:hidden">Live</span>
        {app.error ? (
          <div className="min-w-0">
            <LookupFailedChip message={app.error} />
            <p className="mt-1 truncate text-xs text-muted-foreground" title={app.error}>
              {app.error}
            </p>
          </div>
        ) : defaultLive ? (
          <div className="min-w-0 leading-tight">
            <Link
              href={releasePath(org, app.application, defaultLive.release_id)}
              className="inline-flex items-baseline gap-1.5 hover:underline"
            >
              <Pkg version={defaultLive.package_version} title={`config ${defaultLive.config_version}`} />
            </Link>
            {onlyTargeted && (
              // A fact about reach, not a warning: neutral, and allowed to wrap under the version.
              <StateChip
                tone="muted"
                icon={Layers}
                variant="inline"
                className="flex items-start whitespace-normal text-[11px] leading-snug"
                title={`No release is live for all users. This one is live only for ${describeContext(defaultLive.dimensions)}.`}
              >
                Only {describeContext(defaultLive.dimensions)}
              </StateChip>
            )}
            <p className="text-xs text-muted-foreground">
              <RelativeTime iso={defaultLive.concluded_at} prefix="since " />
              {extraLive > 0 && (
                <span title={app.live.map((l) => describeContext(l.dimensions)).join("\n")}>
                  {" "}
                  · +{extraLive} context{extraLive > 1 ? "s" : ""}
                </span>
              )}
            </p>
            <AdoptionLine telemetry={app.telemetry} releaseId={defaultLive.release_id} fallback />
          </div>
        ) : (
          <NothingLiveChip />
        )}
      </div>

      {/* Rolling out */}
      <div className="flex min-w-0 items-start gap-2">
        <span className="w-16 shrink-0 pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground md:hidden">
          Rollout
        </span>
        {app.error ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : active ? (
          <Link
            href={releasePath(org, app.application, active.release_id)}
            className="group/active -mx-1 flex min-w-0 flex-1 flex-col gap-2 rounded-md px-1 py-0.5 hover:bg-accent/10 sm:flex-row sm:items-center sm:gap-3"
            title={`Open release ${active.release_id}`}
          >
            <div className="flex min-w-0 flex-col gap-0.5 leading-tight sm:w-[11rem] sm:shrink-0">
              <span className="flex items-baseline gap-1.5">
                <Pkg version={active.package_version} />
              </span>
              <span className="flex items-center gap-1.5">
                <StatusChip status={active.status} variant="inline" />
                <span className="truncate text-xs text-muted-foreground">· {active.created_by}</span>
              </span>
              {active.status === "INPROGRESS" && (
                <AdoptionLine telemetry={app.telemetry} releaseId={active.release_id} />
              )}
              {!isDefaultContext(active.dimensions) && (
                <Mono className="truncate" title={describeContext(active.dimensions)}>
                  {describeContext(active.dimensions)}
                </Mono>
              )}
            </div>
            <RolloutTargetBar
              target={active.traffic_percentage}
              tone={toneForStatus(active.status)}
              className="flex-1"
              label={extraActive > 0 ? `target · +${extraActive} more` : "target"}
            />
            <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/active:opacity-100 sm:block" />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Nothing rolling out</span>
        )}
      </div>

      {/* Activity */}
      <div className="hidden text-right md:block">
        <RelativeTime iso={app.last_activity_at} className="text-xs text-muted-foreground" />
      </div>

      {app.unresolved_operations?.map((op) => (
        <div key={op.operation_id} className="md:col-span-4">
          <OperationRecovery org={org} app={app.application} operationId={op.operation_id} />
        </div>
      ))}
      {showCacheNotice && app.cache_invalidation?.status === "failed" && (
        <div className="md:col-span-4">
          <CacheStaleNotice org={org} app={app.application} cache={app.cache_invalidation} dense />
        </div>
      )}
      {trailing}
    </div>
  );
}
