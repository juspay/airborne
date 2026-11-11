"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import { useApprovalPolicy, useDeploymentRequests, useMe, useOverview } from "@/lib/control-center/hooks";
import { locateApp } from "@/lib/control-center/format";
import { canAcknowledgeEmergency, isOpenRequest } from "@/lib/control-center/approval";
import { CcPageHeader } from "@/components/control-center/page-header";
import { PlatformMark } from "@/components/control-center/platform-mark";
import { ApprovalRequiredChip, StateChip } from "@/components/control-center/status-badge";
import { ApprovalPolicyEditor } from "@/components/control-center/approval-policy-editor";
import { RequestRow } from "@/components/control-center/request-card";
import { EmergencyReviewCard } from "@/components/control-center/emergency-review";
import { ApprovalNotice } from "@/components/control-center/approval-notices";
import { BlockSkeleton, EmptyState, Panel, PanelTitle } from "@/components/control-center/states";
import { appPath, APPROVALS_PATH } from "@/components/control-center/paths";
import { ShieldOff } from "lucide-react";

/** Policy editor under the application's Control Center settings. Owners and admins edit; others read. */
export default function ApprovalPolicyPage() {
  const params = useParams<{ orgId: string; appId: string }>();
  const orgId = decodeURIComponent(params.orgId ?? "");
  const appId = decodeURIComponent(params.appId ?? "");
  const { org, app, setOrg, setApp, getOrgAccess, user } = useAppContext();
  const me = useMe();

  useEffect(() => {
    if (org !== orgId) setOrg(orgId);
    if (app !== appId) setApp(appId);
  }, [org, app, orgId, appId, setOrg, setApp]);

  const { overview, refresh } = useOverview();
  const located = useMemo(() => locateApp(overview, orgId, appId), [overview, orgId, appId]);
  const { policy, isLoading, error: policyError } = useApprovalPolicy(orgId, appId);
  const { requests } = useDeploymentRequests(orgId, appId);
  const pending = (requests ?? []).filter((r) => isOpenRequest(r.status));
  const reviews = (located.app?.emergency_needs_review ?? []).filter((r) => !r.acknowledged_by);

  // Same rule as the server: organisation owner or admin. A super admin must hold that role too.
  const access = getOrgAccess(orgId);
  const canEdit = access.includes("owner") || access.includes("admin");

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <CcPageHeader
          back={{ label: appId, href: appPath(orgId, appId) }}
          title={
            <span className="inline-flex items-baseline gap-3">
              <span>Approval policy</span>
              <span className="text-muted-foreground">for</span>
              <PlatformMark platform={located.app?.platform ?? null} size="md" className="text-2xl" />
            </span>
          }
          titleAdornment={
            policy ? (
              policy.enabled ? (
                <ApprovalRequiredChip pending={pending.length} />
              ) : (
                <StateChip tone="muted" icon={ShieldOff}>
                  Approval off
                </StateChip>
              )
            ) : undefined
          }
          subtitle={
            <span>
              <span className="font-mono text-xs">{appId}</span> · Maker-checker for this application only. A group page
              can apply one policy to every platform at once.
              {user?.is_super_admin &&
                !canEdit &&
                " You are a super admin without the owner or admin role here, so the server will refuse edits."}
            </span>
          }
          actions={
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href={APPROVALS_PATH}>Approval queue</Link>
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="space-y-4">
            <Panel className="p-4">
              <ApprovalPolicyEditor org={orgId} app={appId} canEdit={canEdit} />
            </Panel>
            <ApprovalNotice title="What the policy cannot protect against">
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li>Anyone with direct Superposition or database access bypasses it: it protects the Airborne API.</li>
                <li>Owners and admins can change this policy. Changes are audited, not prevented.</li>
                <li>An API token acts as its owner: a CI token owned by a person counts as that person.</li>
                <li>The on-device boot guard rolls back without approval, by design.</li>
              </ul>
            </ApprovalNotice>
          </div>

          <div className="space-y-4">
            <Panel>
              <div className="flex items-center justify-between border-b px-4 py-2">
                <PanelTitle>Awaiting approval</PanelTitle>
                <span className="text-xs text-muted-foreground">{pending.length}</span>
              </div>
              {isLoading && !requests ? (
                <BlockSkeleton className="h-20 rounded-none" />
              ) : pending.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No open requests for this application.</p>
              ) : (
                <ul className="divide-y">
                  {pending.map((r) => (
                    <RequestRow
                      key={r.id}
                      org={orgId}
                      request={r}
                      platform={located.app?.platform ?? null}
                      me={me}
                      dense
                    />
                  ))}
                </ul>
              )}
            </Panel>
            {reviews.length > 0 && (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <EmergencyReviewCard
                    key={r.id}
                    org={orgId}
                    app={appId}
                    platform={located.app?.platform ?? null}
                    review={r}
                    canAcknowledge={canAcknowledgeEmergency(policy, me, Boolean(policyError))}
                    onChanged={() => void refresh()}
                    dense
                  />
                ))}
              </div>
            )}
            {!located.app && overview && (
              <EmptyState
                title="Not in the overview"
                message="This application is not readable in the overview, so live state cannot be shown here."
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
