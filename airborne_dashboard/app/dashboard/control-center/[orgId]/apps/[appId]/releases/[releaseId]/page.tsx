"use client";

import { OverviewStateNotice } from "@/components/control-center/overview-state-notice";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import { ErrorName } from "@/lib/api";
import {
  isOngoingStatus,
  useApprovalPolicy,
  useDeploymentRequests,
  useMe,
  useOverview,
  useRelease,
  useReleaseEvents,
  useReleasePermissions,
  useTelemetry,
  useUnresolvedOperation,
} from "@/lib/control-center/hooks";
import { canAcknowledgeEmergency, isOpenRequest, protectionFor } from "@/lib/control-center/approval";
import {
  absoluteTime,
  contextKey,
  liveForContext,
  localeExceptions,
  platformLabel,
  shortConfig,
  statusLabel,
} from "@/lib/control-center/format";
import type { AppStatus, LiveRelease, OverviewGroup, ReleaseOutcome } from "@/lib/control-center/types";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated, RelativeTime } from "@/components/control-center/time";
import { PlatformMark } from "@/components/control-center/platform-mark";
import { Pkg, Mono } from "@/components/control-center/version";
import {
  ApprovalRequiredChip,
  ReleaseStateChip,
  RollbackSensitiveChip,
  toneForStatus,
} from "@/components/control-center/status-badge";
import { EmergencyReviewCard } from "@/components/control-center/emergency-review";
import { RequestRow } from "@/components/control-center/request-card";
import { PolicySummary } from "@/components/control-center/approval-policy-editor";
import { RolloutTargetBar } from "@/components/control-center/rollout-target";
import {
  AdoptionBlock,
  DeploymentFlags,
  ExcludedPackageNotice,
  ExclusionsPanel,
} from "@/components/control-center/telemetry";
import { flagForRelease, hasExclusions, isExcluded } from "@/lib/control-center/telemetry";
import { ReleaseActionBar } from "@/components/control-center/release-actions";
import { UnresolvedBanner } from "@/components/control-center/rollback-notices";
import { CacheStaleNotice } from "@/components/control-center/cache-notice";
import { LocaleExceptionsNotice } from "@/components/control-center/locale-notice";
import { ServingChip } from "@/components/control-center/serving-policy";
import { Timeline } from "@/components/control-center/timeline";
import { Reach } from "@/components/control-center/reach-card";
import {
  BlockSkeleton,
  EmptyState,
  ErrorState,
  Panel,
  PanelTitle,
  PermissionDenied,
} from "@/components/control-center/states";
import {
  appPath,
  approvalPolicyPath,
  CC_ROOT,
  classicReleasePath,
  groupPath,
  releasePath,
} from "@/components/control-center/paths";

