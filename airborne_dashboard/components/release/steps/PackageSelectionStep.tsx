"use client";

import React, { useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Package, Plus, Info } from "lucide-react";
import Link from "next/link";
import { useReleaseForm } from "../ReleaseFormContext";
import { PaginationControls } from "../PaginationControls";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { hasAppAccess, parseFileRef } from "@/lib/utils";
import { Pkg } from "@/types/release";

export function PackageSelectionStep() {
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const {
    mode,
    initialPackageInfo,
    selectedPackage,
    setSelectedPackage,
    packages,
    setPackages,
    packagesLoading,
    setPackagesLoading,
    pkgSearch,
    setPkgSearch,
    pkgPage,
    setPkgPage,
    totalPackagesPage,
    setTotalPackagesPage,
    propertiesJSON,
    setPropertiesJSON,
    setFiles,
    setFilePriority,
  } = useReleaseForm();

  const debouncedPackageSearch = useDebouncedValue(pkgSearch, 500);
  const pkgCount = 10;

  // Track if we've already auto-selected a package for clone/edit mode
  const hasAutoSelectedRef = useRef(false);

  // Load packages list
  useEffect(() => {
    if (!token || !org || !app) return;
    setPackagesLoading(true);
    apiFetch<any>(
      "/packages/list",
      { query: { page: pkgPage, count: pkgCount, search: pkgSearch ? pkgSearch : undefined } },
      { token, org, app }
    )
      .then((res) => {
        const loadedPackages = res.data || [];
        setPackages(loadedPackages);
        setTotalPackagesPage(res.total_pages);

        // Handle package selection from clone/edit data (only once)
        if ((mode === "clone" || mode === "edit") && initialPackageInfo && !hasAutoSelectedRef.current) {
          const targetTag = initialPackageInfo.tag;
          const targetVersion = initialPackageInfo.version;

          // Extract tag from index file path as fallback if not directly available
          let fallbackTag: string | undefined;
          if (initialPackageInfo.indexFilePath) {
            try {
              const parsed = parseFileRef(initialPackageInfo.indexFilePath);
              fallbackTag = parsed.tag;
            } catch (error) {
              console.error("Failed to extract tag from index file path:", error);
            }
          }

          // First try to find by tag and version
          let matchingPackage: Pkg | undefined = loadedPackages.find(
            (pkg: Pkg) => pkg.tag === targetTag && Number(pkg.version) === Number(targetVersion)
          );

          // If not found and we have a fallback tag, try with that
          if (!matchingPackage && fallbackTag && fallbackTag !== targetTag) {
            matchingPackage = loadedPackages.find(
              (pkg: Pkg) => pkg.tag === fallbackTag && Number(pkg.version) === Number(targetVersion)
            );
          }

          // If still not found, try to find by version only
          if (!matchingPackage) {
            matchingPackage = loadedPackages.find((pkg: Pkg) => Number(pkg.version) === Number(targetVersion));
          }

          if (matchingPackage) {
            hasAutoSelectedRef.current = true;
            setSelectedPackage(matchingPackage);
          }
        }
      })
      .catch(() => setPackages([]))
      .finally(() => setPackagesLoading(false));
  }, [token, org, app, pkgCount, pkgPage, debouncedPackageSearch]);

  // Update files when package is selected
  useEffect(() => {
    if (!selectedPackage) return;

    const pkgFiles = [];
    const existingPriorities = initialPackageInfo?.filePriorities || {};

    // Clear existing file priorities to avoid duplicates
    const newPriorities: Record<string, "important" | "lazy"> = {};

    for (const file of selectedPackage.files) {
      const file_parsed = parseFileRef(file);
      pkgFiles.push({
        id: file,
        file_path: file_parsed.filePath,
        version: file_parsed.version,
        tag: file_parsed.tag,
      });

      // Use existing priority if available, otherwise default to important
      const priority = existingPriorities[file_parsed.filePath] || "important";
      newPriorities[file] = priority;
    }

    // Set the new priorities, replacing any existing ones
    setFilePriority(newPriorities);
    setFiles(pkgFiles);
  }, [selectedPackage]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Version</CardTitle>
          <CardDescription>Choose an existing package to base this release on (optional)</CardDescription>
          {(mode === "clone" || mode === "edit") && initialPackageInfo && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
              <Info className="h-4 w-4 text-blue-600" />
              <div className="text-sm text-blue-800">
                {mode === "edit" ? "Current" : "Original"} release uses package version {initialPackageInfo.version}
                {mode === "clone" && " - it should be automatically selected if available"}.
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search packages..."
                value={pkgSearch}
                onChange={(e) => {
                  setPkgSearch(e.target.value);
                  setPkgPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
          {packagesLoading ? (
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
                {pkgSearch.trim() !== ""
                  ? `No packages found matching "${pkgSearch}".`
                  : "You haven't created any packages yet."}
              </p>
              {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && pkgSearch.trim() === "" && (
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead>Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p) => {
                  const key = `${p.tag}:${p.version}`;
                  const checked = selectedPackage
                    ? selectedPackage.version === p.version && selectedPackage.tag === p.tag
                    : false;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => setSelectedPackage(isChecked ? p : null)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.version}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{p.tag}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.index}</TableCell>
                      <TableCell className="text-muted-foreground">{p.files.length}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <PaginationControls currentPage={pkgPage} totalPages={totalPackagesPage} onPageChange={setPkgPage} />

          <div className="mt-6 space-y-2 hidden">
            <Label>Package Properties (JSON)</Label>
            <Textarea
              rows={4}
              value={propertiesJSON}
              onChange={(e) => setPropertiesJSON(e.target.value)}
              placeholder='{"featureFlag": true}'
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PackageSelectionStep;
