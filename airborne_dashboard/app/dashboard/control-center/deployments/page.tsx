"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeploymentFeed, useNow, useOverview, useScopeGroups } from "@/lib/control-center/hooks";
import {
  feedQuery,
  filtersActive,
  filtersFromSearch,
  filtersToParams,
  mergePages,
  nowApps,
  NO_FILTERS,
  pinnedApps,
  type FeedFilters,
} from "@/lib/control-center/deployments";
import {
  buildScopeTree,
  CC_BASE,
  DEPLOYMENTS_BASE,
  describeScope,
  filterOverview,
  resolveGroup,
  readCutShort,
  scopedHref,
  scopeOutcome,
} from "@/lib/control-center/scope";
import { useAppContext } from "@/providers/app-context";
import { useScope } from "@/components/scope/use-scope";
import { CcPageHeader } from "@/components/control-center/page-header";
import { LastUpdated } from "@/components/control-center/time";
import { BlockSkeleton, EmptyState, ErrorState, PanelTitle } from "@/components/control-center/states";
import { NowSection } from "@/components/control-center/now-section";
import { FeedFilterBar } from "@/components/control-center/feed-filters";
import { CompletenessFoot, FeedEmpty, FeedList, PartialNotice } from "@/components/control-center/feed-list";
import { OrgReadNotice, UnconfirmedRead } from "@/components/control-center/read-notice";
import { NotFoundActions } from "@/components/control-center/not-found-actions";

