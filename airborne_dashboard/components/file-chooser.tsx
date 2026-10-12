"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ChevronDown, ChevronRight, File, X, Tag, Loader2, FolderPlus } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { toastError } from "@/hooks/use-toast";

import type {
  FileGroup,
  FileGroupVersion,
  FileGroupsResponse,
  TagInfo,
  TagsResponse,
  SelectedFile,
  FileSet,
  FileSetsResponse,
} from "@/types/files";

// Re-export for backward compatibility
export type { SelectedFile };

export interface FileChooserProps {
  mode: "single" | "multi";
  selected: SelectedFile[];
  onChange: (selected: SelectedFile[]) => void;
  filterTags?: string[];
  className?: string;
  disabled?: boolean;
  excludeFiles?: string[]; // File paths to exclude from selection
  /** Show the File Sets quick-select panel (multi mode). Off inside the set editor itself. */
  showFileSets?: boolean;
  /**
   * Set-reference mode: when provided, checking a set selects the set
   * itself (pinned to its latest version) instead of copying its files into
   * `selected`. Used by package creation so packages remember their sets.
   */
  selectedSets?: FileSet[];
  onSetsChange?: (sets: FileSet[]) => void;
}

const GROUPS_PER_PAGE = 15;
const TAGS_PER_PAGE = 20;

