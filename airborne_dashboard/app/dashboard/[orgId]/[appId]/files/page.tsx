"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Edit, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { FileCreationModal } from "@/components/file-creation-modal";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { hasAppAccess } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useParams } from "next/navigation";

type ApiFile = {
  id: string;
  file_path: string;
  url: string;
  version: number;
  tag?: string;
  size?: number;
  status?: string;
  created_at?: string;
  metadata?: Record<string, any>;
};

type ApiResponse = {
  files: ApiFile[];
  total: number;
  page?: number;
  per_page?: number;
};

export default function FilesPage() {
  const { token, org, app, getOrgAccess, getAppAccess } = useAppContext();
  const params = useParams<{ appId: string }>();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const perPage = 10;

  // Use appId from URL params in SWR key to ensure we fetch for the correct app when navigating
  const { data, error, mutate, isLoading } = useSWR(
    token && org && appId ? ["/file/list", appId, debouncedSearchQuery, currentPage] : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        { method: "GET", query: { search: searchQuery || undefined, page: currentPage, per_page: perPage } },
        { token, org, app: appId }
      )
  );

  const files: ApiFile[] = data?.files || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  async function updateTag(f: ApiFile) {
    const currentKey = f.id || f.file_path;
    const newTag = prompt(`Update tag for ${currentKey}`, f.tag || "");
    if (!newTag) return;
    await apiFetch(
      `/file/${encodeURIComponent(currentKey)}`,
      { method: "PATCH", body: { tag: newTag } },
      { token, org, app }
    );
    mutate();
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const renderPaginationItems = () => {
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
                setCurrentPage(i);
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
              setCurrentPage(1);
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
                setCurrentPage(i);
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
                setCurrentPage(totalPages);
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
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Files</h1>
          <p className="text-muted-foreground mt-2">Manage your application assets and resources</p>
        </div>
        {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            Create File
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files by path, tag, or metadata..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            Files{" "}
            {isLoading ? "" : `(${total} total, showing ${Math.min(perPage, files.length)} on page ${currentPage})`}
          </CardTitle>
          <CardDescription>URL-registered files for your application</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={7} className="text-red-600">
                    Failed to load files
                  </TableCell>
                </TableRow>
              )}
              {!error && files.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {searchQuery
                      ? "No files found matching your search."
                      : "No files found. Create your first file to get started."}
                  </TableCell>
                </TableRow>
              )}
              {!error &&
                files
                  .filter((f) => (filterType === "all" ? true : f.status === filterType))
                  .map((f) => (
                    <TableRow key={f.id || f.file_path}>
                      <TableCell className="font-mono text-sm">{f.file_path}</TableCell>
                      <TableCell>{f.tag && <Badge variant="outline">{f.tag}</Badge>}</TableCell>
                      <TableCell className="text-muted-foreground">{f.version}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">{f.url}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "ready" ? "default" : "secondary"}>{f.status || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.created_at ? new Date(f.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateTag(f)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Update Tag
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {renderPaginationItems()}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <FileCreationModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} onCreated={() => mutate()} />
    </div>
  );
}
