import { useEffect, useState, useCallback, useRef } from "react";
import {  View } from "../../../types";
import axios from "../../../api/axios";
import CreateReleaseView from "./CreateReleaseView";
import EditReleaseView from "./EditReleaseView";
import DeleteReleaseView from "./DeleteReleaseView";
import ReleaseInfo from "../../release/ReleaseInfo";
import { Eye, ArrowLeft } from "lucide-react";
import { useParams } from "react-router-dom";

type ReleaseViewListResponse = {
  data: View[];
  total_items: number;
  total_pages: number;
};

const ReleaseViewsCard = () => {
  const { org: orgParam, app: appParam } = useParams();
  const org = decodeURIComponent(orgParam || "");
  const app = decodeURIComponent(appParam || "");
  
  const [viewsList, setViewsList] = useState<View[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observerRef = useRef<HTMLDivElement>(null);
  const [selectedView, setSelectedView] = useState<View | null>(null);


  const fetchViewsList = async (
    pageNum: number = 1,
    append: boolean = false
  ) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data }: { data: ReleaseViewListResponse } = await axios.get(
        `/organisations/applications/dimension/release-view/list?page=${pageNum}&count=20`,
        {
          headers: {
            "x-application": app,
            "x-organisation": org,
          },
        }
      );

      if (append) {
        setViewsList((prev) => [...prev, ...data.data]);
      } else {
        setViewsList(data.data);
      }

      setTotalItems(data.total_items);
      setHasMore(pageNum < data.total_pages);
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
  }, [loadMore, hasMore, isLoadingMore, viewsList.length]); // Added viewsList.length dependency

  useEffect(() => {
    setPage(1);
    setViewsList([]);
    setHasMore(true);
    fetchViewsList(1, false);
  }, [app, org]);

  return (
    <div className="space-y-6 pb-6 h-full p-8 overflow-y-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl flex flex-col ">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-xl font-semibold text-white">Release Views</h4>
            <p className="text-white/60">
              See your release views here ({totalItems} total)
            </p>
          </div>
          <CreateReleaseView
            onViewCreated={(newView: View) => {
              // Add new view to the beginning of the list
              setViewsList((prev) => [newView, ...prev]);
              setTotalItems((prev) => prev + 1);
            }}
          />
        </div>

        {selectedView ? (
          // ---------------------- Single View ----------------------
          <div className="space-y-6 pb-6 h-full p-8 overflow-y-auto">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setSelectedView(null)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-200 mr-4"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h4 className="text-xl font-semibold text-white">
                      Release View: {selectedView.name}
                    </h4>
                    <p className="text-white/60">
                      Release information for this view
                    </p>
                  </div>
                </div>

                {/* Dimensions for single view */}
                <div className="flex flex-wrap gap-2">
                  {selectedView.dimensions &&
                    selectedView.dimensions.map((item: any, index: number) => (
                      <span
                        key={`${item.key}-${index}`}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30"
                      >
                        <span className="text-blue-300">{item.key}:</span>
                        <span className="ml-1 text-blue-100">{item.value}</span>
                      </span>
                    ))}
                </div>
              </div>

              <ReleaseInfo dimensions={selectedView.dimensions} />
            </div>
          </div>
        ) : isLoading && viewsList.length === 0 ? (
          // ---------------------- Loading State ----------------------
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : (
          // ---------------------- Views List ----------------------
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {viewsList.map((view) => (
                <div
                  key={view.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setSelectedView(view)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h5 className="text-white font-medium">{view.name}</h5>

                    <div
                      className="flex items-center space-x-2 ml-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EditReleaseView
                       
                        view={view}
                        onViewUpdated={(updatedView: View) => {
                          setViewsList((prev) =>
                            prev.map((v) =>
                              v.id === updatedView.id ? updatedView : v
                            )
                          );
                        }}
                      />
                      <DeleteReleaseView
                        
                        view={view}
                        onViewDeleted={(viewId: string) => {
                          setViewsList((prev) =>
                            prev.filter((v) => v.id !== viewId)
                          );
                          setTotalItems((prev) => prev - 1);
                        }}
                      />
                    </div>
                  </div>

                  {/* Dimensions for each view */}
                  <div className="flex flex-wrap gap-2">
                    {view.dimensions &&
                      view.dimensions.map((item: any, index: number) => (
                        <span
                          key={`${item.key}-${index}`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30"
                        >
                          <span className="text-blue-300">{item.key}:</span>
                          <span className="ml-1 text-blue-100">
                            {item.value}
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite scroll footer */}
            <div
              ref={observerRef}
              className="flex justify-center py-4 min-h-[40px]"
            >
              {hasMore && isLoadingMore && (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <span className="ml-2 text-white/60">Loading more...</span>
                </>
              )}
              {hasMore && !isLoadingMore && (
                <div className="text-white/40 text-sm">Scroll for more...</div>
              )}
              {!hasMore && viewsList.length > 0 && (
                <div className="text-white/60">
                  No more release views to load
                </div>
              )}
            </div>

            {/* Empty state */}
            {!isLoading && viewsList.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Eye size={28} className="text-white/40" />
                </div>
                <p className="text-white/60">No release views found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReleaseViewsCard;