export function FileChooser({
  mode,
  selected,
  onChange,
  filterTags,
  className,
  disabled = false,
  excludeFiles = [],
  showFileSets = true,
  selectedSets,
  onSetsChange,
}: FileChooserProps) {
  const { token, org, app } = useAppContext();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Tag filter state
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>(filterTags || []);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const debouncedTagSearch = useDebouncedValue(tagSearchQuery, 300);
  const [tagPage, setTagPage] = useState(1);
  const [accumulatedTags, setAccumulatedTags] = useState<TagInfo[]>([]);

  // Infinite scroll data state
  const [accumulatedGroups, setAccumulatedGroups] = useState<FileGroup[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const apiPageRef = useRef(1);
  const isFetchingRef = useRef(false);

  // UI state
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Stable references
  const excludeFilesSet = useMemo(() => new Set(excludeFiles), [excludeFiles]);
  const tagsFilterKey = useMemo(() => selectedTagFilters.join(","), [selectedTagFilters]);

  // File sets (multi mode): one click adds all of a set's files
  const { data: namedGroupsData } = useSWR(
    token && org && app && mode === "multi" && showFileSets ? ["/file-sets", org, app] : null,
    async () =>
      apiFetch<FileSetsResponse>("/file-sets", { method: "GET", query: { page: 1, count: 100 } }, { token, org, app }),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const namedGroups = useMemo(() => namedGroupsData?.data || [], [namedGroupsData]);

  /** Files of a set's latest version that are actually selectable here (not excluded, e.g. already in the package). */
  const selectableGroupFiles = useCallback(
    (group: FileSet) => (group.latest?.files || []).filter((f) => !excludeFilesSet.has(f.file_path)),
    [excludeFilesSet]
  );

  const refMode = Boolean(onSetsChange);
  const groupRefs = useMemo(() => selectedSets || [], [selectedSets]);

  /** Exact file versions covered by the selected group references. */
  const coveredByGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groupRefs) {
      for (const f of g.latest?.files || []) {
        map.set(`${f.file_path}@${f.version}`, g.name);
      }
    }
    return map;
  }, [groupRefs]);

  /** A group counts as selected when every selectable file of it is in the selection. */
  const isGroupSelected = useCallback(
    (group: FileSet) => {
      if (refMode) return groupRefs.some((g) => g.name === group.name);
      const candidates = selectableGroupFiles(group);
      if (candidates.length === 0) return false;
      return candidates.every((f) => selected.some((s) => s.file_path === f.file_path && s.version === f.version));
    },
    [selected, selectableGroupFiles, refMode, groupRefs]
  );

  /** Partially selected: some but not all selectable files are chosen. */
  const isGroupPartiallySelected = useCallback(
    (group: FileSet) => {
      const candidates = selectableGroupFiles(group);
      if (candidates.length === 0) return false;
      const chosen = candidates.filter((f) =>
        selected.some((s) => s.file_path === f.file_path && s.version === f.version)
      ).length;
      return chosen > 0 && chosen < candidates.length;
    },
    [selected, selectableGroupFiles]
  );

  const toggleGroup = useCallback(
    (group: FileSet) => {
      const candidates = selectableGroupFiles(group);
      if (candidates.length === 0) return;

      if (refMode && onSetsChange) {
        if (groupRefs.some((g) => g.name === group.name)) {
          onSetsChange(groupRefs.filter((g) => g.name !== group.name));
          return;
        }

        // Rule: the exact same file (path AND version) must not enter the
        // package twice — across sets, or a set vs an individual file.
        const conflicts = (group.latest?.files || []).filter(
          (f) =>
            coveredByGroup.has(`${f.file_path}@${f.version}`) ||
            selected.some((s) => s.file_path === f.file_path && s.version === f.version)
        );
        if (conflicts.length > 0) {
          const sample = `${conflicts[0].file_path}@v${conflicts[0].version}`;
          toastError(
            `Cannot add file set "${group.name}"`,
            `${conflicts.length} of its file${conflicts.length === 1 ? " is" : "s are"} already included (e.g. ${sample}). The same file version cannot be included twice.`
          );
          return;
        }

        onSetsChange([...groupRefs, group]);
        return;
      }

      if (isGroupSelected(group)) {
        // Deselect: drop exactly this group's selectable file versions
        const groupKeys = new Set(candidates.map((f) => `${f.file_path}@${f.version}`));
        onChange(selected.filter((s) => !groupKeys.has(`${s.file_path}@${s.version}`)));
        return;
      }

      // Rule: the exact same file (path AND version) cannot enter the
      // selection twice — e.g. from two overlapping file sets. The same
      // path at a different version is allowed.
      const duplicates = candidates.filter((f) =>
        selected.some((s) => s.file_path === f.file_path && s.version === f.version)
      );
      if (duplicates.length > 0) {
        const sample = `${duplicates[0].file_path}@v${duplicates[0].version}`;
        toastError(
          `Cannot add file set "${group.name}"`,
          `${duplicates.length} of its file${duplicates.length === 1 ? " is" : "s are"} already selected (e.g. ${sample}). The same file version cannot be included twice.`
        );
        return;
      }

      const newFiles: SelectedFile[] = candidates.map((f) => ({
        file_path: f.file_path,
        version: f.version,
        url: f.url,
        tag: f.tag || undefined,
      }));

      if (newFiles.length > 0) onChange([...selected, ...newFiles]);
    },
    [selected, onChange, isGroupSelected, selectableGroupFiles, refMode, onSetsChange, groupRefs, coveredByGroup]
  );

  const computeHasMorePages = useCallback((result: FileGroupsResponse, page: number) => {
    if (typeof result.total_items === "number" && result.total_items >= 0) {
      return page * GROUPS_PER_PAGE < result.total_items;
    }

    return result.groups.length === GROUPS_PER_PAGE;
  }, []);

  // Stable SWR key - only changes when filters/search change
  const swrKey = useMemo(() => {
    if (!token || !org || !app) return null;
    return ["/file/groups", org, app, debouncedSearch, tagsFilterKey];
  }, [token, org, app, debouncedSearch, tagsFilterKey]);

  // Fetch file groups - initial fetch only
  const { data: groupsData } = useSWR(
    swrKey,
    async () => {
      setInitialLoading(true);

      try {
        return await apiFetch<FileGroupsResponse>(
          "/file/groups",
          {
            method: "GET",
            query: {
              page: 1,
              count: GROUPS_PER_PAGE,
              search: debouncedSearch || undefined,
              tags: selectedTagFilters.length > 0 ? selectedTagFilters.join(",") : undefined,
            },
          },
          { token, org, app }
        );
      } finally {
        setInitialLoading(false);
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );

  // Reset data when search/tags/context change
  useEffect(() => {
    setAccumulatedGroups([]);
    apiPageRef.current = 1;
    isFetchingRef.current = false;
    setHasMorePages(true);
    setExpandedGroup(null);
  }, [debouncedSearch, tagsFilterKey, token, org, app]);

  // Initialize from first fetch
  useEffect(() => {
    if (!groupsData) return;

    apiPageRef.current = 1;
    setAccumulatedGroups(groupsData.groups);
    setHasMorePages(computeHasMorePages(groupsData, 1));
  }, [groupsData, computeHasMorePages]);

  const fetchApiPage = useCallback(
    async (page: number) => {
      if (!token || !org || !app) return null;

      return apiFetch<FileGroupsResponse>(
        "/file/groups",
        {
          method: "GET",
          query: {
            page,
            count: GROUPS_PER_PAGE,
            search: debouncedSearch || undefined,
            tags: selectedTagFilters.length > 0 ? selectedTagFilters.join(",") : undefined,
          },
        },
        { token, org, app }
      );
    },
    [token, org, app, debouncedSearch, selectedTagFilters]
  );

  const fetchNextPage = useCallback(async () => {
    if (!hasMorePages || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsFetchingMore(true);

    try {
      const nextPage = apiPageRef.current + 1;
      const result = await fetchApiPage(nextPage);

      if (!result || result.groups.length === 0) {
        setHasMorePages(false);
        return;
      }

      apiPageRef.current = nextPage;

      setAccumulatedGroups((prev) => {
        const existing = new Set(prev.map((g) => g.file_path));
        const newGroups = result.groups.filter((g) => !existing.has(g.file_path));

        if (newGroups.length === 0) {
          return prev;
        }

        return [...prev, ...newGroups];
      });

      setHasMorePages(computeHasMorePages(result, nextPage));
    } catch (error) {
      console.error("Failed to fetch more groups:", error);
    } finally {
      isFetchingRef.current = false;
      setIsFetchingMore(false);
    }
  }, [computeHasMorePages, fetchApiPage, hasMorePages]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMorePages) return;

    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: "300px 0px",
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasMorePages]);

  // Filter accumulated groups - memoized
  const filteredGroups = useMemo(() => {
    return accumulatedGroups.filter((g) => !excludeFilesSet.has(g.file_path));
  }, [accumulatedGroups, excludeFilesSet]);

  // Render all filtered groups (no virtual slicing)
  const groups = filteredGroups;

  // Fetch tags
  const { data: tagsData, isLoading: tagsLoading } = useSWR(
    token && org && app && showTagDropdown ? ["/file/tags", app, debouncedTagSearch, tagPage] : null,
    async () =>
      apiFetch<TagsResponse>(
        "/file/tags",
        {
          method: "GET",
          query: {
            page: tagPage,
            count: TAGS_PER_PAGE,
            search: debouncedTagSearch || undefined,
          },
        },
        { token, org, app }
      ),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // Accumulate tags
  useEffect(() => {
    if (tagsData?.data) {
      if (tagPage === 1) {
        setAccumulatedTags(tagsData.data);
      } else {
        setAccumulatedTags((prev) => {
          const existing = new Set(prev.map((t) => t.tag));
          const newTags = tagsData.data.filter((t) => !existing.has(t.tag));
          return [...prev, ...newTags];
        });
      }
    }
  }, [tagsData?.data, tagPage]);

  // Reset tag page when search changes
  useEffect(() => {
    setTagPage(1);
  }, [debouncedTagSearch]);

  // Close tag dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Stable callbacks for selection
  const isVersionSelected = useCallback(
    (filePath: string, version: number) => {
      return selected.some((s) => s.file_path === filePath && s.version === version);
    },
    [selected]
  );

  const isFileSelected = useCallback(
    (filePath: string) => {
      return selected.some((s) => s.file_path === filePath);
    },
    [selected]
  );

  const getVersionTag = useCallback((group: FileGroup, version: number) => {
    return group.tags.find((t) => t.version === version)?.tag;
  }, []);

  const handleSelectVersion = useCallback(
    (group: FileGroup, version: FileGroupVersion) => {
      const tag = getVersionTag(group, version.version);
      const selectedFile: SelectedFile = {
        file_path: group.file_path,
        version: version.version,
        url: version.url,
        tag,
      };

      if (mode === "single") {
        onChange([selectedFile]);
      } else {
        const coveredBy = refMode ? coveredByGroup.get(`${group.file_path}@${version.version}`) : undefined;
        if (coveredBy) {
          toastError(
            "Already included via a file set",
            `${group.file_path}@v${version.version} is part of the selected set "${coveredBy}".`
          );
          return;
        }
        const isSelected = isVersionSelected(group.file_path, version.version);
        if (isSelected) {
          onChange(selected.filter((s) => !(s.file_path === group.file_path && s.version === version.version)));
        } else {
          const filtered = selected.filter((s) => s.file_path !== group.file_path);
          onChange([...filtered, selectedFile]);
        }
      }
    },
    [mode, selected, onChange, isVersionSelected, getVersionTag, refMode, coveredByGroup]
  );

  const handleTagFilterToggle = useCallback((tag: string) => {
    setSelectedTagFilters((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  }, []);

  const loadMoreTags = useCallback(() => {
    if (tagsData && tagPage < tagsData.total_pages && !tagsLoading) {
      setTagPage((p) => p + 1);
    }
  }, [tagsData, tagPage, tagsLoading]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const isLoading = initialLoading || isFetchingMore;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
          disabled={disabled}
        />
      </div>

      {/* Tag Filter & Selection Summary Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative" ref={tagDropdownRef}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            disabled={disabled}
          >
            <Tag className="h-3.5 w-3.5" />
            Tags
            {selectedTagFilters.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {selectedTagFilters.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>

          {showTagDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-md shadow-lg z-50 p-2">
              <Input
                placeholder="Search tags..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                className="h-8 text-sm mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {accumulatedTags.length === 0 && !tagsLoading ? (
                  <div className="text-xs text-muted-foreground text-center py-4">No tags found</div>
                ) : (
                  <>
                    {accumulatedTags.map((tag) => (
                      <button
                        key={tag.tag}
                        onClick={() => handleTagFilterToggle(tag.tag)}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors",
                          selectedTagFilters.includes(tag.tag) && "bg-accent"
                        )}
                      >
                        <span className="truncate">{tag.tag}</span>
                        <span className="text-muted-foreground ml-2">{tag.count}</span>
                      </button>
                    ))}
                    {tagsData && tagPage < tagsData.total_pages && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs mt-1"
                        onClick={loadMoreTags}
                        disabled={tagsLoading}
                      >
                        {tagsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load more..."}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedTagFilters.map((tag) => (
          <Badge key={tag} variant="secondary" className="h-6 gap-1 pl-2 pr-1 text-xs">
            {tag}
            <button
              onClick={() => handleTagFilterToggle(tag)}
              className="hover:bg-muted rounded-sm p-0.5"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {selected.length > 0 && (
          <div className="ml-auto text-xs text-muted-foreground">
            {selected.length} selected
            <button onClick={() => onChange([])} className="ml-2 text-primary hover:underline" disabled={disabled}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* File Sets — selectable alongside individual files */}
      {mode === "multi" && showFileSets && namedGroups.length > 0 && (
        <div className="border rounded-md bg-background">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40">
            <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">File Sets</span>
            <span className="text-xs text-muted-foreground">— select a whole set, or pick individual files below</span>
          </div>
          <div className="divide-y divide-border/50 max-h-40 overflow-y-auto">
            {namedGroups.map((g) => {
              const candidates = selectableGroupFiles(g);
              const noneSelectable = candidates.length === 0;
              const checked = isGroupSelected(g);
              const partial = isGroupPartiallySelected(g);
              return (
                <div
                  key={g.name}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 transition-colors",
                    noneSelectable || disabled ? "opacity-50" : "cursor-pointer hover:bg-accent/50",
                    checked && "bg-green-500/5"
                  )}
                  onClick={() => !disabled && toggleGroup(g)}
                  title={
                    noneSelectable
                      ? (g.latest?.files || []).length === 0
                        ? "This set is empty"
                        : "All files of this set are already in the package"
                      : undefined
                  }
                >
                  <Checkbox
                    checked={checked}
                    className="h-4 w-4"
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => toggleGroup(g)}
                    disabled={disabled || noneSelectable}
                  />
                  <FolderPlus className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">
                    <span className="text-sm font-medium">{g.name}</span>
                    {g.latest && <span className="ml-1.5 text-xs text-muted-foreground">v{g.latest.version}</span>}
                  </span>
                  {partial && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      partial
                    </Badge>
                  )}
                  {noneSelectable && (g.latest?.files || []).length > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      all in package
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {candidates.length < (g.latest?.files || []).length
                      ? `${candidates.length} of ${(g.latest?.files || []).length} selectable`
                      : `${(g.latest?.files || []).length} file${(g.latest?.files || []).length === 1 ? "" : "s"}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Select All / Actions Bar */}
      {groups.length > 0 && mode === "multi" && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={groups.length > 0 && groups.every((g) => isFileSelected(g.file_path))}
              onCheckedChange={(checked) => {
                if (checked) {
                  const newFiles: SelectedFile[] = [];
                  groups.forEach((g) => {
                    const existing = selected.find((s) => s.file_path === g.file_path);
                    if (existing) return;
                    const v = g.versions[0];
                    if (v && refMode && coveredByGroup.has(`${g.file_path}@${v.version}`)) return;
                    if (v) {
                      newFiles.push({
                        file_path: g.file_path,
                        version: v.version,
                        url: v.url,
                        tag: getVersionTag(g, v.version),
                      });
                    }
                  });
                  onChange([...selected, ...newFiles]);
                } else {
                  const currentPaths = new Set(groups.map((g) => g.file_path));
                  onChange(selected.filter((s) => !currentPaths.has(s.file_path)));
                }
              }}
              disabled={disabled}
            />
            <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
              Select all loaded files
            </label>
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredGroups.length} file{filteredGroups.length !== 1 ? "s" : ""}
            {excludeFiles.length > 0 && ` (${excludeFiles.length} in package)`}
            {isLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
          </span>
        </div>
      )}

      {/* File Groups List — scrolls internally so the page/dialog doesn't grow as pages load */}
      <div className="border rounded-md bg-background max-h-80 overflow-y-auto">
        {initialLoading && accumulatedGroups.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading...
          </div>
        ) : groups.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            <File className="h-8 w-8 mb-2 opacity-30" />
            {debouncedSearch || selectedTagFilters.length > 0 ? "No files match your filters" : "No files found"}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.file_path;
              const isThisFileSelected = isFileSelected(group.file_path);
              const selectedVersion = selected.find((s) => s.file_path === group.file_path);

              return (
                <div key={group.file_path} className="group">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors",
                      isExpanded && "bg-accent/30",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !disabled && setExpandedGroup(isExpanded ? null : group.file_path)}
                  >
                    {mode === "multi" && (
                      <Checkbox
                        checked={isThisFileSelected}
                        className="h-4 w-4"
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => {
                          if (isThisFileSelected) {
                            onChange(selected.filter((s) => s.file_path !== group.file_path));
                          } else {
                            const firstVersion = group.versions[0];
                            if (firstVersion) {
                              onChange([
                                ...selected,
                                {
                                  file_path: group.file_path,
                                  version: firstVersion.version,
                                  url: firstVersion.url,
                                  tag: getVersionTag(group, firstVersion.version),
                                },
                              ]);
                            }
                          }
                        }}
                        disabled={disabled}
                      />
                    )}

                    <button
                      className="p-0.5 hover:bg-muted rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGroup(isExpanded ? null : group.file_path);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    <File className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate" title={group.file_path}>
                          {group.file_path.split("/").pop() || group.file_path}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{group.total_versions}v</span>
                      </div>
                      <div className="text-xs text-muted-foreground/70 truncate">{group.file_path}</div>
                    </div>

                    <div className="hidden sm:flex items-center gap-1 min-w-0 flex-shrink overflow-hidden">
                      {group.tags.slice(0, 2).map((t) => (
                        <Badge
                          key={t.tag}
                          variant="outline"
                          className="text-[10px] h-5 px-1.5 max-w-40 overflow-hidden"
                          title={t.tag}
                        >
                          <span className="truncate">{t.tag}</span>
                        </Badge>
                      ))}
                      {group.tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{group.tags.length - 2}</span>
                      )}
                    </div>

                    {isThisFileSelected && selectedVersion && (
                      <Badge className="h-5 px-1.5 text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                        v{selectedVersion.version}
                      </Badge>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="bg-muted/30 border-t border-border/50">
                      {group.versions.map((version) => {
                        const isSelected = isVersionSelected(group.file_path, version.version);
                        const versionTag = getVersionTag(group, version.version);

                        return (
                          <div
                            key={version.version}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 pl-10 cursor-pointer hover:bg-accent/30 transition-colors border-b border-border/30 last:border-0",
                              isSelected && "bg-green-500/5"
                            )}
                            onClick={() => handleSelectVersion(group, version)}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="h-4 w-4"
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => handleSelectVersion(group, version)}
                              disabled={disabled}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm font-medium", isSelected && "text-green-600")}>
                                  v{version.version}
                                </span>
                                {versionTag && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] h-5 px-1.5 max-w-40 overflow-hidden"
                                    title={versionTag}
                                  >
                                    <span className="truncate">{versionTag}</span>
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{formatFileSize(version.size)}</span>
                                <span>{formatDate(version.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll footer */}
        {(groups.length > 0 || hasMorePages || isFetchingMore) && (
          <div className="p-2 border-t bg-background">
            <div className="flex flex-col items-center gap-2">
              {isFetchingMore && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  Loading more files...
                </div>
              )}

              {!isFetchingMore && hasMorePages && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void fetchNextPage()}
                  disabled={disabled}
                >
                  Load more
                </Button>
              )}

              {!hasMorePages && groups.length > 0 && (
                <span className="text-xs text-muted-foreground">You&apos;ve reached the end</span>
              )}

              <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
