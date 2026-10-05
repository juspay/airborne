"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, PlugIcon as PkgIcon, Rocket, Plus, Package, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { useParams } from "next/navigation";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

type PackageFileSetSnapshot = {
  name: string;
  version: number;
  files: string[];
};

type ApiPackage = {
  index: string;
  tag?: string;
  version: number;
  files: string[];
  /** File sets the package was built from, snapshotted at creation. Empty for older packages. */
  file_sets?: PackageFileSetSnapshot[];
};

const PAGE_AUTHZ = definePagePermissions({
  read_packages: permission("package", "read", "app"),
  create_package: permission("package", "create", "app"),
});

function parseFileKey(key: string): { path: string; ref: string } {
  const at = key.lastIndexOf("@");
  if (at < 0) return { path: key, ref: "" };
  const suffix = key.slice(at + 1);
  if (suffix.startsWith("version:")) return { path: key.slice(0, at), ref: `v${suffix.slice("version:".length)}` };
  if (suffix.startsWith("tag:")) return { path: key.slice(0, at), ref: suffix.slice("tag:".length) };
  return { path: key, ref: "" };
}

export default function PackagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPkg, setExpandedPkg] = useState<number | null>(null);
  const [pkgFileSearch, setPkgFileSearch] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const count = 10;
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canCreatePackage = permissions.can("create_package");
  const params = useParams<{ appId: string }>();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";

  // Use appId from URL params in SWR key to ensure we fetch for the correct app when navigating
  const { data, isLoading } = useSWR(
    token && org && appId ? ["/packages/list", appId, debouncedSearchQuery, page, count] : null,
    async () =>
      apiFetch<any>(
        "/packages/list",
        { query: { page, count, search: searchQuery.trim() ? searchQuery.trim().toLowerCase() : undefined } },
        { token, org, app: appId }
      )
  );
  const packages: ApiPackage[] = data?.data || [];

  const renderPaginationItems = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is small
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(i);
              }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange(1);
            }}
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if current page is far from start
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(i);
              }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if current page is far from end
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(totalPages);
              }}
              isActive={currentPage === totalPages}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Packages</h1>
          <p className="text-muted-foreground mt-2">Bundle files together with properties and metadata</p>
        </div>
        {canCreatePackage && (
          <Button asChild className="gap-2">
            <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages/create`}>
              <Plus className="h-4 w-4" />
              Create Package
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Packages Versions</CardTitle>
            <PkgIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{isLoading ? "..." : packages.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <PkgIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? "..." : packages.reduce((sum, pkg) => sum + pkg.files.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">across all packages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Release Usage</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? "..." : packages.reduce((sum, pkg) => sum + pkg.version, 0)}
            </div>
            <p className="text-xs text-muted-foreground">total deployments</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages by index file name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setPage(1);
                    setSearchQuery(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            Packages ({isLoading ? "..." : packages.length})
          </CardTitle>
          <CardDescription>All packages with bundled file identifiers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading packages...</span>
              </div>
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No packages found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery.trim() !== ""
                  ? `No packages found matching "${searchQuery}".`
                  : "You haven't created any packages yet."}
              </p>
              {canCreatePackage && searchQuery.trim() === "" && (
                <Button asChild className="gap-2">
                  <Link
                    href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages/create`}
                  >
                    <Plus className="h-4 w-4" />
                    Create your first package
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg, i) => {
                  const isExpanded = expandedPkg === pkg.version;
                  return [
                    <TableRow
                      key={`${pkg.tag}-${pkg.version}-${i}`}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setExpandedPkg(isExpanded ? null : pkg.version);
                        setPkgFileSearch("");
                        setOpenSections(new Set());
                      }}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>{pkg.tag && <Badge variant="outline">{pkg.tag}</Badge>}</TableCell>
                      <TableCell className="font-mono text-sm">{pkg.index}</TableCell>
                      <TableCell className="text-muted-foreground">{pkg.version}</TableCell>
                      <TableCell className="text-muted-foreground">{pkg.files.length} files</TableCell>
                      {/* <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Package
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell> */}
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${pkg.version}-files`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="p-0">
                          <div className="py-3 px-10 space-y-3">
                            {pkg.files.length > 5 && (
                              <div className="relative max-w-sm">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                                <Input
                                  placeholder="Search files in this package..."
                                  value={pkgFileSearch}
                                  onChange={(e) => setPkgFileSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="pl-8 h-8 text-sm"
                                />
                              </div>
                            )}
                            {(() => {
                              const q = pkgFileSearch.trim().toLowerCase();
                              const matches = (key: string) => !q || key.toLowerCase().includes(q);

                              // Sections come from the package's own stored snapshot: the
                              // file sets it was created from. Files added individually
                              // (and all files of packages created without sets) fall under "Files".
                              const storedGroups = pkg.file_sets || [];
                              const groupedKeys = new Set(storedGroups.flatMap((g) => g.files));
                              const ungrouped = pkg.files.filter((f) => !groupedKeys.has(f));
                              const orderedSections: [string, string[]][] = storedGroups
                                .map((g): [string, string[]] => [`${g.name} (v${g.version})`, g.files])
                                .sort((a, b) => a[0].localeCompare(b[0]));
                              if (ungrouped.length > 0)
                                orderedSections.push([storedGroups.length > 0 ? "Other files" : "Files", ungrouped]);

                              const indexKey = parseFileKey(pkg.index);

                              const renderFileRow = (f: string) => {
                                const parsed = parseFileKey(f);
                                return (
                                  <div
                                    key={f}
                                    className="flex items-center gap-2 pl-9 pr-3 py-1.5 border-t border-border/40"
                                  >
                                    <span className="font-mono text-xs truncate flex-1 min-w-0" title={f}>
                                      {parsed.path}
                                    </span>
                                    {parsed.ref && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] max-w-36 overflow-hidden flex-shrink-0"
                                        title={parsed.ref}
                                      >
                                        <span className="truncate">{parsed.ref}</span>
                                      </Badge>
                                    )}
                                  </div>
                                );
                              };

                              return (
                                <div className="border rounded-md bg-background overflow-hidden">
                                  {/* Index file pinned on top */}
                                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5">
                                    <Badge className="text-[10px] flex-shrink-0">index</Badge>
                                    <span className="font-mono text-xs truncate flex-1 min-w-0" title={pkg.index}>
                                      {indexKey.path}
                                    </span>
                                    {indexKey.ref && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] max-w-36 overflow-hidden flex-shrink-0"
                                        title={indexKey.ref}
                                      >
                                        <span className="truncate">{indexKey.ref}</span>
                                      </Badge>
                                    )}
                                  </div>

                                  {orderedSections.map(([name, sectionFiles]) => {
                                    const visible = sectionFiles.filter(matches);
                                    if (q && visible.length === 0) return null;
                                    const isOpen = q ? true : openSections.has(name);
                                    return (
                                      <div key={name} className="border-t border-border/60">
                                        <button
                                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors text-left"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenSections((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(name)) next.delete(name);
                                              else next.add(name);
                                              return next;
                                            });
                                          }}
                                        >
                                          {isOpen ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                          )}
                                          <span className="text-sm font-medium">{name}</span>
                                          <span className="text-xs text-muted-foreground ml-auto">
                                            {visible.length} file{visible.length === 1 ? "" : "s"}
                                          </span>
                                        </button>
                                        {isOpen && visible.map(renderFileRow)}
                                      </div>
                                    );
                                  })}

                                  {q &&
                                    orderedSections.every(
                                      ([, sectionFiles]) => sectionFiles.filter(matches).length === 0
                                    ) && (
                                      <p className="text-xs text-muted-foreground px-3 py-3 border-t border-border/60">
                                        No files match your search.
                                      </p>
                                    )}
                                </div>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  ];
                })}
              </TableBody>
            </Table>
          )}
          {data?.total_pages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {renderPaginationItems(page, data.total_pages, setPage)}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < data.total_pages) setPage(page + 1);
                      }}
                      className={page >= data.total_pages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
