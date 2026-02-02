"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Package, ChevronDown, ChevronRight, Crown, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PackageGroup, Pkg } from "@/types/release";

export type PaginatedResponse<T> = {
  data: T[];
  total_items?: number;
  total_pages?: number;
};

type ReleasePackageGroupItemProps = {
  group: PackageGroup;
  isExpanded: boolean;
  onToggle: () => void;
  token: string | null;
  org: string | null;
  appId: string;
  selectedPackage: Pkg | null;
  onPackageSelect: (groupId: string, pkg: Pkg | null) => void;
};

export function ReleasePackageGroupItem({
  group,
  isExpanded,
  onToggle,
  token,
  org,
  appId,
  selectedPackage,
  onPackageSelect,
}: ReleasePackageGroupItemProps) {
  const [packagesSearch, setPackagesSearch] = useState("");
  const debouncedPackagesSearch = useDebouncedValue(packagesSearch, 500);
  const packagesCount = 10;

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchPackages = useCallback(
    async (pageNum: number, append: boolean = false, isSearchChange: boolean = false) => {
      if (!token || !org || !appId) return;

      if (append) {
        setIsLoadingMore(true);
      } else if (isInitialLoad || isSearchChange) {
        setIsLoading(true);
      }

      try {
        const res = await apiFetch<PaginatedResponse<Pkg>>(
          `/package-groups/${group.id}/packages`,
          {
            query: {
              page: pageNum,
              count: packagesCount,
              search: debouncedPackagesSearch.trim() ? debouncedPackagesSearch.trim().toLowerCase() : undefined,
            },
          },
          { token, org, app: appId }
        );

        // Add package_group_id to each package
        const packagesWithGroupId = res.data.map((pkg) => ({
          ...pkg,
          package_group_id: group.id,
        }));

        if (append) {
          setPackages((prev) => [...prev, ...packagesWithGroupId]);
        } else {
          setPackages(packagesWithGroupId);
        }

        setTotalItems(res.total_items || res.data.length);
        setHasMore(pageNum < (res.total_pages || 1));
        setIsInitialLoad(false);
      } catch (err) {
        console.error("Failed to fetch packages:", err);
      } finally {
        setIsLoadingMore(false);
        setIsLoading(false);
      }
    },
    [token, org, appId, group.id, debouncedPackagesSearch, packagesCount, isInitialLoad]
  );

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPackages(nextPage, true);
    }
  }, [page, isLoadingMore, hasMore, fetchPackages]);

  // Fetch when expanded or search changes
  useEffect(() => {
    if (isExpanded && token && appId && org) {
      setPage(1);
      setHasMore(true);
      fetchPackages(1, false, !isInitialLoad);
    }
  }, [isExpanded, debouncedPackagesSearch, token, appId, org]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!observerRef.current || packages.length === 0 || !isExpanded) {
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
  }, [loadMore, hasMore, isLoadingMore, packages.length, isExpanded]);

  const handlePackageSelect = (pkg: Pkg, isChecked: boolean) => {
    onPackageSelect(group.id, isChecked ? pkg : null);
  };

  const isPackageSelected = (pkg: Pkg) => {
    // Use Number() to handle type mismatch between string and number versions
    return selectedPackage !== null && Number(selectedPackage.version) === Number(pkg.version);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium">{group.name}</span>
                {group.is_primary && (
                  <Badge
                    variant="default"
                    className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-black dark:bg-yellow-400 dark:hover:bg-yellow-500"
                  >
                    <Crown className="h-3 w-3" />
                    Primary
                  </Badge>
                )}
                {group.is_primary && (
                  <Badge
                    variant="outline"
                    className="text-red-500 border-red-400 dark:text-red-400 dark:border-red-500"
                  >
                    Required
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedPackage && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />v{selectedPackage.version} selected
                </Badge>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 py-4 bg-muted/30">
            {/* Search within packages */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  value={packagesSearch}
                  onChange={(e) => {
                    setPackagesSearch(e.target.value);
                  }}
                  className="pl-10 h-9"
                />
              </div>
            </div>

            {isLoading && packages.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading packages...</span>
                </div>
              </div>
            ) : !isLoading && packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Package className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {packagesSearch.trim() ? "No packages found matching your search." : "No packages in this group yet."}
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <span>
                    Showing {packages.length} of {totalItems} packages
                  </span>
                  {isLoading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Tag</TableHead>
                        {group.is_primary && <TableHead>Index</TableHead>}
                        <TableHead>Files</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packages.map((pkg) => {
                        const key = `${group.id}-${pkg.version}`;
                        const checked = isPackageSelected(pkg);
                        return (
                          <TableRow key={key} className={checked ? "bg-primary/5" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => handlePackageSelect(pkg, isChecked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">v{pkg.version}</TableCell>
                            <TableCell>
                              {pkg.tag ? (
                                <Badge variant="outline">{pkg.tag}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            {group.is_primary && (
                              <TableCell className="font-mono text-sm max-w-[200px] truncate">
                                {pkg.index || "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-muted-foreground">{pkg.files.length} files</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Infinite scroll sentinel */}
                  <div ref={observerRef} className="flex justify-center py-3 min-h-[40px]">
                    {hasMore && isLoadingMore && (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span className="text-sm text-muted-foreground">Loading more...</span>
                      </div>
                    )}
                    {hasMore && !isLoadingMore && packages.length > 0 && (
                      <div className="text-muted-foreground text-xs">Scroll for more...</div>
                    )}
                    {!hasMore && packages.length > 0 && (
                      <div className="text-muted-foreground text-xs">No more packages to load</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
