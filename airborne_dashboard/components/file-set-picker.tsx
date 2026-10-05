"use client";

import { useCallback, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderPlus, Loader2, Search } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn, fileKeysToMembers } from "@/lib/utils";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import type { FileSet, FileSetMember, FileSetsResponse, FileSetVersion } from "@/types/files";

/** Extra per-row state a caller can show for a set. */
export interface FileSetRowInfo {
  badge?: string;
  note?: string;
  disabled?: boolean;
  title?: string;
}

export interface FileSetPickerProps {
  /** `files` is undefined until the set has been ticked once. */
  isSelected: (fileSet: FileSet, files: FileSetMember[] | undefined) => boolean;
  /** Called with the set's latest-version files once they are fetched. */
  onToggle: (fileSet: FileSet, files: FileSetMember[]) => void;
  /** Row extras; `files` is undefined until the set has been ticked once. */
  describe?: (fileSet: FileSet, files: FileSetMember[] | undefined) => FileSetRowInfo | undefined;
  disabled?: boolean;
  className?: string;
}

const FILE_SETS_PER_PAGE = 20;

const FILE_SET_AUTHZ = definePagePermissions({
  read_file_set: permission("file_set", "read", "app"),
});

/**
 * Lists the application's file sets (searched and paged on the server) with a
 * checkbox each. It fetches a set's latest-version files when it is ticked and
 * hands them to `onToggle`; what ticking means, and any rules, are the caller's.
 */
export function FileSetPicker({ isSelected, onToggle, describe, disabled = false, className }: FileSetPickerProps) {
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(FILE_SET_AUTHZ);
  const canRead = permissions.can("read_file_set");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const enabled = Boolean(token && org && app && canRead);
  const {
    data: pages,
    size: pagesLoaded,
    setSize: setPagesLoaded,
  } = useSWRInfinite(
    (index: number, previous: FileSetsResponse | null) => {
      if (!enabled) return null;
      if (previous && index + 1 > previous.total_pages) return null;
      return ["/file-sets/picker", org, app, debouncedSearch, index + 1];
    },
    ([, , , query, page]: [string, string, string, string, number]) =>
      apiFetch<FileSetsResponse>(
        "/file-sets",
        { method: "GET", query: { page, count: FILE_SETS_PER_PAGE, search: query || undefined } },
        { token, org, app }
      ),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const fileSets = useMemo(() => (pages || []).flatMap((p) => p.data), [pages]);
  const totalPages = pages?.[pages.length - 1]?.total_pages ?? 1;
  const hasMore = Boolean(pages) && pagesLoaded < totalPages;
  const isLoadingMore = pagesLoaded > 0 && pages?.[pagesLoaded - 1] === undefined;

  // The list only carries each set's latest version number; its files are
  // fetched (as keys) the first time the set is ticked, then cached.
  const [members, setMembers] = useState<Record<string, FileSetMember[]>>({});
  const [loadingSet, setLoadingSet] = useState<string | null>(null);
  const memberKey = (fileSet: FileSet) => `${fileSet.name}@${fileSet.latest_version}`;

  const fetchMembers = useCallback(
    async (fileSet: FileSet): Promise<FileSetMember[]> => {
      const cached = members[memberKey(fileSet)];
      if (cached) return cached;
      setLoadingSet(fileSet.name);
      try {
        const version = await apiFetch<FileSetVersion>(
          `/file-sets/${encodeURIComponent(fileSet.name)}/versions/${fileSet.latest_version}`,
          { method: "GET" },
          { token, org, app }
        );
        const files = fileKeysToMembers(version.files);
        setMembers((prev) => ({ ...prev, [memberKey(fileSet)]: files }));
        return files;
      } finally {
        setLoadingSet(null);
      }
    },
    [members, token, org, app]
  );

  const toggle = useCallback(
    async (fileSet: FileSet) => {
      const files = await fetchMembers(fileSet);
      onToggle(fileSet, files);
    },
    [fetchMembers, onToggle]
  );

  if (!enabled) return null;
  // Nothing to pick and nothing being searched: don't take up space.
  if (pages && fileSets.length === 0 && !debouncedSearch) return null;

  // One set at a time: a second tick while one is loading would act on the
  // selection from before the first one landed.
  const busy = loadingSet !== null;

  return (
    <div className={cn("border rounded-md bg-background", className)}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40">
        <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">File Sets</span>
        <span className="text-xs text-muted-foreground">— select a whole set, or pick individual files below</span>
      </div>
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <Input
            placeholder="Search sets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="divide-y divide-border/50 max-h-40 overflow-y-auto">
        {pages && fileSets.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No file sets match your search.</p>
        )}
        {fileSets.map((g) => {
          const files = members[memberKey(g)];
          const info = describe?.(g, files);
          const rowDisabled = disabled || Boolean(info?.disabled);
          const checked = isSelected(g, files);
          return (
            <div
              key={g.name}
              className={cn(
                "flex items-center gap-2 px-3 py-2 transition-colors",
                rowDisabled ? "opacity-50" : "cursor-pointer hover:bg-accent/50",
                checked && "bg-green-500/5"
              )}
              onClick={() => !rowDisabled && !busy && toggle(g)}
              title={info?.title}
            >
              <Checkbox
                checked={checked}
                className="h-4 w-4"
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={() => toggle(g)}
                disabled={rowDisabled || busy}
              />
              <FolderPlus className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                <span className="text-sm font-medium">{g.name}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">v{g.latest_version}</span>
              </span>
              {loadingSet === g.name && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {info?.badge && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {info.badge}
                </Badge>
              )}
              {info?.note && <span className="text-xs text-muted-foreground">{info.note}</span>}
            </div>
          );
        })}
        {hasMore && (
          <div className="px-3 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs"
              disabled={isLoadingMore}
              onClick={() => setPagesLoaded(pagesLoaded + 1)}
            >
              {isLoadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load more sets"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
