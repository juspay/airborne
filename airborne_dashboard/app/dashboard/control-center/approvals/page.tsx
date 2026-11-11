"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useApprovalPolicy, useDeploymentRequests, useMe, useOverview } from "@/lib/control-center/hooks";
import { allApps } from "@/lib/control-center/format";
import { canAcknowledgeEmergency, isOpenRequest } from "@/lib/control-center/approval";
import type { AppStatus, DeploymentRequest, EmergencyReview, OverviewOrganisation } from "@/lib/control-center/types";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated } from "@/components/control-center/time";
import { RequestRow } from "@/components/control-center/request-card";
import { EmergencyReviewCard } from "@/components/control-center/emergency-review";
import { BlockSkeleton, EmptyState, ErrorState, Panel, PanelTitle } from "@/components/control-center/states";
import { StateChip } from "@/components/control-center/status-badge";
import { useScope } from "@/components/scope/use-scope";
import {
  APPROVALS_BASE,
  CC_BASE,
  describeScope,
  filterOverview,
  readCutShort,
  scopedHref,
  scopeOutcome,
  unconfirmedOrg,
} from "@/lib/control-center/scope";
import { Eye, UserCheck, History } from "lucide-react";
import { OrgReadNotice, UnconfirmedRead } from "@/components/control-center/read-notice";
import { NotFoundActions } from "@/components/control-center/not-found-actions";

type Section = "awaiting" | "review" | "decided";

/**
 * The organisation-wide queue. Pending requests are ordered by expiry, so the one about to lapse is
 * first. Emergency rollbacks awaiting a second checker sit beside them. Everything else is history.
 */
