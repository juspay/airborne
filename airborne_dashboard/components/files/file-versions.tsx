"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiFetch, useApiContext } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

export interface FileVersion {
  version: number;
  tag?: string;
  created_at: string;
  id: string;
}

export interface FileVersionsResponse {
  data: FileVersion[];
  total_items: number;
  total_pages: number;
}

export interface FileVersionsProps {
  filePath: string;
  onSelect?: (file_path: string, file_id: string) => void;
  isSelected?: (file_path: string, file_id: string) => boolean;
}

export function FileVersions({ filePath, onSelect, isSelected }: FileVersionsProps) {
  const { token, org, app } = useApiContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState<number>(1);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const hasSelectionMode = onSelect !== undefined && isSelected !== undefined;
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const observerRef = useRef<HTMLDivElement>(null);
  const encodedFilePath = encodeURIComponent(filePath);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; version?: FileVersion }>({
    open: false,
  });
  const [newTag, setNewTag] = useState("");

  const fetchVersions = async (page: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res: FileVersionsResponse = await apiFetch(
        `/file/${encodedFilePath}/versions`,
        {
          query: {
            search: searchQuery || undefined,
            page,
            count: 5,
          },
        },
        {
          token,
          org,
          app,
        }
      );

      if (append) {
        setVersions((prev) => [...prev, ...res.data]);
      } else {
        setVersions(res.data);
      }

      setHasMore(page < res.total_pages);
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
      fetchVersions(nextPage, true);
    }
  }, [page, isLoadingMore, hasMore]);

  useEffect(() => {
    // Only create observer if element exists and we have content to observe
    if (!observerRef.current || versions.length === 0) {
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
  }, [loadMore, hasMore, isLoadingMore, versions.length]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    setHasMore(true);
    setVersions([]);
    fetchVersions();
  }, [debouncedSearchQuery]);

  const handleTagUpdate = async () => {
    if (!editDialog.version) return;
    try {
      await apiFetch(
        `/file/${encodeURIComponent(editDialog.version.id)}`,
        { method: "PATCH", body: { tag: newTag } },
        { token, org, app }
      );
      // Refresh locally
      setVersions((prev) => prev.map((v) => (v.id === editDialog.version!.id ? { ...v, tag: newTag } : v)));
      setEditDialog({ open: false });
      setNewTag("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search versions..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="flex-1"
        />
      </div>

      {/* Versions List */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">No versions found</div>
        ) : (
          <>
            {versions.map((version) => {
              return (
                <div
                  key={version.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors cursor-pointer",
                    isSelected && "bg-muted/70"
                  )}
                  onClick={() => onSelect?.(filePath, version.id)}
                >
                  {hasSelectionMode && (
                    <Checkbox
                      checked={isSelected(filePath, version.id)}
                      onCheckedChange={() => onSelect(filePath, version.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">v{version.version}</span>
                      {version.tag && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {version.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(version.created_at)}</p>
                  </div>
                  {!hasSelectionMode && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-70 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewTag(version.tag || "");
                              setEditDialog({ open: true, version });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit tag</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              );
            })}
            <div ref={observerRef} className="flex justify-center py-4 min-h-[40px]">
              {hasMore && isLoadingMore && (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <span className="ml-2 text-white/60">Loading more...</span>
                </>
              )}
              {hasMore && !isLoadingMore && <div className="text-white/40 text-sm">Scroll for more...</div>}
              {!hasMore && versions.length > 0 && <div className="text-white/60">No more versions views to load</div>}
            </div>
          </>
        )}
      </div>
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tag for v{editDialog.version?.version}</DialogTitle>
          </DialogHeader>
          <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Enter new tag..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleTagUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
