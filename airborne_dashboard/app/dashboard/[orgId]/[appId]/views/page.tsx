"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import CreateReleaseView from "@/components/releaseViews/CreateReleaseView";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import EditReleaseView from "@/components/releaseViews/EditReleaseView";
import DeleteReleaseView from "@/components/releaseViews/DeleteReleaseView";
import ViewReleaseInfo from "@/components/releaseViews/ViewReleaseInfo";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

const PAGE_AUTHZ = definePagePermissions({
  read_views: permission("release_view", "read", "app"),
  create_view: permission("release_view", "create", "app"),
  update_view: permission("release_view", "update", "app"),
  delete_view: permission("release_view", "delete", "app"),
});

/** `custom` views are created by a user; `auto_generated` ones are created by Airborne for each
 * release's dimensions. */
export type ReleaseViewType = "custom" | "auto_generated";

export type View = {
  id: string;
  name: string;
  dimensions: {
    key: string;
    value: string;
  }[];
  created_at: Date;
  view_type: ReleaseViewType;
};
type ReleaseViewListResponse = {
  data: View[];
  total_items: number;
  total_pages: number;
};

enum ViewTypeFilter {
  ALL = "all",
  CUSTOM = "custom",
  AUTO_GENERATED = "auto_generated",
}

export default function ViewsPage() {
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canManageViews = permissions.can("create_view") || permissions.can("update_view");

  const [filterType, setFilterType] = useState<ViewTypeFilter>(ViewTypeFilter.ALL);
  const [viewsList, setViewsList] = useState<View[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observerRef = useRef<HTMLDivElement>(null);
  const [selectedView, setSelectedView] = useState<View | null>(null);

  const fetchViewsList = async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res: ReleaseViewListResponse = await apiFetch(
        `/organisations/applications/dimension/release-view/list`,
        {
          query: {
            page: pageNum,
            count: 20,
            ...(filterType !== ViewTypeFilter.ALL ? { view_type: filterType } : {}),
          },
        },
        {
          token,
          org,
          app,
        }
      );

      if (append) {
        setViewsList((prev) => [...prev, ...res.data]);
      } else {
        setViewsList(res.data);
      }

      setTotalItems(res.total_items);
      setHasMore(pageNum < res.total_pages);
    } catch (err) {
      console.log(err);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchViewsList(nextPage, true);
    }
  }, [page, isLoadingMore, hasMore, filterType]);

  useEffect(() => {
    // Only create observer if element exists and we have content to observe
    if (!observerRef.current || viewsList.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(observerRef.current);

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [loadMore, hasMore, isLoadingMore, viewsList.length]);

  const onViewCreated = (view: View) => {
    // The list is newest-first, and a custom view is hidden while the auto-generated filter is on.
    if (filterType === ViewTypeFilter.AUTO_GENERATED) return;
    setViewsList((prev) => [view, ...prev]);
    setTotalItems((prev) => prev + 1);
  };

  useEffect(() => {
    setPage(1);
    setViewsList([]);
    setHasMore(true);
    fetchViewsList(1, false);
  }, [app, org, filterType]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}

      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Views</h1>
              <p className="text-muted-foreground mt-2">
                Custom views you create, plus a view generated for every release&apos;s dimensions
              </p>
            </div>
            {canManageViews && <CreateReleaseView onViewCreated={onViewCreated} />}
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Select value={filterType} onValueChange={(value) => setFilterType(value as ViewTypeFilter)}>
                  <SelectTrigger className="w-48">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ViewTypeFilter.ALL}>All</SelectItem>
                    <SelectItem value={ViewTypeFilter.CUSTOM}>Custom</SelectItem>
                    <SelectItem value={ViewTypeFilter.AUTO_GENERATED}>Auto-generated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Views ({totalItems})</CardTitle>
              <CardDescription>All saved views and their filter configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && viewsList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : viewsList.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {filterType === ViewTypeFilter.CUSTOM
                    ? "No custom views yet. Create one to save a dimension filter."
                    : filterType === ViewTypeFilter.AUTO_GENERATED
                      ? "No auto-generated views yet. One is created for each release's dimensions."
                      : "No views yet."}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {viewsList.map((view) => {
                      const isOpen = selectedView?.id === view.id;
                      const isAutoGenerated = view.view_type === "auto_generated";

                      return (
                        <Card
                          key={view.id}
                          className="cursor-pointer transition-colors hover:bg-muted/70 p-2 space-y-0"
                          onClick={() => setSelectedView(view)}
                        >
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-2 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <CardTitle className="text-sm font-medium truncate">{view.name}</CardTitle>
                              <Badge variant={isAutoGenerated ? "outline" : "secondary"} className="shrink-0 text-xs">
                                {isAutoGenerated ? "Auto-generated" : "Custom"}
                              </Badge>
                            </div>
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()} // prevent toggle when clicking actions
                            >
                              {/* Auto-generated views mirror a release's dimensions, so they can be
                                  removed but not edited. */}
                              {permissions.can("update_view") && !isAutoGenerated && (
                                <EditReleaseView
                                  view={view}
                                  onViewUpdated={(updatedView: View) => {
                                    setViewsList((prev) =>
                                      prev.map((v) => (v.id === updatedView.id ? updatedView : v))
                                    );
                                  }}
                                />
                              )}
                              {permissions.can("delete_view") && (
                                <DeleteReleaseView
                                  view={view}
                                  onViewDeleted={(viewId: string) => {
                                    setViewsList((prev) => prev.filter((v) => v.id !== viewId));
                                    setTotalItems((prev) => prev - 1);
                                    if (selectedView?.id === viewId) setSelectedView(null);
                                  }}
                                />
                              )}
                            </div>
                          </CardHeader>

                          {/* Show dimensions as badges when collapsed */}
                          {view.dimensions?.length > 0 && (
                            <CardContent className="pb-2 pt-0 px-3">
                              <div className="flex flex-wrap gap-1.5">
                                {view.dimensions.map((item: any, index: number) => (
                                  <Badge
                                    key={`${item.key}-${index}`}
                                    variant="secondary"
                                    className="px-2 py-0.5 text-xs"
                                  >
                                    <span className="font-medium">{item.key}:</span>
                                    <span className="ml-1">{item.value}</span>
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          )}

                          {isOpen && (
                            <CardContent className="pb-2 pt-0 px-3">
                              <ViewReleaseInfo view={view} />
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  <div ref={observerRef} className="flex justify-center py-4 min-h-[40px]">
                    {hasMore && isLoadingMore && (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2 text-muted-foreground">Loading more...</span>
                      </>
                    )}
                    {hasMore && !isLoadingMore && (
                      <div className="text-muted-foreground text-sm">Scroll for more...</div>
                    )}
                    {!hasMore && viewsList.length > 0 && (
                      <div className="text-muted-foreground">No more release views to load</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