export default function ControlCenterReleasePage() {
  const params = useParams<{ orgId: string; appId: string; releaseId: string }>();
  const orgId = decodeURIComponent(params.orgId ?? "");
  const appId = decodeURIComponent(params.appId ?? "");
  const releaseId = decodeURIComponent(params.releaseId ?? "");
  const { org, app, setOrg, setApp } = useAppContext();
  const permissions = useReleasePermissions(orgId, appId);
  const me = useMe();

  useEffect(() => {
    if (org !== orgId) setOrg(orgId);
    if (app !== appId) setApp(appId);
  }, [org, app, orgId, appId, setOrg, setApp]);

  const { overview, refresh: refreshOverview } = useOverview();
  const located = useMemo(() => locate(overview, orgId, appId), [overview, orgId, appId]);
  // Maker-checker: read the policy once the overview says it applies; labels stay direct until then.
  const approvalOn = Boolean(located.app?.approval_required);
  const requestsQuery = useDeploymentRequests(orgId, approvalOn ? appId : null);
  const releaseRequests = (requestsQuery.requests ?? []).filter((r) => r.payload.release_id === releaseId);
  const openRequests = releaseRequests.filter((r) => isOpenRequest(r.status));
  const sensitive = protectionFor(located.app, releaseId);
  const reviews = (located.app?.emergency_needs_review ?? []).filter(
    (r) => !r.acknowledged_by && (r.release_id === releaseId || r.new_release_id === releaseId)
  );
  // Acknowledging needs the checker list even after approval was switched off, so read the policy for reviews too.
  const approval = useApprovalPolicy(orgId, approvalOn || reviews.length > 0 ? appId : null);

  const releaseQuery = useRelease(orgId, appId, releaseId);
  const release = releaseQuery.release;
  // The fresh read carries the security exclusions; the overview's copy covers the rows until it lands.
  const device = useTelemetry(orgId, appId);
  const telemetry = device.telemetry ?? located.app?.telemetry;
  // A failed refresh makes the exclusions unknown, not whatever the last read said.
  const blocked = device.error ? null : device.telemetry ? device.telemetry.blocked_package_versions : undefined;
  const status = release?.experiment.status;
  const ongoing = isOngoingStatus(status);
  const eventsQuery = useReleaseEvents(orgId, appId, releaseId, ongoing);
  // The server's verdict. Undefined = unknown (still loading, or the request failed); nothing is inferred.
  const outcome: ReleaseOutcome | undefined = eventsQuery.outcome;

  // The detector's advice for this release, if any. It changes emphasis and wording; nothing is done for you.
  const flag = flagForRelease(located.app, releaseId);
  // The action bar is mounted once, here, and draws its buttons into the incident card while the card is on the page and
  // into the Rollout panel otherwise. A poll that adds or clears the flag moves the buttons; it cannot remount the bar,
  // so an open dialog, a typed reason and an in-flight or finished rollback all survive it.
  const [flagSlot, setFlagSlot] = useState<HTMLElement | null>(null);
  const [rolloutSlot, setRolloutSlot] = useState<HTMLElement | null>(null);
  const actionSlot = flagSlot ?? rolloutSlot;

  const denied = (permissions.isReady && !permissions.read) || releaseQuery.error?.name === ErrorName.Forbidden;

  const liveNow = release ? liveForContext(located.app, release.dimensions) : undefined;
  // Locale-targeted live releases that this general release will not replace (Superposition specificity).
  const exceptions = release && ongoing ? localeExceptions(located.app, release.dimensions) : [];
  const isLive = outcome === "live";
  const replaces = liveNow && liveNow.release_id !== releaseId ? liveNow : undefined;
  const outcomeUnknown = status === "CONCLUDED" && outcome === undefined;
  // Conclude needs the exact variant: prefer the overview's explicit id, else the detail only when unambiguous.
  const activeEntry = located.app?.active.find((a) => a.release_id === releaseId);
  const experimentals = release?.experiment.experiment_variants.experimentals ?? [];
  const experimentalVariant =
    activeEntry?.experimental_variant || (experimentals.length === 1 ? experimentals[0] : undefined);

  // Another release already ongoing for this reach (only used to link it from a blocked rollback).
  const otherOngoing = release
    ? located.app?.active.find(
        (a) => a.release_id !== releaseId && contextKey(a.dimensions) === contextKey(release.dimensions)
      )
    : undefined;
  // Read paused operations directly, independently of rollback preview and outcome.
  const {
    unresolved,
    checkFailed: pausedCheckFailed,
    refresh: refreshWriteState,
  } = useUnresolvedOperation(orgId, appId, releaseId, releaseQuery.pollMs);

  const refreshAll = () => {
    void refreshOverview();
    void releaseQuery.refresh();
    void eventsQuery.refresh();
    void requestsQuery.refresh();
    void device.refresh();
    refreshWriteState();
  };

  const actionBar = release ? (
    <ReleaseActionBar
      org={orgId}
      app={appId}
      platform={located.app?.platform ?? null}
      release={{
        releaseId: release.id,
        status: status ?? "",
        packageVersion: release.package.version,
        trafficPercentage: ongoing ? release.experiment.traffic_percentage : status === "CONCLUDED" ? 100 : 0,
        dimensions: release.dimensions,
        experimentalVariant,
        outcome,
      }}
      liveNow={liveNow}
      otherOngoing={otherOngoing}
      localeExceptions={exceptions}
      permissions={{
        ready: permissions.isReady,
        ramp: permissions.ramp,
        conclude: permissions.conclude,
        rollback: permissions.conclude,
        update: permissions.update,
      }}
      approval={{
        ready: !approvalOn || approval.isReady,
        policy: approval.policy,
        sensitive,
        me,
      }}
      flag={flag}
      size="sm"
      onChanged={refreshAll}
      slot={actionSlot}
    />
  ) : null;

  const crumbs = [
    { label: "Control Center", href: CC_ROOT },
    ...(located.group ? [{ label: located.group.name, href: groupPath(orgId, located.group.id) }] : [{ label: orgId }]),
    { label: appId, href: appPath(orgId, appId) },
    { label: release ? `v${release.package.version}` : "Release" },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <OverviewStateNotice app={located.app} />
        <CcPageHeader
          crumbs={crumbs}
          title={
            release && !denied ? (
              <span className="inline-flex items-baseline gap-3">
                <Pkg version={release.package.version} className="text-2xl" />
                <span className="text-muted-foreground">on</span>
                <PlatformMark platform={located.app?.platform ?? null} size="md" className="text-2xl" />
              </span>
            ) : (
              "Release"
            )
          }
          titleAdornment={
            release && !denied ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <ReleaseStateChip status={status ?? ""} outcome={outcome} />
                {approvalOn && (
                  <Link href={approvalPolicyPath(orgId, appId)} className="hover:underline">
                    <ApprovalRequiredChip pending={openRequests.length} />
                  </Link>
                )}
                {approvalOn && sensitive && <RollbackSensitiveChip reason={sensitive} />}
              </span>
            ) : undefined
          }
          subtitle={
            release && !denied ? (
              <span className="inline-flex flex-wrap items-center gap-x-2">
                <span>{appId}</span>
                <span aria-hidden>·</span>
                <span title={`release ${release.id}`}>
                  created <RelativeTime iso={release.created_at} />
                </span>
              </span>
            ) : undefined
          }
          actions={
            <>
              <LastUpdated
                at={releaseQuery.lastUpdatedAt}
                pollMs={releaseQuery.pollMs}
                isValidating={releaseQuery.isValidating}
                onRefresh={refreshAll}
              />
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href={classicReleasePath(orgId, appId, releaseId)}>
                  <ExternalLink /> Full release page
                </Link>
              </Button>
            </>
          }
        />

        {denied ? (
          <PermissionDenied what={`read releases in ${appId}`} />
        ) : releaseQuery.isLoading && !release ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="space-y-4">
              <BlockSkeleton className="h-40" />
              <BlockSkeleton className="h-64" />
            </div>
            <div className="space-y-4">
              <BlockSkeleton className="h-40" />
              <BlockSkeleton className="h-40" />
            </div>
          </div>
        ) : releaseQuery.error && !release ? (
          <ErrorState
            title="Could not load this release"
            message={releaseQuery.error.message}
            onRetry={() => releaseQuery.refresh()}
          />
        ) : !release ? (
          <EmptyState title="Release not found" />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="min-w-0 space-y-4">
              {actionBar}
              {unresolved && (
                <UnresolvedBanner
                  org={orgId}
                  app={appId}
                  operationId={unresolved.operationId}
                  message={unresolved.message}
                />
              )}
              {pausedCheckFailed && (
                <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                  Could not check whether writes are paused for {appId}
                  {unresolved ? ", so the pause above is from the last successful read" : ""}. A write that is paused
                  will still be refused with a reason.
                </p>
              )}
              {located.app && (
                <DeploymentFlags
                  org={orgId}
                  app={located.app}
                  releaseId={release.id}
                  onReleasePage
                  actions={<div ref={setFlagSlot} />}
                />
              )}
              {located.app?.cache_invalidation?.status === "failed" && (
                <CacheStaleNotice org={orgId} app={appId} cache={located.app.cache_invalidation} />
              )}
              {reviews.map((r) => (
                <EmergencyReviewCard
                  key={r.id}
                  org={orgId}
                  app={appId}
                  platform={located.app?.platform ?? null}
                  review={r}
                  canAcknowledge={canAcknowledgeEmergency(approval.policy, me, Boolean(approval.error))}
                  onChanged={refreshAll}
                />
              ))}
              {isExcluded(blocked, release.package.version) && (
                <ExcludedPackageNotice version={release.package.version} phase="page" />
              )}
              <Panel className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <PanelTitle>Rollout</PanelTitle>
                  <div ref={setRolloutSlot} />
                </div>
                {outcomeUnknown ? null : (
                  <RolloutTargetBar
                    target={ongoing ? release.experiment.traffic_percentage : outcomeTarget(outcome)}
                    tone={outcome === "live" ? "live" : ongoing ? toneForStatus(status ?? "") : "muted"}
                    size="md"
                    showCap={ongoing}
                    label={ongoing ? "rollout target" : outcomeBarLabel(outcome, statusLabel(status ?? ""))}
                  />
                )}
                <p className="text-sm text-muted-foreground">
                  <RolloutExplanation
                    status={status ?? ""}
                    outcome={outcome}
                    pkg={release.package.version}
                    target={release.experiment.traffic_percentage}
                    replaces={replaces}
                    org={orgId}
                    app={appId}
                    platform={platformLabel(located.app?.platform ?? null)}
                  />
                </p>
                <LocaleExceptionsNotice
                  org={orgId}
                  app={appId}
                  exceptions={exceptions}
                  verb={status === "CREATED" ? "Starting this rollout" : "Making this release live"}
                />
              </Panel>

              <AdoptionBlock
                org={orgId}
                app={located.app}
                releaseId={release.id}
                telemetry={telemetry}
                noteShownAbove={Boolean(flag)}
              />

              {approvalOn && releaseRequests.length > 0 && (
                <Panel>
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <PanelTitle>
                      Requests for this release
                      {openRequests.length > 0 ? ` · ${openRequests.length} awaiting approval` : ""}
                    </PanelTitle>
                    <ShieldCheck className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" aria-hidden />
                  </div>
                  <ul className="divide-y">
                    {[...releaseRequests]
                      .sort(
                        (a, b) =>
                          Number(isOpenRequest(b.status)) - Number(isOpenRequest(a.status)) ||
                          b.updated_at.localeCompare(a.updated_at)
                      )
                      .slice(0, 6)
                      .map((r) => (
                        <RequestRow
                          key={r.id}
                          org={orgId}
                          request={r}
                          platform={located.app?.platform ?? null}
                          me={me}
                        />
                      ))}
                  </ul>
                </Panel>
              )}

              <Panel className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <PanelTitle>Timeline</PanelTitle>
                  <span className="text-xs text-muted-foreground">newest first</span>
                </div>
                <Timeline
                  events={eventsQuery.events}
                  isLoading={eventsQuery.isLoading}
                  error={eventsQuery.error}
                  onRetry={() => eventsQuery.refresh()}
                />
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel className="space-y-3 p-4">
                <PanelTitle>Reach</PanelTitle>
                <Reach dimensions={release.dimensions} />
              </Panel>

              <Panel className="space-y-3 p-4">
                <PanelTitle>{isLive ? "Live before this" : "Live for this reach"}</PanelTitle>
                {replaces ? (
                  <div>
                    <Link
                      href={releasePath(orgId, appId, replaces.release_id)}
                      className="inline-flex items-baseline gap-2 hover:underline"
                    >
                      <Pkg version={replaces.package_version} size="lg" title={`config ${replaces.config_version}`} />
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <RelativeTime iso={replaces.concluded_at} prefix="live since " />
                      {ongoing && " · still served to everyone outside the target"}
                    </p>
                  </div>
                ) : outcomeUnknown ? (
                  <p className="text-sm text-muted-foreground">
                    Unknown: the server did not report this release&apos;s outcome, so it is not stated whether it is
                    live.
                  </p>
                ) : isLive ? (
                  <p className="text-sm text-muted-foreground">
                    This is the live release. The previous one is only resolved by the server during a rollback.
                  </p>
                ) : located.app ? (
                  <p className="text-sm text-muted-foreground">Nothing is live for this reach yet.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Overview not loaded; cannot tell what is live.</p>
                )}
              </Panel>

              {hasExclusions(blocked) && (
                <Panel className="p-4">
                  <ExclusionsPanel
                    blocked={blocked}
                    packageVersion={release.package.version}
                    isLoading={device.isLoading}
                  />
                </Panel>
              )}

              {approvalOn && approval.policy && <PolicySummary policy={approval.policy} />}

              <Panel className="p-4">
                <PanelTitle className="mb-2">Facts</PanelTitle>
                <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <Fact label="Package">
                    <Pkg version={release.package.version} />
                  </Fact>
                  <Fact label="Config">
                    <Mono className="text-foreground" title={`config ${release.experiment.config_version}`}>
                      {shortConfig(release.experiment.config_version)}
                    </Mono>
                  </Fact>
                  <Fact label="Status">{statusLabel(status ?? "")}</Fact>
                  {located.app?.serving_policy && (
                    <Fact label="Serving">
                      <ServingChip policy={located.app.serving_policy} variant="inline" href={appPath(orgId, appId)} />
                    </Fact>
                  )}
                  <Fact label="Created">
                    <span title={absoluteTime(release.created_at)}>{absoluteTime(release.created_at)}</span>
                  </Fact>
                  <Fact label="Group">
                    {located.group ? (
                      <Link href={groupPath(orgId, located.group.id)} className="hover:underline">
                        {located.group.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">ungrouped</span>
                    )}
                  </Fact>
                </dl>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground self-center">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** What the bar shows for a finished release. Only the server's outcome decides. */
function outcomeTarget(outcome: ReleaseOutcome | undefined): number {
  return outcome === "live" || outcome === "superseded" ? 100 : 0;
}

function outcomeBarLabel(outcome: ReleaseOutcome | undefined, fallback: string): string {
  switch (outcome) {
    case "live":
      return "live for everyone in reach";
    case "superseded":
      return "was live; superseded";
    case "concluded_on_control":
      return "control chosen; nothing changed for devices";
    default:
      return fallback;
  }
}

function RolloutExplanation({
  status,
  outcome,
  pkg,
  target,
  replaces,
  org,
  app,
  platform,
}: {
  status: string;
  outcome: ReleaseOutcome | undefined;
  pkg: number;
  target: number;
  /** The release live now for this reach, when it is a different one. Used only as a pointer. */
  replaces: LiveRelease | undefined;
  org: string;
  app: string;
  platform: string;
}) {
  switch (status) {
    case "CREATED":
      return <>Not started. No device is served v{pkg} until a rollout target is set.</>;
    case "INPROGRESS":
      return (
        <>
          A {target}% share of {platform} traffic in reach is served v{pkg}.{" "}
          {replaces !== undefined
            ? `The rest stays on v${replaces.package_version}, which remains live.`
            : "Nothing else is live for this reach."}{" "}
          The share is a target set on the server, not a count of devices that have updated.
        </>
      );
    case "CONCLUDED":
      switch (outcome) {
        case "live":
          return (
            <>
              v{pkg} is the live release for this reach. Every device in reach is offered it on its next update check.
            </>
          );
        case "superseded":
          return (
            <>
              v{pkg} was made live and has since been superseded by a newer release.
              {replaces && (
                <>
                  {" "}
                  <Link href={releasePath(org, app, replaces.release_id)} className="underline">
                    Open the live release (v{replaces.package_version})
                  </Link>
                  .
                </>
              )}{" "}
              It cannot be rolled back from here.
            </>
          );
        case "concluded_on_control":
          return (
            <>
              Concluded on the control variant: v{pkg} never became live, so the previous package stayed in place for
              every device (a rollback, or a rollout stopped early).
            </>
          );
        default:
          return (
            <>
              This release is concluded, but the server did not report its outcome, so whether v{pkg} is live,
              superseded or was concluded on control is unknown. No actions are offered until the timeline loads.
            </>
          );
      }
    case "DISCARDED":
      return <>Discarded before it started. No device was served v{pkg}.</>;
    default:
      return <>{status}</>;
  }
}

function locate(
  overview: ReturnType<typeof useOverview>["overview"],
  orgId: string,
  appId: string
): { app: AppStatus | undefined; group: OverviewGroup | undefined } {
  const org = overview?.organisations.find((o) => o.name === orgId);
  if (!org) return { app: undefined, group: undefined };
  for (const g of org.groups) {
    const m = g.members.find((x) => x.application === appId);
    if (m) return { app: m, group: g };
  }
  return { app: org.ungrouped.find((x) => x.application === appId), group: undefined };
}
