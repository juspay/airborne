"use client";

import { approvalStateReady } from "@/lib/control-center/overview-state";

import { OverviewStateNotice } from "@/components/control-center/overview-state-notice";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import {
  useApprovalPolicy,
  useDeploymentRequests,
  useMe,
  useOverview,
  useReleasePermissions,
  type ReleasePermissionSet,
} from "@/lib/control-center/hooks";
import { canAcknowledgeEmergency, isOpenRequest, protectionFor } from "@/lib/control-center/approval";
import type { ApprovalPolicy, RollbackSensitiveReason } from "@/lib/control-center/types";
import {
  contextKey,
  describeContext,
  isDefaultContext,
  liveForContext,
  localeExceptions,
  sortMembersByPlatform,
} from "@/lib/control-center/format";
import type { ActiveRelease, AppGroup, AppStatus, LiveRelease, OverviewGroup } from "@/lib/control-center/types";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated, RelativeTime } from "@/components/control-center/time";
import { PlatformMark } from "@/components/control-center/platform-mark";
import { Pkg } from "@/components/control-center/version";
import {
  ApprovalRequiredChip,
  LookupFailedChip,
  NothingLiveChip,
  RollbackSensitiveChip,
  StatusChip,
  toneForStatus,
} from "@/components/control-center/status-badge";
import { ApplyPolicyToGroupDialog } from "@/components/control-center/approval-policy-editor";
import { EmergencyReviewCard } from "@/components/control-center/emergency-review";
import { RequestRow } from "@/components/control-center/request-card";
import { RolloutTargetBar } from "@/components/control-center/rollout-target";
import { ReleaseActionBar } from "@/components/control-center/release-actions";
import { Reach } from "@/components/control-center/reach-card";
import { BlockSkeleton, EmptyState, ErrorState, Panel, PanelTitle } from "@/components/control-center/states";
import { GroupEditorDialog } from "@/components/control-center/group-editor-dialog";
import { DeleteGroupDialog } from "@/components/control-center/delete-group-dialog";
import {
  appPath,
  approvalPolicyPath,
  CC_ROOT,
  classicNewReleasePath,
  releasePath,
} from "@/components/control-center/paths";
import { ServingChip } from "@/components/control-center/serving-policy";
import { GroupCacheNotice } from "@/components/control-center/cache-notice";
import { OperationRecovery } from "@/components/control-center/operation-recovery";
import { AttentionChips } from "@/components/control-center/attention-strip";
import { AdoptionLine, AdoptionNote, DeploymentFlags } from "@/components/control-center/telemetry";
import { summariseAttention } from "@/lib/control-center/format";
import { flagForRelease, flaggedRows } from "@/lib/control-center/telemetry";

function toAppGroup(g: OverviewGroup): AppGroup {
  return {
    id: g.id,
    name: g.name,
    members: g.members.map((m) => ({ application: m.application, platform: m.platform ?? "other" })),
  };
}

