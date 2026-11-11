"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, FolderPlus, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { useOverview, useScopeGroups } from "@/lib/control-center/hooks";
import { useScope } from "@/components/scope/use-scope";
import {
  buildScopeTree,
  CC_BASE,
  describeScope,
  filterOverview,
  resolveGroup,
  readCutShort,
  scopedHref,
  scopeOutcome,
  unconfirmedOrg,
} from "@/lib/control-center/scope";
import { allApps, summariseAttention } from "@/lib/control-center/format";
import { appTelemetryState } from "@/lib/control-center/telemetry";
import type { AppGroup, AppStatus, OverviewGroup, OverviewOrganisation } from "@/lib/control-center/types";
import { appPath } from "@/components/control-center/paths";
import { OrgReadNotice, UnconfirmedRead } from "@/components/control-center/read-notice";
import { NotFoundActions } from "@/components/control-center/not-found-actions";
import { cn } from "@/lib/utils";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated } from "@/components/control-center/time";
import { AttentionChips, AttentionStrip, type Focus } from "@/components/control-center/attention-strip";
import { GroupCard } from "@/components/control-center/group-card";
import { UngroupedSection } from "@/components/control-center/ungrouped-table";
import { EmptyState, ErrorState, OverviewSkeleton } from "@/components/control-center/states";
import { GroupEditorDialog, type GroupEditorMode } from "@/components/control-center/group-editor-dialog";
import { DeleteGroupDialog } from "@/components/control-center/delete-group-dialog";
import { DeploymentFlags } from "@/components/control-center/telemetry";
import { FirstRunChecklist, useFirstRunMemory } from "@/components/control-center/first-run";
import { firstRunProgress, firstRunView } from "@/lib/control-center/first-run";

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

/**
 * At application scope the Overview is the application's own page: a link or bookmark that names an application here
 * goes there, so one place has one home.
 */
export default function ControlCenterOverviewPage() {
  const router = useRouter();
  const scope = useScope();
  const toApp = scope.org && scope.app ? appPath(scope.org, scope.app) : null;
  useEffect(() => {
    if (toApp) router.replace(toApp);
  }, [toApp, router]);
  if (toApp) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <OverviewSkeleton />
      </div>
    );
  }
  return <ScopedOverview />;
}

