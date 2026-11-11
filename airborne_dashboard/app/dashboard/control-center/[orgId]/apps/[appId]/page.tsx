"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import {
  useApprovalPolicy,
  useMe,
  useOverview,
  useReleasePermissions,
  useServingPolicy,
  useTelemetry,
} from "@/lib/control-center/hooks";
import { canAcknowledgeEmergency, isOpenRequest } from "@/lib/control-center/approval";
import { locateApp, platformLabel } from "@/lib/control-center/format";
import { useDeploymentRequests } from "@/lib/control-center/hooks";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated } from "@/components/control-center/time";
import { PlatformMark } from "@/components/control-center/platform-mark";
import { ApprovalRequiredChip } from "@/components/control-center/status-badge";
import { AppStatusRow, RowHeader } from "@/components/control-center/app-status-row";
import { ServingChip, ServingPolicyPanel } from "@/components/control-center/serving-policy";
import { DeploymentFlags, DeviceReportsPanel, ExclusionsPanel } from "@/components/control-center/telemetry";
import { hasExclusions } from "@/lib/control-center/telemetry";
import { EmergencyReviewCard } from "@/components/control-center/emergency-review";
import { RequestRow } from "@/components/control-center/request-card";
import { PolicySummary } from "@/components/control-center/approval-policy-editor";
import { BlockSkeleton, EmptyState, ErrorState, Panel, PanelTitle } from "@/components/control-center/states";
import { approvalPolicyPath, CC_ROOT, classicAppPath, groupPath } from "@/components/control-center/paths";

/**
 * One application: what is live and rolling out, what needs attention, and the two per-app policies
 * (strict serving here, maker-checker on its own page). The overview row links here by app name.
 */
