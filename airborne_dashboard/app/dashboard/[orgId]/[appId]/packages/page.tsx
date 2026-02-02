"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Layers, Crown, FolderOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { hasAppAccess } from "@/lib/utils";
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
import { PackageGroupItem, PackageGroup, PaginatedResponse } from "@/components/package-group-item";

export default function PackagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const count = 10;
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const params = useParams<{ appId: string }>();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";

  // State for expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Dialog states
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PackageGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Fetch package groups (paginated with search)
  const {
    data: groupsData,
    isLoading: groupsLoading,
    mutate: mutateGroups,
  } = useSWR(token && org && appId ? ["/package-groups", appId, debouncedSearchQuery, page, count] : null, async () =>
    apiFetch<PaginatedResponse<PackageGroup>>(
      "/package-groups",
      { query: { page, count, search: searchQuery.trim() ? searchQuery.trim().toLowerCase() : undefined } },
      { token, org, app: appId }
    )
  );

  const { data: primaryGroupData } = useSWR(token && org && appId ? ["/package-groups", appId] : null, async () =>
    apiFetch<PaginatedResponse<PackageGroup>>(
      "/package-groups",
      { query: { page: 1, count: 1 } },
      { token, org, app: appId }
    )
  );

  const packageGroups: PackageGroup[] = groupsData?.data || [];
  const totalPages = groupsData?.total_pages || 1;
  const totalItems = groupsData?.total_items || packageGroups.length;
  const primaryGroup = primaryGroupData?.data[0] || null;

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsSubmitting(true);
    setDialogError(null);

    try {
      await apiFetch(
        "/package-groups",
        {
          method: "POST",
          body: { name: newGroupName.trim() },
        },
        { token, org, app: appId }
      );
      setIsCreateGroupDialogOpen(false);
      setNewGroupName("");
      mutateGroups();
    } catch (e: any) {
      setDialogError(e.message || "Failed to create package group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGroup = async () => {
    if (!editingGroup || !newGroupName.trim()) return;
    setIsSubmitting(true);
    setDialogError(null);

    try {
      await apiFetch(
        `/package-groups/${editingGroup.id}`,
        {
          method: "PATCH",
          body: { name: newGroupName.trim() },
        },
        { token, org, app: appId }
      );
      setIsEditGroupDialogOpen(false);
      setNewGroupName("");
      setEditingGroup(null);
      mutateGroups();
    } catch (e: any) {
      setDialogError(e.message || "Failed to update package group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (group: PackageGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setDialogError(null);
    setIsEditGroupDialogOpen(true);
  };

  const renderPaginationItems = (
    currentPage: number,
    totalPagesCount: number,
    onPageChange: (page: number) => void
  ) => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPagesCount <= maxVisiblePages) {
      for (let i = 1; i <= totalPagesCount; i++) {
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

      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPagesCount - 1, currentPage + 1);

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

      if (currentPage < totalPagesCount - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      if (totalPagesCount > 1) {
        items.push(
          <PaginationItem key={totalPagesCount}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(totalPagesCount);
              }}
              isActive={currentPage === totalPagesCount}
            >
              {totalPagesCount}
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
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
            Package Groups
          </h1>
          <p className="text-muted-foreground mt-2">Organize packages into groups for better management</p>
        </div>
        {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
          <Button onClick={() => setIsCreateGroupDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Package Group
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Package Groups</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{groupsLoading ? "..." : totalItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Primary Group</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{groupsLoading ? "..." : primaryGroup?.name || "—"}</div>
            <p className="text-xs text-muted-foreground">Main package group</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Secondary Groups</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{groupsLoading ? "..." : totalItems - 1}</div>
            <p className="text-xs text-muted-foreground">Additional groups</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search package groups by name..."
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

      {/* Package Groups List */}
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            Package Groups ({groupsLoading ? "..." : totalItems})
          </CardTitle>
          <CardDescription>Click on a group to view and manage its packages</CardDescription>
        </CardHeader>
        <CardContent>
          {groupsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading package groups...</span>
              </div>
            </div>
          ) : packageGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No package groups found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery.trim() !== ""
                  ? `No package groups found matching "${searchQuery}".`
                  : "No package groups available."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {packageGroups.map((group) => (
                <PackageGroupItem
                  key={group.id}
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  onEdit={() => openEditDialog(group)}
                  token={token}
                  org={org}
                  appId={appId}
                  hasAccess={hasAppAccess(getOrgAccess(org), getAppAccess(org, app))}
                />
              ))}
            </div>
          )}

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
        </CardContent>
      </Card>

      {/* Create Package Group Dialog */}
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-space-grotesk)]">Create Package Group</DialogTitle>
            <DialogDescription>
              Create a new package group to organize your packages. Note: This will be a secondary group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                placeholder="e.g., feature-flags, assets, configs"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGroupName.trim()) {
                    handleCreateGroup();
                  }
                }}
              />
            </div>
            {dialogError && <p className="text-sm text-red-600">{dialogError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Package Group Dialog */}
      <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-space-grotesk)]">Edit Package Group</DialogTitle>
            <DialogDescription>Update the name of this package group.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-name">Group Name *</Label>
              <Input
                id="edit-group-name"
                placeholder="e.g., feature-flags, assets, configs"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGroupName.trim()) {
                    handleEditGroup();
                  }
                }}
              />
            </div>
            {dialogError && <p className="text-sm text-red-600">{dialogError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditGroupDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleEditGroup} disabled={!newGroupName.trim() || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
