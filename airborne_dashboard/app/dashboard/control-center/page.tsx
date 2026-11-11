"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderPlus, Layers, Plus, Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/providers/app-context";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { useOverview } from "@/lib/control-center/hooks";
import { allApps, summariseAttention } from "@/lib/control-center/format";
import { appTelemetryState } from "@/lib/control-center/telemetry";
import type { AppGroup, AppStatus, OverviewGroup, OverviewOrganisation } from "@/lib/control-center/types";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated } from "@/components/control-center/time";
import { AttentionStrip, type Focus } from "@/components/control-center/attention-strip";
import { GroupCard } from "@/components/control-center/group-card";
import { UngroupedSection } from "@/components/control-center/ungrouped-table";
import { EmptyState, ErrorState, OverviewSkeleton } from "@/components/control-center/states";
import { GroupEditorDialog, type GroupEditorMode } from "@/components/control-center/group-editor-dialog";
import { DeleteGroupDialog } from "@/components/control-center/delete-group-dialog";
import { APPROVALS_PATH } from "@/components/control-center/paths";

const PAGE_AUTHZ = definePagePermissions({
  manage_groups: permission("app_group", "create", "org"),
});

function matchesFocus(app: AppStatus, focus: Focus): boolean {
  switch (focus) {
    case "all":
      return true;
    case "bad":
      return appTelemetryState(app) === "seems_bad";
    case "suspicious":
      return appTelemetryState(app) === "suspicious_reports";
    case "insufficient":
      return ["insufficient_data", "observed_only"].includes(appTelemetryState(app));
    case "paused":
      return Boolean(app.unresolved_operations?.length);
    case "cache":
      return app.cache_invalidation?.status === "failed";
    case "review":
      return Boolean(app.emergency_needs_review?.some((r) => !r.acknowledged_by));
    case "approval":
      return (app.pending_requests ?? 0) > 0;
    case "rolling":
      return app.active.some((r) => r.status === "INPROGRESS");
    case "waiting":
      return app.active.some((r) => r.status === "CREATED");
    case "failed":
      return Boolean(app.error);
    case "nothing":
      return !app.error && app.live.length === 0 && app.active.length === 0;
  }
}

function toAppGroup(g: OverviewGroup): AppGroup {
  return {
    id: g.id,
    name: g.name,
    members: g.members.map((m) => ({ application: m.application, platform: m.platform ?? "other" })),
  };
}

export default function ControlCenterOverviewPage() {
  const { org: contextOrg, setOrg, getOrgAccess, user } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const { overview, error, isLoading, isValidating, lastUpdatedAt, pollMs, refresh } = useOverview();

  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus>("all");
  const [editor, setEditor] = useState<{ org: string; mode: GroupEditorMode } | null>(null);
  const [deleting, setDeleting] = useState<{ org: string; group: AppGroup } | null>(null);

  /**
   * The server requires an org owner or admin (or a super admin) for group writes, even when a custom role carries
   * the group permissions, so the controls need that too. For the org in context the authz hook adds the permission.
   */
  const canManage = (orgName: string) => {
    const access = getOrgAccess(orgName);
    const isAdmin = Boolean(user?.is_super_admin) || access.includes("owner") || access.includes("admin");
    if (!isAdmin) return false;
    if (orgName === contextOrg && permissions.isReady) return permissions.can("manage_groups");
    return true;
  };

  const summary = useMemo(() => summariseAttention(allApps(overview)), [overview]);
  const totals = useMemo(() => {
    const orgs = overview?.organisations ?? [];
    return {
      orgs: orgs.length,
      groups: orgs.reduce((n, o) => n + o.groups.length, 0),
      apps: allApps(overview).length,
    };
  }, [overview]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const orgs = overview?.organisations ?? [];
    return orgs
      .map((o) => {
        const orgHit = q.length > 0 && o.name.toLowerCase().includes(q);
        const groups = o.groups
          .map((g) => {
            const groupHit = orgHit || (q.length > 0 && g.name.toLowerCase().includes(q));
            const members = g.members.filter(
              (m) => matchesFocus(m, focus) && (q.length === 0 || groupHit || m.application.toLowerCase().includes(q))
            );
            return members.length > 0
              ? { ...g, members: focus === "all" && (groupHit || q.length === 0) ? g.members : members }
              : null;
          })
          .filter((g): g is OverviewGroup => g !== null);
        const ungrouped = o.ungrouped.filter(
          (m) => matchesFocus(m, focus) && (q.length === 0 || orgHit || m.application.toLowerCase().includes(q))
        );
        return { org: o, groups, ungrouped };
      })
      .filter((x) => x.groups.length > 0 || x.ungrouped.length > 0 || (query.trim() === "" && focus === "all"));
  }, [overview, query, focus]);

  const openCreate = (orgName: string, preselect?: string) => {
    if (orgName !== contextOrg) setOrg(orgName);
    setEditor({ org: orgName, mode: { kind: "create", preselect } });
  };
  const openEdit = (orgName: string, group: OverviewGroup) => {
    if (orgName !== contextOrg) setOrg(orgName);
    setEditor({ org: orgName, mode: { kind: "edit", group: toAppGroup(group) } });
  };

  const editorOrg = editor ? overview?.organisations.find((o) => o.name === editor.org) : undefined;

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <CcPageHeader
          title="Control Center"
          subtitle={
            <span>
              Live and rolling-out releases per platform. Percentages are rollout{" "}
              <strong className="font-medium text-foreground">targets</strong>; device counts are reported boots,
              unverified.
            </span>
          }
          actions={
            <>
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter apps, groups, orgs"
                  className="h-8 w-full pl-7 text-sm sm:w-56"
                  aria-label="Filter"
                />
              </div>
              <LastUpdated at={lastUpdatedAt} pollMs={pollMs} isValidating={isValidating} onRefresh={refresh} />
              {summary.approvalOn + summary.awaitingApproval + summary.needsReview > 0 && (
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Link href={APPROVALS_PATH}>
                    <UserCheck className="h-3.5 w-3.5" />
                    Approvals
                    {summary.awaitingApproval + summary.needsReview > 0 && (
                      <span className="rounded bg-violet-500/15 px-1.5 font-mono text-[11px] text-violet-800 dark:text-violet-200">
                        {summary.awaitingApproval + summary.needsReview}
                      </span>
                    )}
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {isLoading && !overview ? (
          <OverviewSkeleton />
        ) : error && !overview ? (
          <ErrorState title="Could not load the overview" message={error.message} onRetry={refresh} />
        ) : !overview || overview.organisations.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No organisations to show"
            message="You are not a member of any organisation yet, or none is readable with your role."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">Go to organisations</Link>
              </Button>
            }
          />
        ) : (
          <>
            {error && (
              <ErrorState
                title="Showing the last successful refresh"
                message={`The latest refresh failed: ${error.message}`}
                onRetry={refresh}
              />
            )}
            {allApps(overview).every((app) => !app.error && app.live.length === 0 && app.active.length === 0) && (
              <div className="rounded-lg border p-5 space-y-2" aria-label="First release checklist">
                <h2 className="font-semibold">Your first OTA release</h2>
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  <li>
                    <Link className="underline" href="/dashboard">
                      Create an app
                    </Link>{" "}
                    in your organisation, separately for each platform.
                  </li>
                  <li>
                    <a className="underline" href="https://airborne.juspay.in/docs/guides/integrate-react-native/">
                      Wire the SDK
                    </a>
                    , configure a compatible app version, and rebuild the native app.
                  </li>
                  <li>
                    Upload a package and create a targeted release from the app&apos;s Releases page. Ramp, then
                    conclude explicitly to make it live.
                  </li>
                </ol>
              </div>
            )}
            <AttentionStrip summary={summary} focus={focus} onFocus={setFocus} totals={totals} />

            {filtered.length === 0 && (
              <EmptyState title="Nothing matches" message="Clear the filter or pick a different attention chip." />
            )}

            {filtered.map(({ org, groups, ungrouped }) => (
              <OrgSection
                key={org.name}
                org={org}
                groups={groups}
                ungrouped={ungrouped}
                filtering={query.trim().length > 0 || focus !== "all"}
                canManage={canManage(org.name)}
                onCreate={(preselect) => openCreate(org.name, preselect)}
                onEdit={(g) => openEdit(org.name, g)}
                onDelete={(g) => setDeleting({ org: org.name, group: toAppGroup(g) })}
              />
            ))}
          </>
        )}
      </div>

      {editor && (
        <GroupEditorDialog
          open
          onOpenChange={(o) => !o && setEditor(null)}
          org={editor.org}
          mode={editor.mode}
          groups={(editorOrg?.groups ?? []).map(toAppGroup)}
        />
      )}
      <DeleteGroupDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        org={deleting?.org ?? ""}
        group={deleting?.group ?? null}
      />
    </>
  );
}