export default function ControlCenterAppPage() {
  const params = useParams<{ orgId: string; appId: string }>();
  const orgId = decodeURIComponent(params.orgId ?? "");
  const appId = decodeURIComponent(params.appId ?? "");
  const { org, app, setOrg, setApp } = useAppContext();
  const me = useMe();

  useEffect(() => {
    if (org !== orgId) setOrg(orgId);
    if (app !== appId) setApp(appId);
  }, [org, app, orgId, appId, setOrg, setApp]);

  const { overview, error, isLoading, isValidating, lastUpdatedAt, pollMs, refresh } = useOverview();
  const located = useMemo(() => locateApp(overview, orgId, appId), [overview, orgId, appId]);
  const status = located.app;
  const permissions = useReleasePermissions(orgId, appId);
  // The overview carries the policy too; this read is what a change refreshes first.
  const serving = useServingPolicy(orgId, appId);
  const approvalOn = Boolean(status?.approval_required);
  const reviews = (status?.emergency_needs_review ?? []).filter((r) => !r.acknowledged_by);
  // Acknowledging needs the checker list even after approval was switched off, so read the policy for reviews too.
  const approval = useApprovalPolicy(orgId, approvalOn || reviews.length > 0 ? appId : null);
  const requests = useDeploymentRequests(orgId, approvalOn ? appId : null);
  const open = (requests.requests ?? []).filter((r) => isOpenRequest(r.status));
  const policy = serving.policy ?? status?.serving_policy;
  // The fresh read carries the security exclusions; the overview's copy covers the rows until it lands.
  const device = useTelemetry(orgId, appId);
  const telemetry = device.telemetry ?? status?.telemetry;
  // A failed refresh makes the exclusions unknown, not whatever the last read said.
  const blocked = device.error ? null : device.telemetry ? device.telemetry.blocked_package_versions : undefined;

  const refreshAll = () => {
    void refresh();
    void serving.refresh();
    void requests.refresh();
    void device.refresh();
  };

  const crumbs = [
    { label: "Control Center", href: CC_ROOT },
    ...(located.group ? [{ label: located.group.name, href: groupPath(orgId, located.group.id) }] : [{ label: orgId }]),
    { label: appId },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <CcPageHeader
          crumbs={crumbs}
          title={
            <span className="inline-flex items-baseline gap-3">
              <span className="font-mono">{appId}</span>
              {status?.platform && <PlatformMark platform={status.platform} size="md" className="text-2xl" />}
            </span>
          }
          titleAdornment={
            status ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <ServingChip policy={policy} />
                {approvalOn && (
                  <Link href={approvalPolicyPath(orgId, appId)} className="hover:underline">
                    <ApprovalRequiredChip pending={open.length} />
                  </Link>
                )}
              </span>
            ) : undefined
          }
          subtitle={
            status ? (
              <span>
                {status.platform ? `${platformLabel(status.platform)} app` : "Application"} in {orgId}
                {located.group ? ` · group ${located.group.name}` : " · not in a group"}. Percentages are rollout
                targets.
              </span>
            ) : undefined
          }
          actions={
            <>
              <LastUpdated at={lastUpdatedAt} pollMs={pollMs} isValidating={isValidating} onRefresh={refreshAll} />
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href={classicAppPath(orgId, appId)}>
                  <ExternalLink /> Classic app page
                </Link>
              </Button>
            </>
          }
        />

        {isLoading && !overview ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="space-y-4">
              <BlockSkeleton className="h-28" />
              <BlockSkeleton className="h-72" />
            </div>
            <BlockSkeleton className="h-40" />
          </div>
        ) : error && !overview ? (
          <ErrorState title="Could not load this application" message={error.message} onRetry={refresh} />
        ) : !status ? (
          <EmptyState
            title={`${appId} is not readable in ${orgId}`}
            message="It may not exist, or your role may not include it."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={CC_ROOT}>Back to Control Center</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(19rem,1fr)]">
            <div className="min-w-0 space-y-4">
              {error && (
                <ErrorState title="Showing the last successful refresh" message={error.message} onRetry={refresh} />
              )}
              {reviews.map((r) => (
                <EmergencyReviewCard
                  key={r.id}
                  org={orgId}
                  app={appId}
                  platform={status.platform}
                  review={r}
                  canAcknowledge={canAcknowledgeEmergency(approval.policy, me, Boolean(approval.error))}
                  onChanged={refreshAll}
                />
              ))}

              <DeploymentFlags org={orgId} app={status} note={false} />

              <Panel>
                <div className="border-b px-4 py-2">
                  <PanelTitle>Live and rolling out</PanelTitle>
                </div>
                <RowHeader className="md:grid" />
                <AppStatusRow org={orgId} app={status} showPlatform={false} showChips={false} />
              </Panel>

              <DeviceReportsPanel
                org={orgId}
                app={status}
                telemetry={telemetry}
                isLoading={device.isLoading}
                error={device.error}
                onRetry={() => void device.refresh()}
              />

              <Panel className="space-y-3 p-4">
                <PanelTitle>Strict serving</PanelTitle>
                <ServingPolicyPanel
                  org={orgId}
                  app={appId}
                  platform={status.platform}
                  policy={policy}
                  live={status.live}
                  permissions={{ ready: permissions.isReady, update: permissions.update }}
                  approval={{ ready: !approvalOn || approval.isReady, policy: approval.policy, me }}
                  onChanged={refreshAll}
                />
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel className="space-y-3 p-4">
                {approvalOn && approval.policy ? (
                  <>
                    <PolicySummary policy={approval.policy} />
                    <p className="text-xs text-muted-foreground">
                      {open.length === 0
                        ? "No open requests."
                        : `${open.length} request${open.length === 1 ? "" : "s"} awaiting a checker.`}
                    </p>
                  </>
                ) : (
                  <>
                    <PanelTitle>Approval policy</PanelTitle>
                    <p className="text-sm text-muted-foreground">
                      {approvalOn
                        ? "Loading the policy…"
                        : "Off: release changes here are direct. An organisation admin can turn maker-checker on."}
                    </p>
                  </>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href={approvalPolicyPath(orgId, appId)}>Open approval policy</Link>
                </Button>
              </Panel>

              {hasExclusions(blocked) && (
                <Panel className="p-4">
                  <ExclusionsPanel blocked={blocked} isLoading={device.isLoading} />
                </Panel>
              )}

              {approvalOn && open.length > 0 && (
                <Panel>
                  <div className="border-b px-4 py-2">
                    <PanelTitle>Awaiting approval</PanelTitle>
                  </div>
                  <ul className="divide-y">
                    {open.slice(0, 6).map((r) => (
                      <RequestRow key={r.id} org={orgId} request={r} platform={status.platform} me={me} dense />
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