export default function GroupPage() {
  const params = useParams<{ orgId: string; groupId: string }>();
  const orgId = decodeURIComponent(params.orgId ?? "");
  const groupId = decodeURIComponent(params.groupId ?? "");
  const { org, setOrg, getOrgAccess, user } = useAppContext();
  const { overview, error, isLoading, isValidating, lastUpdatedAt, pollMs, refresh } = useOverview();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [policyDialog, setPolicyDialog] = useState(false);

  useEffect(() => {
    if (org !== orgId) setOrg(orgId);
  }, [org, orgId, setOrg]);

  const orgData = overview?.organisations.find((o) => o.name === orgId);
  const group = orgData?.groups.find((g) => g.id === groupId);
  const orgAccess = getOrgAccess(orgId);
  // Same rule as the server and the overview: org owner/admin or super admin.
  const canManage = Boolean(user?.is_super_admin) || orgAccess.includes("owner") || orgAccess.includes("admin");
  // The approval policy is stricter: the server wants the real owner/admin role even from a super admin.
  const canSetPolicy = orgAccess.includes("owner") || orgAccess.includes("admin");
  const members = useMemo(() => (group ? sortMembersByPlatform(group.members) : []), [group]);
  const attention = useMemo(() => summariseAttention(members), [members]);
  const approvalOn = members.filter((m) => m.approval_required).length;

  const crumbs = [
    { label: "Control Center", href: CC_ROOT },
    { label: orgId, href: `${CC_ROOT}` },
    { label: group?.name ?? "Group" },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <CcPageHeader
          crumbs={crumbs}
          title={group?.name ?? (isLoading ? "Loading…" : "Group")}
          titleAdornment={group ? <AttentionChips summary={attention} /> : undefined}
          subtitle={
            group ? (
              <span>
                {members.length} platform{members.length === 1 ? "" : "s"} in {orgId}. Percentages are rollout targets;
                device counts are reported boots, unverified.
              </span>
            ) : undefined
          }
          actions={
            <>
              <LastUpdated at={lastUpdatedAt} pollMs={pollMs} isValidating={isValidating} onRefresh={refresh} />
              {group && canSetPolicy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPolicyDialog(true)}
                  title="Write one maker-checker policy to every member application"
                >
                  <ShieldCheck /> Approval policy
                  {approvalOn > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {approvalOn}/{members.length} on
                    </span>
                  )}
                </Button>
              )}
              {group && canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil /> Edit group
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-700 hover:text-red-700 dark:text-red-300"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 /> Delete
                  </Button>
                </>
              )}
            </>
          }
        />

        {isLoading && !overview ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BlockSkeleton className="h-96" />
            <BlockSkeleton className="h-96" />
          </div>
        ) : error && !overview ? (
          <ErrorState title="Could not load this group" message={error.message} onRetry={refresh} />
        ) : !orgData ? (
          <EmptyState
            title={`Organisation “${orgId}” is not readable`}
            message="It may not exist or your role may not include it."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={CC_ROOT}>Back to Control Center</Link>
              </Button>
            }
          />
        ) : !group ? (
          <EmptyState
            title="Group not found"
            message="It may have been deleted. Groups are listed on the Control Center overview."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={CC_ROOT}>Back to Control Center</Link>
              </Button>
            }
          />
        ) : (
          <>
            {error && (
              <ErrorState title="Showing the last successful refresh" message={error.message} onRetry={refresh} />
            )}
            <GroupCacheNotice org={orgId} apps={members} />
            <div
              className={
                members.length === 1
                  ? "grid grid-cols-[minmax(0,1fr)] gap-4 lg:max-w-2xl"
                  : members.length === 2
                    ? "grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2"
                    : "grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 xl:grid-cols-3"
              }
            >
              {members.map((m) => (
                <PlatformColumn key={m.application} org={orgId} app={m} onChanged={refresh} />
              ))}
            </div>
          </>
        )}
      </div>

      {group && (
        <>
          <GroupEditorDialog
            open={editing}
            onOpenChange={setEditing}
            org={orgId}
            mode={{ kind: "edit", group: toAppGroup(group) }}
            groups={(orgData?.groups ?? []).map(toAppGroup)}
          />
          <DeleteGroupDialog
            open={deleting}
            onOpenChange={setDeleting}
            org={orgId}
            group={toAppGroup(group)}
            onDeleted={() => {
              window.location.assign(CC_ROOT);
            }}
          />
          <ApplyPolicyToGroupDialog
            open={policyDialog}
            onOpenChange={setPolicyDialog}
            org={orgId}
            groupName={group.name}
            members={toAppGroup(group).members}
            pendingByApp={Object.fromEntries(members.map((m) => [m.application, m.pending_requests ?? 0]))}
            stateReady={members.every((m) => m.auxiliary_error == null && typeof m.approval_required === "boolean")}
            policiesByApp={Object.fromEntries(members.map((m) => [m.application, Boolean(m.approval_required)]))}
          />
        </>
      )}
    </>
  );
}