function OrgSection({
  org,
  groups,
  ungrouped,
  filtering,
  canManage,
  onCreate,
  onEdit,
  onDelete,
}: {
  org: OverviewOrganisation;
  groups: OverviewGroup[];
  ungrouped: AppStatus[];
  filtering: boolean;
  canManage: boolean;
  onCreate: (preselect?: string) => void;
  onEdit: (g: OverviewGroup) => void;
  onDelete: (g: OverviewGroup) => void;
}) {
  const totalApps = org.groups.reduce((n, g) => n + g.members.length, 0) + org.ungrouped.length;
  const noGroups = org.groups.length === 0 && totalApps > 0;
  const noApps = totalApps === 0;

  return (
    <section aria-labelledby={`org-${org.name}`} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-2">
        <h2 id={`org-${org.name}`} className="text-base font-semibold tracking-tight">
          {org.name}
        </h2>
        <span className="text-xs text-muted-foreground">
          {org.groups.length} group{org.groups.length === 1 ? "" : "s"} · {totalApps} app{totalApps === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            <Link href={`/dashboard/${encodeURIComponent(org.name)}`}>Applications</Link>
          </Button>
          {canManage && !noApps && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => onCreate()}>
              <Plus className="h-3.5 w-3.5" /> New group
            </Button>
          )}
        </div>
      </div>

      {noApps && (
        <EmptyState
          title={canManage ? `${org.name} has no applications yet` : `No applications you can read in ${org.name}`}
          message={
            canManage
              ? "Create an application first; it will appear here with its live and rolling-out releases."
              : "Either the organisation has none yet, or your role does not include access to its applications. Ask an organisation admin to grant you access."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${encodeURIComponent(org.name)}`}>Open applications</Link>
            </Button>
          }
        />
      )}

      {noGroups && !filtering && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <FolderPlus className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="flex-1 text-sm">
            <p className="font-medium">No groups in {org.name} yet</p>
            <p className="text-muted-foreground">
              A group is one product across platforms, for example an Android and an iOS app side by side. Until then
              every app is listed under Ungrouped.
            </p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => onCreate()}>
              <Plus /> Create the first group
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">An organisation admin can create groups.</p>
          )}
        </div>
      )}

      {groups.map((g) => (
        <GroupCard key={g.id} org={org.name} group={g} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
      ))}

      <UngroupedSection org={org.name} apps={ungrouped} canManage={canManage} onAddToGroup={(app) => onCreate(app)} />
    </section>
  );
}
