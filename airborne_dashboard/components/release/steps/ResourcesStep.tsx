"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { FilesApiResponse } from "@/types/release";
import { parseFileRef } from "@/lib/utils";

const PER_PAGE = 10;

export function ResourcesStep() {
  const { token, org, app } = useAppContext();
  const { mode, files, selectedPackage, selectedResources, setSelectedResources, toggleResource } = useReleaseForm();

  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceCurrentPage, setResourceCurrentPage] = useState(1);

  const debouncedResourcesSearch = useDebouncedValue(resourceSearch, 500);

  const {
    data: resourceData,
    error: resourceError,
    isLoading: resourceLoading,
  } = useSWR(
    token && org && app ? ["/file/list", org, app, debouncedResourcesSearch, resourceCurrentPage] : null,
    async () =>
      apiFetch<FilesApiResponse>(
        "/file/list",
        {
          method: "GET",
          query: {
            search: debouncedResourcesSearch || undefined,
            page: resourceCurrentPage,
            per_page: PER_PAGE,
          },
        },
        { token, org, app }
      )
  );

  const allResources = resourceData?.files || [];
  const resourceTotal = resourceData?.total || 0;
  const resourceTotalPages = Math.ceil(resourceTotal / PER_PAGE);

  const packageFilePaths = useMemo(() => {
    return new Set([
      ...files.map((f) => f.file_path),
      ...(selectedPackage?.index ? [parseFileRef(selectedPackage.index).filePath] : []),
      ...(selectedPackage?.files || []).map((fileRef) => parseFileRef(fileRef).filePath),
    ]);
  }, [files, selectedPackage]);

  useEffect(() => {
    if (packageFilePaths.size === 0) return;

    const newSet = new Set(selectedResources);
    let changed = false;
    for (const resourceId of selectedResources) {
      const { filePath } = parseFileRef(resourceId);
      if (packageFilePaths.has(filePath)) {
        newSet.delete(resourceId);
        changed = true;
      }
    }
    if (changed) {
      setSelectedResources(newSet);
    }
  }, [packageFilePaths, selectedResources, setSelectedResources]);

  const handleResourceSearchChange = (value: string) => {
    setResourceSearch(value);
    setResourceCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Resources</CardTitle>
          <CardDescription>Choose additional files to include as resources in this release</CardDescription>
          {(mode === "clone" || mode === "edit") && selectedResources.size > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <span className="font-medium">
                  {mode === "edit" ? "Current" : "Original"} release has {selectedResources.size} resource
                  {selectedResources.size !== 1 ? "s" : ""} pre-selected.
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
          ) : allResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">
                {resourceSearch ? "No resources found matching your search" : "No resources available"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(PER_PAGE, allResources.length)} of {resourceTotal} files
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
                  {allResources.map((resource) => {
                    const isInPackage = packageFilePaths.has(resource.file_path);
                    const isSelected = selectedResources.has(resource.id);
                    return (
                      <TableRow key={resource.id} className={isInPackage ? "opacity-60" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            disabled={isInPackage}
                            onCheckedChange={() => !isInPackage && toggleResource(resource.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {resource.file_path}
                          {isInPackage && <span className="ml-2 text-xs text-muted-foreground">(in package)</span>}
                        </TableCell>
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