function ScopedOverview() {
  const scope = useScope();
  const { org: contextOrg, setOrg, getOrgAccess, user } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const raw = useOverview(scope);
  const { error, isLoading, isValidating, lastUpdatedAt, pollMs, refresh } = raw;
  // The server narrows the overview too; filtering again keeps the page right against a server that ignores the scope.
  const overview = useMemo(() => filterOverview(raw.overview, scope), [raw.overview, scope]);
  const { organisations } = useAppContext();
  // Only the organisation in scope is asked for its groups: the group's name is all this page needs them for.
  const { groupsByOrg } = useScopeGroups(scope.org ? [scope.org] : [], Boolean(scope.group));
  const groupName = resolveGroup(scope, buildScopeTree(organisations, groupsByOrg))?.name;
  const scoped = Boolean(scope.org);
  const outcome = !isLoading && !error ? scopeOutcome(overview, scope) : undefined;
  // At All the page is one summary row per organisation; a row opens on click. Rows open by themselves while a filter
  // is on (the matches must be visible) and for an organisation with nothing in it (its checklist is the way forward).
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggleOrg = (name: string) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

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
    const orgs = overview?.organisations ?? [];
    return orgs
      .map((o) => {
        const groups = o.groups
          .map((g) => {
            const members = g.members.filter((m) => matchesFocus(m, focus));
            return members.length > 0 ? { ...g, members: focus === "all" ? g.members : members } : null;
          })
          .filter((g): g is OverviewGroup => g !== null);
        const ungrouped = o.ungrouped.filter((m) => matchesFocus(m, focus));
        return { org: o, groups, ungrouped };
      })
      .filter((x) => x.groups.length > 0 || x.ungrouped.length > 0 || focus === "all");
  }, [overview, focus]);

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
              <span className="text-foreground" data-testid="scope-line">
                {scoped ? `Showing ${describeScope(scope, groupName)}.` : "Showing all organisations you can read."}
              </span>{" "}
              Live and rolling-out releases per platform. Percentages are rollout{" "}
              <strong className="font-medium text-foreground">targets</strong>; device counts are reported boots,
              unverified.
            </span>
          }
          actions={<LastUpdated at={lastUpdatedAt} pollMs={pollMs} isValidating={isValidating} onRefresh={refresh} />}
        />

        {isLoading ? (
          <OverviewSkeleton />
        ) : error && !raw.overview ? (
          <ErrorState title="Could not load the overview" message={error.message} onRetry={refresh} />
        ) : outcome === "unconfirmed" && overview ? (
          <UnconfirmedRead
            orgs={overview.organisations}
            title={`Could not confirm ${describeScope(scope, groupName)}`}
            message="The read that lists it did not finish, so this is not the same as it being gone or empty. Try again."
            onRetry={refresh}
          />
        ) : !overview || overview.organisations.length === 0 ? (
          scoped ? (
            <EmptyState
              icon={Layers}
              title={`${describeScope(scope, groupName)} was not found, or you have no access`}
              message="Either it does not exist, or your role cannot read it. This says nothing about whether anything is live."
              action={<NotFoundActions org={scope.org} base={CC_BASE} />}
            />
          ) : (
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
          )
        ) : (
          <>
            {error && (
              <ErrorState
                title="Showing the last successful refresh"
                message={`The latest refresh failed: ${error.message}`}
                onRetry={refresh}
              />
            )}
            {overview.organisations.flatMap((org) =>
              [...org.groups.flatMap((g) => g.members), ...org.ungrouped].map((app) => (
                <DeploymentFlags key={`${org.name}:${app.application}`} org={org.name} app={app} dense note={false} />
              ))
            )}
            {overview.organisations.map((o) => (
              <OrgReadNotice key={o.name} org={o} />
            ))}
            <AttentionStrip
              summary={summary}
              focus={focus}
              onFocus={setFocus}
              totals={totals}
              scoped={scoped}
              partial={overview.organisations.some(readCutShort)}
            />

            {filtered.length === 0 && (
              <EmptyState title="Nothing matches" message="Clear the filter or pick a different attention chip." />
            )}

            {filtered.map(({ org, groups, ungrouped }) => {
              // A cut-short read that listed nothing: the row says so and offers Retry, and no count, empty state or
              // first-run checklist is drawn from it.
              if (unconfirmedOrg(org)) return <UnconfirmedOrgRow key={org.name} org={org} onRetry={refresh} />;
              const section = (
                <OrgSection
                  org={org}
                  groups={groups}
                  ungrouped={ungrouped}
                  filtering={focus !== "all"}
                  heading={scoped}
                  canManage={canManage(org.name)}
                  onCreate={(preselect) => openCreate(org.name, preselect)}
                  onEdit={(g) => openEdit(org.name, g)}
                  onDelete={(g) => setDeleting({ org: org.name, group: toAppGroup(g) })}
                />
              );
              if (scoped) return <div key={org.name}>{section}</div>;
              const empty = org.groups.length === 0 && org.ungrouped.length === 0;
              return (
                <OrgSummaryRow
                  key={org.name}
                  org={org}
                  expanded={focus !== "all" || empty || open.has(org.name)}
                  locked={focus !== "all" || empty}
                  onToggle={() => toggleOrg(org.name)}
                >
                  {section}
                </OrgSummaryRow>
              );
            })}
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

/**
 * One organisation at All: its name, how much is in it and what in it needs a person, collapsed. The chips are the
 * overview's own, so a quiet row is quiet because nothing is flagged, and a row with a flag says so before it is opened.
 */
function OrgSummaryRow({
  org,
  expanded,
  locked,
  onToggle,
  children,
}: {
  org: OverviewOrganisation;
  expanded: boolean;
  /** Open because a filter or an empty organisation needs it open: the toggle is inert. */
  locked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const apps = [...org.groups.flatMap((g) => g.members), ...org.ungrouped];
  const attention = summariseAttention(apps);
  const panel = `org-panel-${org.name}`;
  return (
    <section aria-labelledby={`org-${org.name}`} className="rounded-lg border bg-card text-card-foreground">
      {/*
        Line one is the name and the counts; the status chips and Open wrap onto line two when they do not fit beside
        them. On a phone that is always: the name is never squeezed out by the badges, and nothing is drawn over
        anything else.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panel}
          disabled={locked}
          onClick={onToggle}
          className="flex min-w-0 basis-full items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:min-w-[16rem] sm:flex-1 sm:basis-0"
          data-testid="org-summary"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <h2
            id={`org-${org.name}`}
            className="min-w-0 truncate text-base font-semibold tracking-tight"
            title={org.name}
          >
            {org.name}
          </h2>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {org.groups.length} group{org.groups.length === 1 ? "" : "s"} · {apps.length} app
            {apps.length === 1 ? "" : "s"}
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-7 sm:flex-none sm:justify-end sm:pl-0">
          <AttentionChips summary={attention} />
          <Button asChild variant="ghost" size="sm" className="ml-auto h-7 text-xs text-muted-foreground">
            <Link href={scopedHref(CC_BASE, { org: org.name })} aria-label={`Open ${org.name}`}>
              Open
            </Link>
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={panel} className="border-t px-4 py-4">
          {children}
        </div>
      )}
    </section>
  );
}

function UnconfirmedOrgRow({ org, onRetry }: { org: OverviewOrganisation; onRetry: () => void }) {
  return (
    <section
      aria-labelledby={`org-${org.name}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-4 py-3 text-card-foreground"
      data-testid="org-unconfirmed"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <h2 id={`org-${org.name}`} className="min-w-0 truncate text-base font-semibold tracking-tight" title={org.name}>
        {org.name}
      </h2>
      <span className="text-xs text-muted-foreground">Could not confirm what is in it</span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
          Retry
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
          <Link href={scopedHref(CC_BASE, { org: org.name })} aria-label={`Open ${org.name}`}>
            Open
          </Link>
        </Button>
      </div>
    </section>
  );
}

function OrgSection({
  org,
  groups,
  ungrouped,
  filtering,
  heading,
  canManage,
  onCreate,
  onEdit,
  onDelete,
}: {
  org: OverviewOrganisation;
  groups: OverviewGroup[];
  ungrouped: AppStatus[];
  filtering: boolean;
  /** False under a summary row, which already names the organisation. */
  heading: boolean;
  canManage: boolean;
  onCreate: (preselect?: string) => void;
  onEdit: (g: OverviewGroup) => void;
  onDelete: (g: OverviewGroup) => void;
}) {
  const totalApps = org.groups.reduce((n, g) => n + g.members.length, 0) + org.ungrouped.length;
  const noGroups = org.groups.length === 0 && totalApps > 0;
  const noApps = totalApps === 0;
  const progress = firstRunProgress(org);
  const [memory, remember] = useFirstRunMemory(org.name);
  const firstRun = firstRunView(progress, memory);

  return (
    <section aria-labelledby={`org-${org.name}`} className="space-y-3">
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", heading && "border-b pb-2")}>
        {heading && (
          <>
            <h2 id={`org-${org.name}`} className="text-base font-semibold tracking-tight">
              {org.name}
            </h2>
            <span className="text-xs text-muted-foreground">
              {org.groups.length} group{org.groups.length === 1 ? "" : "s"} · {totalApps} app
              {totalApps === 1 ? "" : "s"}
            </span>
          </>
        )}
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

      {!filtering && (
        <FirstRunChecklist org={org.name} progress={progress} view={firstRun} memory={memory} remember={remember} />
      )}

      {/* The checklist already says to create an app; the empty list does not say it a second time. */}
      {noApps && firstRun !== "checklist" && (
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

      {noGroups && !filtering && firstRun !== "checklist" && (
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