export default function DeploymentsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? DEPLOYMENTS_BASE;
  const search = useSearchParams();
  const scope = useScope();
  const urlFilters = useMemo(() => filtersFromSearch(search), [search]);
  // Two quick clicks must both count: the second is built on the first before the address has caught up with it.
  const [pending, setPending] = useState<FeedFilters | null>(null);
  const filters = pending ?? urlFilters;
  useEffect(() => {
    if (pending && JSON.stringify(filtersToParams(pending)) === JSON.stringify(filtersToParams(urlFilters))) {
      setPending(null);
    }
  }, [pending, urlFilters]);
  const now = useNow(60_000);
  const { organisations } = useAppContext();
  // Only the organisation in scope is asked for its groups: the group's name is all this page needs them for.
  const { groupsByOrg } = useScopeGroups(scope.org ? [scope.org] : [], Boolean(scope.group));
  const groupName = resolveGroup(scope, buildScopeTree(organisations, groupsByOrg))?.name;
  const scoped = Boolean(scope.org);

  const raw = useOverview(scope);
  const overview = useMemo(() => filterOverview(raw.overview, scope), [raw.overview, scope]);
  const rows = useMemo(() => nowApps(overview), [overview]);
  const pinned = useMemo(() => pinnedApps(rows), [rows]);
  // The feed names a group by its id. The overview in the same scope carries the names.
  const groupNames = useMemo(
    () => new Map((raw.overview?.organisations ?? []).flatMap((o) => o.groups.map((g) => [g.id, g.name] as const))),
    [raw.overview]
  );
  const nameOfGroup = useCallback((id: string) => groupNames.get(id), [groupNames]);
  const showOrg = !scope.org;
  // The scope names something that is not there or not readable ("not found"), or the read that would have listed it
  // was cut short ("unconfirmed"): the two are never the same message.
  const outcome = !raw.isLoading && !raw.error ? scopeOutcome(overview, scope) : undefined;
  const notFound = scoped && outcome === "not_found";
  const cutShort = Boolean(overview?.organisations.some(readCutShort));
  // Nothing listed by a read that did not finish is not "no applications": it is unconfirmed, in any scope.
  const unconfirmed = (scoped && outcome === "unconfirmed") || (cutShort && rows.length === 0);

  const query = useMemo(() => feedQuery(scope, filters, now), [scope, filters, now]);
  const feed = useDeploymentFeed(query, !notFound);
  const view = useMemo(() => (feed.pages ? mergePages(feed.pages) : undefined), [feed.pages]);

  const setFilters = useCallback(
    (next: FeedFilters) => {
      setPending(next);
      router.replace(scopedHref(pathname, scope, filtersToParams(next)), { scroll: false });
    },
    [router, pathname, scope]
  );

  const refreshAll = () => {
    void raw.refresh();
    void feed.refresh();
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <CcPageHeader
        title="Deployments"
        subtitle={
          <span>
            <span className="text-foreground" data-testid="scope-line">
              {scoped ? `Showing ${describeScope(scope, groupName)}.` : "Showing all organisations you can read."}
            </span>{" "}
            What needs attention or is rolling out now, then the release events as recorded, newest first.
          </span>
        }
        actions={
          <LastUpdated
            at={raw.lastUpdatedAt}
            pollMs={raw.pollMs}
            isValidating={raw.isValidating || feed.isValidating}
            onRefresh={refreshAll}
          />
        }
      />

      {notFound ? (
        <EmptyState
          icon={Layers}
          title={`${describeScope(scope, groupName)} was not found, or you have no access`}
          message="Either it does not exist, or your role cannot read it. This says nothing about whether anything is deployed."
          action={<NotFoundActions org={scope.org} base={DEPLOYMENTS_BASE} />}
        />
      ) : (
        <>
          <section aria-label="Needs attention and rolling out" className="space-y-3">
            {raw.isLoading ? (
              <div className="space-y-3" aria-busy aria-label="Loading">
                <BlockSkeleton className="h-28" />
                <BlockSkeleton className="h-28" />
              </div>
            ) : raw.error && !raw.overview ? (
              <ErrorState
                title="Could not read what is live now"
                message={raw.error.message}
                onRetry={() => void raw.refresh()}
              />
            ) : unconfirmed ? (
              <UnconfirmedRead
                orgs={overview?.organisations ?? []}
                title={`Could not confirm ${describeScope(scope, groupName)}`}
                message="The read that lists it did not finish, so this is not the same as it being gone or empty. Try again."
                onRetry={() => void raw.refresh()}
              />
            ) : rows.length === 0 ? (
              <EmptyState title="No applications in scope" message="There are no applications you can read here yet." />
            ) : (
              <>
                {raw.error && (
                  <ErrorState
                    title="Showing the last successful read"
                    message={`The latest refresh failed: ${raw.error.message}`}
                    onRetry={() => void raw.refresh()}
                  />
                )}
                {overview?.organisations.map((o) => (
                  <OrgReadNotice key={o.name} org={o} />
                ))}
                {pinned.length === 0 ? (
                  <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                    {cutShort
                      ? "Nothing in what could be read needs attention or is rolling out."
                      : "Nothing here needs attention or is rolling out."}{" "}
                    <Link href={scopedHref(CC_BASE, scope)} className="underline hover:text-foreground">
                      What is live is on the Overview.
                    </Link>
                  </p>
                ) : (
                  <NowSection rows={rows} showOrg={showOrg} />
                )}
              </>
            )}
          </section>

          <section aria-labelledby="events-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <PanelTitle>
                <span id="events-heading">Release events</span>
              </PanelTitle>
              {view && view.items.length > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                  {view.items.length} loaded{view.nextCursor ? " · more below" : ""}
                </span>
              )}
            </div>
            <FeedFilterBar filters={filters} onChange={setFilters} />

            {feed.isLoading ? (
              <div className="space-y-2" aria-busy aria-label="Loading events">
                {[0, 1, 2, 3].map((i) => (
                  <BlockSkeleton key={i} className="h-14" />
                ))}
              </div>
            ) : feed.error && !view ? (
              <ErrorState
                title="Could not load the deployments feed"
                message={feed.error.message}
                onRetry={() => void feed.refresh()}
              />
            ) : view ? (
              <>
                {view.partial && <PartialNotice view={view} onRetry={() => void feed.refresh()} />}
                {view.items.length === 0 ? (
                  <FeedEmpty
                    filtered={filtersActive(filters)}
                    partial={view.partial}
                    onClear={() => setFilters(NO_FILTERS)}
                  />
                ) : (
                  <FeedList items={view.items} showOrg={showOrg} groupName={nameOfGroup} />
                )}
                {feed.newer && (
                  <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm"
                  >
                    <span>More new events arrived than fit on a page.</span>
                    <Button variant="outline" size="sm" onClick={() => void feed.refresh()}>
                      Reload from the newest
                    </Button>
                  </div>
                )}
                {feed.pollError && !feed.error && (
                  <ErrorState
                    title="Showing the last successful read"
                    message={`The latest refresh failed: ${feed.pollError.message}`}
                    onRetry={() => void feed.refresh()}
                  />
                )}
                {feed.error && (
                  <ErrorState
                    title="Could not load the next events"
                    message={`${feed.error.message} The events above are still shown.`}
                    onRetry={() => void feed.refresh()}
                  />
                )}
                {view.nextCursor && !feed.error && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void feed.loadMore()}
                      disabled={feed.loadingMore}
                    >
                      {feed.loadingMore ? "Loading…" : "Show older events"}
                    </Button>
                  </div>
                )}
                <CompletenessFoot completeness={view.completeness} />
              </>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
