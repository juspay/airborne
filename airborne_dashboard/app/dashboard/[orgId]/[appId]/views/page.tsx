"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CreateReleaseView from "@/components/releaseViews/CreateReleaseView";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import EditReleaseView from "@/components/releaseViews/EditReleaseView";
import DeleteReleaseView from "@/components/releaseViews/DeleteReleaseView";
import ViewReleaseInfo from "@/components/releaseViews/ViewReleaseInfo";
import { hasAppAccess } from "@/lib/utils";

export type View = {
  id: string;
  name: string;
  dimensions: {
    key: string;
    value: string;
  }[];
  created_at: Date;
};
type ReleaseViewListResponse = {
  data: View[];
  total_items: number;
  total_pages: number;
};

export default function ViewsPage() {
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();

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
        `/organisations/applications/dimension/release-view/list?page=${pageNum}&count=20`,
        {},
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
  }, [page, isLoadingMore, hasMore]);

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
    setViewsList((prev) => [...prev, view]);
    setTotalItems((prev) => prev + 1);
  };

  useEffect(() => {
    setPage(1);
    setViewsList([]);
    setHasMore(true);
    fetchViewsList(1, false);
  }, [app, org]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}

      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
                Custom Views
              </h1>
              <p className="text-muted-foreground mt-2">Create and manage custom filtered views for your dashboard</p>
            </div>
            {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
              <CreateReleaseView onViewCreated={onViewCreated} />
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Views ({totalItems})</CardTitle>
              <CardDescription>All custom views and their filter configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && viewsList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {viewsList.map((view) => {
                      const isOpen = selectedView?.id === view.id;

                      return (
                        <Card
                          key={view.id}
                          className="cursor-pointer transition-colors hover:bg-muted/70 p-2 space-y-0"
                          onClick={() => setSelectedView(view)}
                        >
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-2 px-3">
                            <CardTitle className="text-sm font-medium">{view.name}</CardTitle>
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()} // prevent toggle when clicking actions
                            >
                              <EditReleaseView
                                view={view}
                                onViewUpdated={(updatedView: View) => {
                                  setViewsList((prev) => prev.map((v) => (v.id === updatedView.id ? updatedView : v)));
                                }}
                              />
                              <DeleteReleaseView
                                view={view}
                                onViewDeleted={(viewId: string) => {
                                  setViewsList((prev) => prev.filter((v) => v.id !== viewId));
                                  setTotalItems((prev) => prev - 1);
                                  if (selectedView?.id === viewId) setSelectedView(null);
                                }}
                              />
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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <span className="ml-2 text-white/60">Loading more...</span>
                      </>
                    )}
                    {hasMore && !isLoadingMore && <div className="text-white/40 text-sm">Scroll for more...</div>}
                    {!hasMore && viewsList.length > 0 && (
                      <div className="text-white/60">No more release views to load</div>
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
