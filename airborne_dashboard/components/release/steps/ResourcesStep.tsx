"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Info } from "lucide-react";
import { useReleaseForm } from "../ReleaseFormContext";
import { PaginationControls } from "../PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import useSWR from "swr";
import { FilesApiResponse, ResourceFile } from "@/types/release";
import { parseFileRef } from "@/lib/utils";

const PER_PAGE = 50;

// Extract version from resource ID (format: "file_path@version:N" or "file_path@tag:X,version:N")
function extractVersionFromResource(resource: ResourceFile): number {
  // Try to extract from ID first (e.g., "/path/file.js@version:3")
  const versionMatch = resource.id.match(/@.*version:(\d+)/);
  if (versionMatch) {
    return parseInt(versionMatch[1], 10);
  }
  // Fallback to 0 if no version found
  return 0;
}

export function ResourcesStep() {
  const { token, org, app } = useAppContext();
  const {
    mode,
    files,
    selectedPackage,
    selectedResources,
    setSelectedResources,
    toggleResource,
    resourceSearch,
    setResourceSearch,
    resourceCurrentPage,
    setResourceCurrentPage,
    initialResourceFilePaths,
  } = useReleaseForm();

  const debouncedResourcesSearch = useDebouncedValue(resourceSearch, 500);

  // Track if we've already converted file paths to resource IDs
  const hasConvertedResourcesRef = useRef(false);

  // Load all resources/files with pagination
  const {
    data: resourceData,
    error: resourceError,
    isLoading: resourceLoading,
  } = useSWR(
    token && org && app ? ["/file/list", app, debouncedResourcesSearch, resourceCurrentPage] : null,
    async () =>
      apiFetch<FilesApiResponse>(
        "/file/list",
        {
          method: "GET",
          query: {
            search: resourceSearch || undefined,
            page: resourceCurrentPage,
            per_page: PER_PAGE,
          },
        },
        { token, org, app }
      )
  );

  // Get resource data from API response
  const allResources = resourceData?.files || [];
  const resourceTotal = resourceData?.total || 0;
  const resourceTotalPages = Math.ceil(resourceTotal / PER_PAGE);

  // Convert cloned/edited resource file paths to resource IDs when resources are loaded
  // For clone/edit, we select the LATEST version of each file that matches the stored file_path
  // Note: This will match resources visible on the current page. Resources on other pages
  // will be matched as the user navigates through pages.
  useEffect(() => {
    if (
      (mode === "clone" || mode === "edit") &&
      allResources.length > 0 &&
      initialResourceFilePaths.length > 0 &&
      !hasConvertedResourcesRef.current
    ) {
      // Build a map of file_path -> latest resource (by version) from current page
      const filePathToLatestResource = new Map<string, ResourceFile>();

      allResources.forEach((resource) => {
        const existing = filePathToLatestResource.get(resource.file_path);
        if (!existing) {
          filePathToLatestResource.set(resource.file_path, resource);
        } else {
          // Compare versions - extract version from ID if needed
          const existingVersion = extractVersionFromResource(existing);
          const currentVersion = extractVersionFromResource(resource);

          if (currentVersion > existingVersion) {
            filePathToLatestResource.set(resource.file_path, resource);
          }
        }
      });

      // Match initial file paths to the latest version of each resource
      const newResourceIds = new Set<string>();

      initialResourceFilePaths.forEach((filePath) => {
        const matchingResource = filePathToLatestResource.get(filePath);
        if (matchingResource) {
          newResourceIds.add(matchingResource.id);
        }
      });

      // Mark as converted so we don't reset on page changes
      hasConvertedResourcesRef.current = true;

      if (newResourceIds.size > 0) {
        setSelectedResources(newResourceIds);
      }
    }
  }, [mode, allResources, initialResourceFilePaths, setSelectedResources]);

  // Filter resources excluding package files and index file by file path only
  const packageFilePaths = useMemo(() => {
    return new Set([
      // Add file paths from current package files
      ...files.map((f) => f.file_path),
      // Add index file path if selected package has an index
      ...(selectedPackage?.index ? [parseFileRef(selectedPackage.index).filePath] : []),
      // Add file paths from all package files
      ...(selectedPackage?.files || []).map((fileRef) => parseFileRef(fileRef).filePath),
    ]);
  }, [files, selectedPackage]);

  const availableResources = useMemo(
    () => allResources.filter((r) => !packageFilePaths.has(r.file_path)),
    [allResources, packageFilePaths]
  );

  const handleResourceSearchChange = (value: string) => {
    setResourceSearch(value);
    setResourceCurrentPage(1); // Reset to first page when searching
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Resources</CardTitle>
          <CardDescription>Choose additional files to include as resources in this release</CardDescription>
          {(mode === "clone" || mode === "edit") && initialResourceFilePaths.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <span className="font-medium">
                  {mode === "edit" ? "Current" : "Original"} release has {initialResourceFilePaths.length} resource
                  {initialResourceFilePaths.length !== 1 ? "s" : ""}.
                </span>
                <span className="block text-xs mt-1">
                  The latest version of each resource file will be automatically selected.
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={resourceSearch}
                onChange={(e) => handleResourceSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {resourceError ? (
            <div className="text-red-600">Failed to load resources</div>
          ) : resourceLoading ? (
            <div>Loading resources...</div>
          ) : availableResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">
                {resourceSearch ? "No resources found matching your search" : "No additional resources available"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(PER_PAGE, availableResources.length)} available of {resourceTotal} files (Package
                files and index file are excluded)
                {resourceCurrentPage > 1 && ` (page ${resourceCurrentPage})`}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>File Path</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableResources.map((resource) => {
                    const isSelected = selectedResources.has(resource.id);
                    return (
                      <TableRow key={resource.id}>
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleResource(resource.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{resource.file_path}</TableCell>
                        <TableCell>{resource.tag}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {resource.created_at ? new Date(resource.created_at).toLocaleDateString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <PaginationControls
                currentPage={resourceCurrentPage}
                totalPages={resourceTotalPages}
                onPageChange={setResourceCurrentPage}
              />
            </div>
          )}

          {selectedResources.size > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                Selected {selectedResources.size} resource
                {selectedResources.size !== 1 ? "s" : ""} for this release
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ResourcesStep;
