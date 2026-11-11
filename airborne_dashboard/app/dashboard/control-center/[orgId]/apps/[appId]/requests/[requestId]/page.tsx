"use client";
import { EvidenceBlock } from "@/components/control-center/telemetry";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import { ErrorName } from "@/lib/api";
import {
  useApprovalPolicy,
  useDeploymentRequest,
  useMe,
  useOverview,
  useReleaseEvents,
  useReleasePermissions,
} from "@/lib/control-center/hooks";
import { locateApp } from "@/lib/control-center/format";
import { evidenceForRelease } from "@/lib/control-center/telemetry";
import {
  actionLabel,
  isExpired,
  isOpenRequest,
  permissionForAction,
  summariseRequest,
} from "@/lib/control-center/approval";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated, RelativeTime } from "@/components/control-center/time";
import { PlatformMark } from "@/components/control-center/platform-mark";
import { RequestStatusChip } from "@/components/control-center/status-badge";
import {
  ReachForRequest,
  RequestChange,
  RequestDecision,
  RequestFacts,
  RequestTimeline,
} from "@/components/control-center/request-card";
import { PolicySummary } from "@/components/control-center/approval-policy-editor";
import {
  BlockSkeleton,
  EmptyState,
  ErrorState,
  Panel,
  PanelTitle,
  PermissionDenied,
} from "@/components/control-center/states";
import { APPROVALS_PATH, releasePath } from "@/components/control-center/paths";

export default function DeploymentRequestPage() {
  const params = useParams<{ orgId: string; appId: string; requestId: string }>();
  const orgId = decodeURIComponent(params.orgId ?? "");
  const appId = decodeURIComponent(params.appId ?? "");
  const requestId = decodeURIComponent(params.requestId ?? "");
  const { org, app, setOrg, setApp } = useAppContext();
  const me = useMe();

  useEffect(() => {
    if (org !== orgId) setOrg(orgId);
    if (app !== appId) setApp(appId);
  }, [org, app, orgId, appId, setOrg, setApp]);

  const { overview, error: overviewError, isLoading: overviewLoading, refresh: refreshOverview } = useOverview();
  const located = useMemo(() => locateApp(overview, orgId, appId), [overview, orgId, appId]);
  const query = useDeploymentRequest(orgId, appId, requestId);
  const request = query.request;
  const { policy } = useApprovalPolicy(orgId, appId);
  const permissions = useReleasePermissions(orgId, appId);
  const releaseId = request?.payload.release_id ?? null;
  const evidence = evidenceForRelease(located.app, releaseId, Boolean(overviewError));
  const events = useReleaseEvents(orgId, appId, releaseId, Boolean(request && isOpenRequest(request.status)));

  const denied = (permissions.isReady && !permissions.read) || query.error?.name === ErrorName.Forbidden;
  // The server checks the same permission for approve, reject and cancel (`permission_action`).
  const permitted = request ? permissions[permissionForAction(request.action)] : false;

  const refreshAll = () => {
    void refreshOverview();
    void query.refresh();
    void events.refresh();
  };

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <CcPageHeader
          back={{ label: "Approvals", href: APPROVALS_PATH }}
          title={
            request && !denied ? (
              <span className="inline-flex flex-wrap items-baseline gap-x-3">
                <span>{actionLabel(request.action)} request</span>
                <span className="text-muted-foreground">on</span>
                <PlatformMark platform={located.app?.platform ?? null} size="md" className="text-2xl" />
              </span>
            ) : (
              "Deployment request"
            )
          }
          titleAdornment={
            request && !denied ? (
              <RequestStatusChip
                status={request.status === "pending" && isExpired(request) ? "expired" : request.status}
              />
            ) : undefined
          }
          subtitle={
            request && !denied ? (
              <span className="inline-flex flex-wrap items-center gap-x-2">
                <span>{summariseRequest(request)}</span>
                <span aria-hidden>·</span>
                <span className="font-mono text-xs">{appId}</span>
                <span aria-hidden>·</span>
                <span>
                  raised <RelativeTime iso={request.created_at} /> by{" "}
                  <span className="font-mono text-xs">{request.requester}</span>
                </span>
              </span>
            ) : undefined
          }
          actions={
            <>
              <LastUpdated
                at={query.lastUpdatedAt}
                pollMs={query.pollMs}
                isValidating={query.isValidating}
                onRefresh={refreshAll}
                unknown={located.app?.auxiliary_error != null}
              />
              {releaseId && (
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href={releasePath(orgId, appId, releaseId)}>Open the release</Link>
                </Button>
              )}
            </>
          }
        />

        {denied ? (
          <PermissionDenied what={`read requests in ${appId}`} />
        ) : query.isLoading && !request ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="space-y-4">
              <EvidenceBlock org={orgId} app={appId} evidence={evidence} loading={overviewLoading && !overview} />
              <BlockSkeleton className="h-48" />
              <BlockSkeleton className="h-32" />
            </div>
            <div className="space-y-4">
              <EvidenceBlock org={orgId} app={appId} evidence={evidence} loading={overviewLoading && !overview} />
              <BlockSkeleton className="h-64" />
            </div>
          </div>
        ) : query.error && !request ? (
          <ErrorState
            title="Could not load this request"
            message={query.error.message}
            onRetry={() => query.refresh()}
          />
        ) : !request ? (
          <EmptyState
            title="Request not found"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={APPROVALS_PATH}>Back to approvals</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="space-y-4">
              <EvidenceBlock org={orgId} app={appId} evidence={evidence} loading={overviewLoading && !overview} />
              <Panel className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <PanelTitle>The change, against what is live</PanelTitle>
                </div>
                {located.app?.auxiliary_error != null && (
                  <p role="alert">Application approval and marker state could not be read. Refresh before acting.</p>
                )}
                <RequestChange
                  org={orgId}
                  request={request}
                  app={located.app}
                  unreadable={Boolean(overviewError) && !overview}
                />
              </Panel>

              <Panel className="space-y-3 p-4">
                <PanelTitle>Decision</PanelTitle>
                <RequestDecision
                  org={orgId}
                  request={request}
                  policy={policy}
                  me={me}
                  permitted={permissions.isReady && permitted}
                  evidence={evidence}
                  evidenceLoading={overviewLoading && !overview}
                  onChanged={refreshAll}
                />
              </Panel>

              <Panel className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <PanelTitle>Timeline</PanelTitle>
                  <span className="text-xs text-muted-foreground">newest first</span>
                </div>
                <RequestTimeline
                  request={request}
                  events={events.events}
                  isLoading={events.isLoading}
                  error={events.error}
                  onRetry={() => events.refresh()}
                />
              </Panel>
            </div>

            <div className="space-y-4">
              <EvidenceBlock org={orgId} app={appId} evidence={evidence} loading={overviewLoading && !overview} />
              <Panel className="p-4">
                <PanelTitle className="mb-2">Facts</PanelTitle>
                <RequestFacts request={request} platform={located.app?.platform ?? null} />
              </Panel>
              <Panel className="space-y-3 p-4">
                <PanelTitle>Reach</PanelTitle>
                <ReachForRequest request={request} />
              </Panel>
              {policy && <PolicySummary policy={policy} />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