function PlatformColumn({ org, app, onChanged }: { org: string; app: AppStatus; onChanged: () => void }) {
  // The same specific checks the release page uses (ramp, conclude), for this column's own app.
  const permissions = useReleasePermissions(
    org,
    app.active.length > 0 || app.approval_required ? app.application : null
  );
  // The policy is read only where the overview says approval is on; elsewhere the labels stay direct.
  const reviews = (app.emergency_needs_review ?? []).filter((r) => !r.acknowledged_by);
  // Acknowledging needs the checker list even after approval was switched off, so read the policy for reviews too.
  const approval = useApprovalPolicy(org, app.approval_required || reviews.length > 0 ? app.application : null);
  const requests = useDeploymentRequests(org, app.approval_required ? app.application : null);
  const me = useMe();
  const active = [...app.active].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const live = [...app.live].sort((a, b) => Object.keys(a.dimensions).length - Object.keys(b.dimensions).length);
  const pending = (requests.requests ?? []).filter((r) => isOpenRequest(r.status));
  const approvalCtx = {
    ready: approvalStateReady(app, approval.isReady, Boolean(approval.error)),
    policy: approval.policy,
    me,
  };

  return (
    <Panel className="flex flex-col">
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <PlatformMark platform={app.platform} size="md" />
          <Link
            href={appPath(org, app.application)}
            className="mt-0.5 block truncate font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
            title={`Open ${app.application}: serving policy, approvals and state`}
          >
            {app.application}
          </Link>
          {(app.serving_policy || app.approval_required) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <ServingChip
                policy={app.serving_policy}
                variant="inline"
                className="text-[11px]"
                href={appPath(org, app.application)}
              />
              {app.approval_required && (
                <Link
                  href={approvalPolicyPath(org, app.application)}
                  className="hover:underline"
                  title="Open the approval policy"
                >
                  <ApprovalRequiredChip variant="inline" pending={app.pending_requests} className="text-[11px]" />
                </Link>
              )}
            </div>
          )}
        </div>
        <RelativeTime iso={app.last_activity_at} className="shrink-0 text-xs text-muted-foreground" />
      </header>

      <OverviewStateNotice app={app} />
      {flaggedRows(app).length > 0 && (
        <div className="border-b px-4 py-3">
          <DeploymentFlags org={org} app={app} dense note={false} />
        </div>
      )}
      {(app.unresolved_operations?.length ?? 0) > 0 && (
        <div className="space-y-2 border-b px-4 py-3">
          {app.unresolved_operations?.map((op) => (
            <OperationRecovery key={op.operation_id} org={org} app={app.application} operationId={op.operation_id} />
          ))}
        </div>
      )}
      {reviews.length > 0 && (
        <div className="space-y-2 border-b px-4 py-3">
          {reviews.map((r) => (
            <EmergencyReviewCard
              key={r.id}
              org={org}
              app={app.application}
              platform={app.platform}
              review={r}
              canAcknowledge={canAcknowledgeEmergency(approval.policy, me, Boolean(approval.error))}
              onChanged={onChanged}
              dense
            />
          ))}
        </div>
      )}

      {app.error ? (
        <div className="p-4">
          <LookupFailedChip />
          <ErrorState className="mt-3" title="This app could not be read" message={app.error} />
        </div>
      ) : (
        <>
          <div className="space-y-2 border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <PanelTitle>Live</PanelTitle>
              {live.length === 0 && <NothingLiveChip variant="inline" />}
            </div>
            {live.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>No release has been made live on this platform.</p>
                {active.length === 0 && (
                  <>
                    <p className="text-xs">
                      A new release starts at zero traffic. Nothing is served until you start its rollout and make it
                      live.
                    </p>
                    <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                      <Link href={classicNewReleasePath(org, app.application)}>
                        <Plus /> Create the first release
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {live.map((l) => (
                  <LiveRow key={l.release_id} org={org} app={app} live={l} />
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <PanelTitle>Rolling out</PanelTitle>
              <AdoptionNote telemetry={app.telemetry} />
            </div>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing rolling out.</p>
            ) : (
              active.map((r) => (
                <ActiveBlock
                  key={r.release_id}
                  org={org}
                  app={app}
                  release={r}
                  liveNow={liveForContext(app, r.dimensions)}
                  permissions={permissions}
                  approval={{ ...approvalCtx, sensitive: protectionFor(app, r.release_id) }}
                  onChanged={onChanged}
                />
              ))
            )}
          </div>

          {app.approval_required && (
            <div className="space-y-2 border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <PanelTitle>Awaiting approval</PanelTitle>
                <Link
                  href={approvalPolicyPath(org, app.application)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  policy
                </Link>
              </div>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open requests.</p>
              ) : (
                <ul className="-mx-4 divide-y border-y">
                  {pending.map((r) => (
                    <RequestRow key={r.id} org={org} request={r} platform={app.platform} me={me} dense />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function LiveRow({ org, app, live }: { org: string; app: AppStatus; live: LiveRelease }) {
  const sensitive = protectionFor(app, live.release_id);
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Link
          href={releasePath(org, app.application, live.release_id)}
          className="group/live inline-flex items-baseline gap-2"
        >
          <Pkg version={live.package_version} size="lg" title={`config ${live.config_version}`} />
          <ArrowUpRight className="h-3.5 w-3.5 self-center text-muted-foreground opacity-0 group-hover/live:opacity-100" />
        </Link>
        {sensitive && app.approval_required && (
          <RollbackSensitiveChip reason={sensitive} variant="inline" className="mt-0.5 text-[11px]" />
        )}
        {!isDefaultContext(live.dimensions) && (
          <p className="truncate font-mono text-xs text-muted-foreground" title={describeContext(live.dimensions)}>
            {describeContext(live.dimensions)}
          </p>
        )}
        <div className="mt-0.5">
          <AdoptionLine telemetry={app.telemetry} releaseId={live.release_id} fallback />
        </div>
      </div>
      <RelativeTime iso={live.concluded_at} prefix="since " className="shrink-0 pt-1 text-xs text-muted-foreground" />
    </li>
  );
}

function ActiveBlock({
  org,
  app,
  release,
  liveNow,
  permissions,
  approval,
  onChanged,
}: {
  org: string;
  app: AppStatus;
  release: ActiveRelease;
  liveNow: LiveRelease | undefined;
  permissions: ReleasePermissionSet;
  approval: {
    ready: boolean;
    policy: ApprovalPolicy | undefined;
    me: string | null;
    sensitive: RollbackSensitiveReason | null | undefined;
  };
  onChanged: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={releasePath(org, app.application, release.release_id)}
          className="inline-flex items-baseline gap-2 hover:underline"
        >
          <Pkg version={release.package_version} size="lg" />
          <StatusChip status={release.status} variant="inline" />
        </Link>
        <span className="text-xs text-muted-foreground">
          {release.created_by} · <RelativeTime iso={release.created_at} />
        </span>
      </div>
      <RolloutTargetBar
        target={release.traffic_percentage}
        tone={toneForStatus(release.status)}
        size="md"
        label="rollout target"
      />
      {release.status === "INPROGRESS" && <AdoptionLine telemetry={app.telemetry} releaseId={release.release_id} />}
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <Reach
          dimensions={release.dimensions}
          compact
          className="[&_p]:text-xs [&_p]:font-normal [&_p]:text-muted-foreground"
        />
        <span className="shrink-0">
          {liveNow ? (
            <>
              replaces <Pkg version={liveNow.package_version} size="sm" />
            </>
          ) : (
            "nothing live for this reach"
          )}
        </span>
      </div>
      <ReleaseActionBar
        org={org}
        app={app.application}
        platform={app.platform}
        release={{
          releaseId: release.release_id,
          status: release.status,
          packageVersion: release.package_version,
          trafficPercentage: release.traffic_percentage,
          dimensions: release.dimensions,
          // From the overview's own active list; missing means Make live is blocked, never guessed.
          experimentalVariant: release.experimental_variant || undefined,
          outcome: "active",
        }}
        liveNow={liveNow}
        permissions={{
          ready: permissions.isReady,
          ramp: permissions.ramp,
          conclude: permissions.conclude,
          rollback: permissions.conclude,
          update: permissions.update,
        }}
        approval={approval}
        // Same warning the release page gives: a general release does not replace a live locale-targeted one.
        localeExceptions={localeExceptions(app, release.dimensions)}
        otherOngoing={app.active.find(
          (a) => a.release_id !== release.release_id && contextKey(a.dimensions) === contextKey(release.dimensions)
        )}
        flag={flagForRelease(app, release.release_id)}
        size="sm"
        onChanged={onChanged}
      />
    </div>
  );
}
