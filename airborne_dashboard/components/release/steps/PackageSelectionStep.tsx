"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Package, Plus, AlertCircle, Crown } from "lucide-react";
import Link from "next/link";
import { useReleaseForm } from "../ReleaseFormContext";
import { PaginationControls } from "../PaginationControls";
import { ReleasePackageGroupItem } from "../ReleasePackageGroupItem";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { hasAppAccess } from "@/lib/utils";
import { Pkg, PackageGroup } from "@/types/release";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PackageSelectionStep() {
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const { selectedPackage, setSelectedPackageForGroup, getSelectedPackageForGroup } = useReleaseForm();

  const [pkgGroupsSearch, setPkgGroupsSearch] = useState("");
  const [pkgGroupPage, setPkgGroupPage] = useState(1);
  const [totalPackageGroupsPage, setTotalPackageGroupsPage] = useState(0);
  const [packageGroupsLoading, setPackageGroupsLoading] = useState(false);
  const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
  const [primaryGroup, setPrimaryGroup] = useState<PackageGroup | null>(null);
  const [primaryGroupLoading, setPrimaryGroupLoading] = useState(false);

  const debouncedPackageSearch = useDebouncedValue(pkgGroupsSearch, 500);
  const pkgCount = 10;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch primary group separately (always available regardless of search)
  useEffect(() => {
    if (!token || !org || !app) return;
    setPrimaryGroupLoading(true);
    apiFetch<{ data: PackageGroup[]; total_pages: number }>(
      "/package-groups",
      {
        query: {
          page: 1,
          count: 1,
        },
      },
      { token, org, app }
    )
      .then((res) => {
        const groups = res.data || [];
        const primary = groups.find((g: PackageGroup) => g.is_primary) || groups[0] || null;
        setPrimaryGroup(primary);
        if (primary && expandedGroups.size === 0) {
          setExpandedGroups(new Set([primary.id]));
        }
      })
      .catch(() => setPrimaryGroup(null))
      .finally(() => setPrimaryGroupLoading(false));
  }, [token, org, app]);

  // Fetch package groups with search (for sub-groups)
  useEffect(() => {
    if (!token || !org || !app) return;
    setPackageGroupsLoading(true);
    apiFetch<{ data: PackageGroup[]; total_pages: number }>(
      "/package-groups",
      {
        query: {
          page: pkgGroupPage,
          count: pkgCount,
          search: debouncedPackageSearch ? debouncedPackageSearch.toLowerCase() : undefined,
        },
      },
      { token, org, app }
    )
      .then((res) => {
        const loadedGroups = res.data || [];
        setPackageGroups(loadedGroups);
        setTotalPackageGroupsPage(res.total_pages);
      })
      .catch(() => setPackageGroups([]))
      .finally(() => setPackageGroupsLoading(false));
  }, [token, org, app, pkgCount, pkgGroupPage, debouncedPackageSearch]);

  const handlePackageSelect = (groupId: string, pkg: Pkg | null) => {
    const isPrimary = primaryGroup?.id === groupId || packageGroups.find((g) => g.id === groupId)?.is_primary || false;
    setSelectedPackageForGroup(groupId, pkg, isPrimary);
  };

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

  const subGroups = packageGroups.filter((g) => !g.is_primary && g.id !== primaryGroup?.id);
  const primaryPackageSelected = primaryGroup ? selectedPackage !== null : false;
  const isSearching = debouncedPackageSearch.trim() !== "";

  return (
    <div className="space-y-6">
      {/* Primary Package Group - Required */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
            <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Primary Package</CardTitle>
          </div>
          <CardDescription>Select a package from the primary group. This is required for all releases.</CardDescription>
        </CardHeader>
        <CardContent>
          {primaryGroupLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading primary package group...</span>
              </div>
            </div>
          ) : !primaryGroup ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No primary package group</h3>
              <p className="text-muted-foreground mb-4">A primary package group needs to be created first.</p>
              {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
                <Button asChild className="gap-2">
                  <Link
                    href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(
                      app || ""
                    )}/packages/create`}
                  >
                    <Plus className="h-4 w-4" />
                    Create your first package
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <ReleasePackageGroupItem
              group={primaryGroup}
              isExpanded={expandedGroups.has(primaryGroup.id)}
              onToggle={() => toggleGroup(primaryGroup.id)}
              token={token}
              org={org}
              appId={app || ""}
              selectedPackage={selectedPackage}
              onPackageSelect={handlePackageSelect}
            />
          )}

          {!primaryPackageSelected && primaryGroup && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>You must select a package from the primary group to proceed.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sub-Package Groups - Optional */}
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Additional Packages</CardTitle>
          <CardDescription>
            Optionally select packages from additional groups. You can select one package per group. Files from the
            primary package take precedence over files with the same path in sub-packages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search package groups..."
                value={pkgGroupsSearch}
                onChange={(e) => {
                  setPkgGroupsSearch(e.target.value);
                  setPkgGroupPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          {packageGroupsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading package groups...</span>
              </div>
            </div>
          ) : subGroups.length > 0 ? (
            <div className="space-y-3">
              {subGroups.map((group) => (
                <ReleasePackageGroupItem
                  key={group.id}
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  token={token}
                  org={org}
                  appId={app || ""}
                  selectedPackage={getSelectedPackageForGroup(group.id)}
                  onPackageSelect={handlePackageSelect}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isSearching
                ? `No additional package groups found matching "${debouncedPackageSearch}"`
                : "No additional package groups available."}
            </div>
          )}

          {totalPackageGroupsPage > 1 && (
            <PaginationControls
              currentPage={pkgGroupPage}
              totalPages={totalPackageGroupsPage}
              onPageChange={setPkgGroupPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PackageSelectionStep;
