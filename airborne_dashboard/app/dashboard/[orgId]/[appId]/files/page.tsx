"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, ChevronRight, File, Filter, Plus, Loader2, Pencil } from "lucide-react";
import { FileCreationModal } from "@/components/file-creation-modal";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import type { FileGroup, FileGroupsResponse, TagInfo, TagsResponse } from "@/types/files";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

const FILES_PER_PAGE = 15;
const PAGE_AUTHZ = definePagePermissions({
  read_files: permission("file_group", "read", "app"),
  create_file: permission("file", "create", "app"),
  update_file: permission("file", "update", "app"),
});

export default function FilesPage() {
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canCreateFiles = permissions.can("create_file");
  const canUpdateFiles = permissions.can("update_file");

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [selectedTag, setSelectedTag] = useState<string>("all");

  // Pagination
  const [page, setPage] = useState(1);

  // UI state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Edit Tag dialog state
  const [isEditTagDialogOpen, setIsEditTagDialogOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<{
    filePath: string;
    version: number;
    currentTag: string;
  } | null>(null);
  const [newTagValue, setNewTagValue] = useState("");
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);

  // Fetch file groups with pagination
  const {
    data: groupsData,
    isLoading,
    mutate,
  } = useSWR(token && org && app ? ["/file/groups", app, debouncedSearch, selectedTag, page] : null, async () =>
    apiFetch<FileGroupsResponse>(
      "/file/groups",
      {
        method: "GET",
        query: {
          page,
          count: FILES_PER_PAGE,
          search: debouncedSearch || undefined,
          tags: selectedTag !== "all" ? selectedTag : undefined,
        },
      },
      { token, org, app }
    )
  );

  // Fetch all tags for the dropdown
  const { data: tagsData } = useSWR(
    token && org && app ? ["/file/tags", app] : null,
    async () =>
      apiFetch<TagsResponse>("/file/tags", { method: "GET", query: { page: 1, count: 100 } }, { token, org, app }),
    { revalidateOnFocus: false }
  );

  const groups = groupsData?.groups || [];
  const totalPages = groupsData?.total_pages || 1;
  const tags = tagsData?.data || [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setPage(1);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getVersionTag = (group: FileGroup, version: number) => {
    return group.tags.find((t) => t.version === version)?.tag;
  };

  // Handle opening edit tag dialog
  const handleEditTag = (filePath: string, version: number, currentTag: string) => {
    setEditingVersion({ filePath, version, currentTag });
    setNewTagValue(currentTag);
    setIsEditTagDialogOpen(true);
  };

  // Handle updating tag
  const handleUpdateTag = async () => {
    if (!editingVersion || !token || !org || !app) return;

    setIsUpdatingTag(true);
    try {
      const fileKey = `${editingVersion.filePath}@version:${editingVersion.version}`;
      await apiFetch(
        `/file/${encodeURIComponent(fileKey)}`,
        {
          method: "PATCH",
          body: { tag: newTagValue },
        },
        { token, org, app }
      );
      toastSuccess("Tag updated successfully");
      mutate(); // Refresh the data
      setIsEditTagDialogOpen(false);
    } catch (error) {
      toastError("Failed to update tag", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsUpdatingTag(false);
    }
  };

  // Pagination component (same pattern as packages/releases pages)
  const renderPaginationItems = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
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
      // First page
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

      // Ellipsis if needed
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Pages around current
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

      // Ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Last page
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
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Files</h1>
          <p className="text-muted-foreground mt-2">Manage your application assets and resources</p>
        </div>
        {canCreateFiles && (
          <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create File
          </Button>
        )}
      </div>

      {/* Filters Card - Same pattern as releases/packages pages */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files by path..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedTag} onValueChange={handleTagChange}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((tagInfo: TagInfo) => (
                  <SelectItem key={tagInfo.tag} value={tagInfo.tag}>
                    {tagInfo.tag} ({tagInfo.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Files Table - Same pattern as packages/releases pages */}
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            Files ({isLoading ? "..." : groupsData?.total_items || 0})
          </CardTitle>
          <CardDescription>All files with version history and tags</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading files...</span>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <File className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No files found</h3>
              <p className="text-muted-foreground mb-4">
                {debouncedSearch || selectedTag !== "all"
                  ? "No files match your filters."
                  : "You haven't created any files yet."}
              </p>
              {canCreateFiles && debouncedSearch === "" && selectedTag === "all" && (
                <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create your first file
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>File Path</TableHead>
                    <TableHead>Latest Version</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group: FileGroup) => {
                    const isExpanded = expandedGroup === group.file_path;
                    const latestVersion = group.versions[0];

                    return [
                      <TableRow
                        key={group.file_path}
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setExpandedGroup(isExpanded ? null : group.file_path)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{group.file_path}</TableCell>
                        <TableCell>{latestVersion ? `${latestVersion.version}` : "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {group.tags.slice(0, 2).map((t) => (
                              <Badge key={t.tag} variant="outline" className="text-[10px]">
                                {t.tag}
                              </Badge>
                            ))}
                            {group.tags.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">+{group.tags.length - 2}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {latestVersion ? formatFileSize(latestVersion.size) : "—"}
                        </TableCell>
                      </TableRow>,
                      isExpanded && (
                        <TableRow key={`${group.file_path}-expanded`} className="bg-muted/30">
                          <TableCell colSpan={5} className="p-0">
                            <div className="py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="pl-10 w-20">Version</TableHead>
                                    <TableHead>Tag</TableHead>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="w-24">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.versions.map((version) => {
                                    const versionTag = getVersionTag(group, version.version);
                                    return (
                                      <TableRow key={version.version} className="hover:bg-muted/50">
                                        <TableCell className="pl-10 font-medium">{version.version}</TableCell>
                                        <TableCell>
                                          {versionTag ? (
                                            <Badge variant="secondary" className="text-[10px]">
                                              {versionTag}
                                            </Badge>
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs truncate max-w-xs">
                                          {version.url}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                          {formatFileSize(version.size)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                          {formatDate(version.created_at)}
                                        </TableCell>
                                        <TableCell>
                                          {canUpdateFiles && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditTag(group.file_path, version.version, versionTag || "");
                                              }}
                                            >
                                              <Pencil className="h-3.5 w-3.5 mr-1" />
                                              Edit Tag
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      ),
                    ];
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
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

                      {renderPaginationItems(page, totalPages, setPage)}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page < totalPages) setPage(page + 1);
                          }}
                          className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <FileCreationModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} onCreated={() => mutate()} />

      {/* Edit Tag Dialog */}
      <Dialog open={isEditTagDialogOpen} onOpenChange={setIsEditTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag for {editingVersion?.filePath} (v{editingVersion?.version})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag">Tag</Label>
              <Input
                id="tag"
                placeholder="e.g., latest, production, v1.0"
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTagDialogOpen(false)} disabled={isUpdatingTag}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTag} disabled={isUpdatingTag}>
              {isUpdatingTag ? "Updating..." : "Update Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