export default function ApprovalsPage() {
  const me = useMe();
  const scope = useScope();
  const raw = useOverview(scope);
  const { error, isLoading, isValidating, lastUpdatedAt, pollMs, refresh } = raw;
  const overview = useMemo(() => filterOverview(raw.overview, scope), [raw.overview, scope]);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<Section>("awaiting");
  // At All, an organisation with nothing in the open tab takes no block of its own: one line names them together.
  const [quietOrgs, setQuietOrgs] = useState<ReadonlySet<string>>(new Set());
  const reportQuiet = useCallback((org: string, quiet: boolean) => {
    setQuietOrgs((prev) => {
      if (prev.has(org) === quiet) return prev;
      const next = new Set(prev);
      if (quiet) next.add(org);
      else next.delete(org);
      return next;
    });
  }, []);
  const orgs = overview?.organisations ?? [];
  const outcome = !isLoading && !error ? scopeOutcome(overview, scope) : undefined;

  const reviews = useMemo(
    () =>
      allApps(overview).flatMap((a) =>
        (a.emergency_needs_review ?? []).filter((r) => !r.acknowledged_by).map((r) => ({ app: a, review: r }))
      ),
    [overview]
  );
  const awaitingCount = useMemo(() => allApps(overview).reduce((n, a) => n + (a.pending_requests ?? 0), 0), [overview]);
  const reviewsByOrg = (org: OverviewOrganisation) => {
    const names = new Set([...org.groups.flatMap((g) => g.members), ...org.ungrouped].map((a) => a.application));
    return reviews.filter((r) => names.has(r.app.application));
  };

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        <CcPageHeader
          title="Approvals"
          subtitle={
            <>
              <span className="text-foreground" data-testid="scope-line">
                {scope.org ? `Showing ${describeScope(scope)}.` : "Showing all organisations you can read."}
              </span>{" "}
              Deployment requests waiting for a checker, and emergency rollbacks waiting for review. A request is
              approved by someone other than the person who raised it, and approval executes it at once.
            </>
          }
          actions={
            <>
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by app, person, reason"
                  className="h-8 w-full pl-7 text-sm sm:w-56"
                  aria-label="Filter"
                />
              </div>
              <LastUpdated at={lastUpdatedAt} pollMs={pollMs} isValidating={isValidating} onRefresh={refresh} />
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Queue sections">
          <SectionTab
            active={section === "awaiting"}
            onClick={() => setSection("awaiting")}
            icon={UserCheck}
            label="Awaiting approval"
            count={awaitingCount}
          />
          <SectionTab
            active={section === "review"}
            onClick={() => setSection("review")}
            icon={Eye}
            label="Needs review"
            count={reviews.length}
            tone="emergency"
          />
          <SectionTab
            active={section === "decided"}
            onClick={() => setSection("decided")}
            icon={History}
            label="Decided"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <BlockSkeleton className="h-40" />
            <BlockSkeleton className="h-40" />
          </div>
        ) : error && !raw.overview ? (
          <ErrorState title="Could not load the queue" message={error.message} onRetry={refresh} />
        ) : outcome === "unconfirmed" ? (
          <UnconfirmedRead
            orgs={orgs}
            title={`Could not confirm ${describeScope(scope)}`}
            message="The read that lists it did not finish, so this is not the same as an empty queue. Try again."
            onRetry={refresh}
          />
        ) : orgs.length === 0 ? (
          scope.org ? (
            <EmptyState
              icon={Inbox}
              title={`${describeScope(scope)} was not found, or you have no access`}
              message="Either it does not exist, or your role cannot read it. This says nothing about whether anything is waiting."
              action={<NotFoundActions org={scope.org} base={APPROVALS_BASE} />}
            />
          ) : (
            <EmptyState icon={Inbox} title="No organisations to show" />
          )
        ) : (
          <>
            {error && (
              <ErrorState title="Showing the last successful refresh" message={error.message} onRetry={refresh} />
            )}
            {orgs.map((o) => (
              <OrgReadNotice key={o.name} org={o} />
            ))}
            {orgs.map((org) =>
              unconfirmedOrg(org) ? (
                <UnconfirmedQueue key={org.name} org={org} onRetry={refresh} />
              ) : (
                <OrgQueue
                  key={org.name}
                  org={org}
                  me={me}
                  query={query.trim().toLowerCase()}
                  section={section}
                  reviews={reviewsByOrg(org)}
                  onChanged={() => void refresh()}
                  cutShort={readCutShort(org)}
                  collapseWhenEmpty={!scope.org && orgs.length > 1}
                  onQuiet={reportQuiet}
                />
              )
            )}
            {(() => {
              const names = orgs.filter((o) => quietOrgs.has(o.name)).map((o) => o.name);
              if (names.length === 0) return null;
              const nothing =
                section === "awaiting"
                  ? "Nothing awaiting approval"
                  : section === "review"
                    ? "Nothing needs review"
                    : "No decided requests";
              return (
                <p
                  className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground"
                  data-testid="quiet-orgs"
                >
                  {nothing} in {names.length === 1 ? "1 organisation" : `${names.length} organisations`}:{" "}
                  {names.join(", ")}.
                </p>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}

function SectionTab({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  tone = "approval",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  tone?: "approval" | "emergency";
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("rounded-md transition-shadow", active && "ring-2 ring-ring ring-offset-1 ring-offset-background")}
    >
      <StateChip tone={active ? tone : "muted"} icon={Icon}>
        {label}
        {count !== undefined && count > 0 ? ` · ${count}` : ""}
      </StateChip>
    </button>
  );
}

/** An organisation whose read was cut short and listed nothing: whether anything awaits approval there is unknown. */
function UnconfirmedQueue({ org, onRetry }: { org: OverviewOrganisation; onRetry: () => void }) {
  return (
    <section aria-labelledby={`queue-${org.name}`} className="space-y-3">
      <div className="border-b pb-2">
        <h2 id={`queue-${org.name}`} className="text-base font-semibold tracking-tight">
          {org.name}
        </h2>
      </div>
      <ErrorState
        title={`Could not confirm the queue in ${org.name}`}
        message="The read that lists its applications did not finish, so this is not the same as nothing waiting. Try again."
        onRetry={onRetry}
      />
    </section>
  );
}

function matches(r: DeploymentRequest, q: string): boolean {
  if (!q) return true;
  return [r.application, r.requester, r.reason, r.action, r.decided_by ?? "", r.decision_reason ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function OrgQueue({
  org,
  me,
  query,
  section,
  reviews,
  onChanged,
  cutShort,
  collapseWhenEmpty,
  onQuiet,
}: {
  org: OverviewOrganisation;
  me: string | null;
  query: string;
  section: Section;
  reviews: { app: AppStatus; review: NonNullable<AppStatus["emergency_needs_review"]>[number] }[];
  onChanged: () => void;
  /** The applications listed here may not be all of them: "none yet" is not something this page can say. */
  cutShort: boolean;
  /** At All: an organisation with nothing to show in this tab renders nothing and says so through `onQuiet`. */
  collapseWhenEmpty: boolean;
  onQuiet: (org: string, quiet: boolean) => void;
}) {
  const scope = useScope();
  const { requests: orgRequests, error, isLoading, refresh } = useDeploymentRequests(org.name, null);
  const apps = useMemo(() => [...org.groups.flatMap((g) => g.members), ...org.ungrouped], [org]);
  // The queue is read per organisation; only the applications in scope are shown.
  const requests = useMemo(() => {
    const names = new Set(apps.map((a) => a.application));
    return orgRequests?.filter((r) => names.has(r.application));
  }, [orgRequests, apps]);
  const platformOf = (app: string) => apps.find((a) => a.application === app)?.platform ?? null;
  const approvalApps = apps.filter((a) => a.approval_required).length;

  const list = useMemo(() => {
    const all = (requests ?? []).filter((r) => matches(r, query));
    if (section === "awaiting") {
      return all.filter((r) => isOpenRequest(r.status)).sort((a, b) => a.expires_at.localeCompare(b.expires_at));
    }
    if (section === "decided") {
      return all.filter((r) => !isOpenRequest(r.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return [];
  }, [requests, query, section]);

  const shownReviews = reviews.filter(
    (r) =>
      !query ||
      [r.app.application, r.review.actor, String(r.review.reason ?? "")].join(" ").toLowerCase().includes(query)
  );

  // Quiet means a read that finished and found nothing. Anything unknown (loading, failed, cut short, state that could
  // not be read) keeps its block, because "nothing" is not what the page knows there.
  const settled = section === "review" || (requests !== undefined && !error);
  const quiet =
    collapseWhenEmpty &&
    settled &&
    !cutShort &&
    !apps.some((a) => a.auxiliary_error != null) &&
    (section === "review" ? shownReviews.length === 0 : list.length === 0);
  useEffect(() => {
    onQuiet(org.name, quiet);
    return () => onQuiet(org.name, false);
  }, [onQuiet, org.name, quiet]);
  if (quiet) return null;

  return (
    <section aria-labelledby={`queue-${org.name}`} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-2">
        <h2 id={`queue-${org.name}`} className="text-base font-semibold tracking-tight">
          {org.name}
        </h2>
        <span className="text-xs text-muted-foreground">
          {apps.some((a) => a.auxiliary_error != null) && (
            <span role="alert">Approval state could not be read for some apps. Refresh before acting.</span>
          )}
          {approvalApps} app{approvalApps === 1 ? "" : "s"} with approval on
        </span>
        <div className="ml-auto">
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            <Link href={scopedHref(CC_BASE, scope)}>Overview</Link>
          </Button>
        </div>
      </div>

      {section === "review" ? (
        shownReviews.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={apps.some((a) => a.auxiliary_error != null) ? "Review state unknown" : "Nothing needs review"}
            message={
              apps.some((a) => a.auxiliary_error != null)
                ? "Some application state could not be read. Refresh before acting."
                : "No emergency rollback is waiting for a second checker."
            }
          />
        ) : (
          <div className="space-y-2">
            {shownReviews.map(({ app, review }) => (
              <QueuedReview key={review.id} org={org.name} app={app} review={review} onChanged={onChanged} />
            ))}
          </div>
        )
      ) : isLoading && !requests ? (
        <BlockSkeleton className="h-24" />
      ) : error && !requests ? (
        <ErrorState title="Could not load requests" message={error.message} onRetry={() => refresh()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={section === "awaiting" ? "Nothing awaiting approval" : "No decided requests"}
          message={
            apps.some((a) => a.auxiliary_error != null)
              ? "Approval state unknown. Refresh before acting."
              : section === "awaiting"
                ? approvalApps > 0
                  ? "Requests appear here as soon as a maker raises one."
                  : cutShort
                    ? "No application that could be read requires approval. Some may be missing from this list."
                    : "No application in this organisation requires approval yet."
                : undefined
          }
        />
      ) : (
        <Panel>
          <div className="flex items-center justify-between border-b px-4 py-2">
            <PanelTitle>{section === "awaiting" ? "Soonest to expire first" : "Most recent first"}</PanelTitle>
            <span className="text-xs text-muted-foreground">
              {list.length} request{list.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y">
            {list.map((r) => (
              <RequestRow
                key={r.id}
                org={org.name}
                request={r}
                platform={platformOf(r.application)}
                me={me}
                app={apps.find((a) => a.application === r.application)}
              />
            ))}
          </ul>
        </Panel>
      )}
    </section>
  );
}

/** One emergency review in the queue. Acknowledging is for that application's checkers, so it reads their policy. */
function QueuedReview({
  org,
  app,
  review,
  onChanged,
}: {
  org: string;
  app: AppStatus;
  review: EmergencyReview;
  onChanged: () => void;
}) {
  const me = useMe();
  const { policy, error } = useApprovalPolicy(org, app.application);
  return (
    <EmergencyReviewCard
      org={org}
      app={app.application}
      platform={app.platform}
      review={review}
      canAcknowledge={canAcknowledgeEmergency(policy, me, Boolean(error))}
      onChanged={onChanged}
    />
  );
}
