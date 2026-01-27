"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Search, ArrowLeft, FileText, Rocket, ChevronRight, Check, File, Package2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useParams, useRouter } from "next/navigation";
import { toastWarning } from "@/hooks/use-toast";
import { hasAppAccess } from "@/lib/utils";
import { notFound } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { FileTable } from "@/components/files/files-tables";

type ApiFile = { file_path: string; latest_version: number; total_versions: number; id: string };

type ApiResponse<T> = {
  data: T[];
  total_items: number;
  total_pages: number;
};

type File = {
  file_path: string;
  version: number;
  id: string;
};

export default function CreatePackagePage() {
  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const params = useParams<{ appId: string }>();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";
  const totalSteps = 2;
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Package Details & Index File
  const [tag, setTag] = useState("");
  const [packageProperties] = useState("{}");
  const [selectedIndexFile, setSelectedIndexFile] = useState<File | null>(null);
  const [indexFileSearch, setIndexFileSearch] = useState("");
  const debouncedIndexFileQuery = useDebouncedValue(indexFileSearch, 500);
  const [indexFileCurrentPage, setIndexFileCurrentPage] = useState(1);

  // Step 2: Package Files
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  const [packageFileCurrentPage, setPackageFileCurrentPage] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, string>>(new Map()); // Map<file_path, file_id>

  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const perPage = 10;
  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess]);

  // Data fetching for file lists
  // Use appId from URL params in SWR key to ensure we fetch for the correct app when navigating
  const {
    data: indexFileData,
    error: indexFileError,
    isLoading: indexFileLoading,
  } = useSWR(
    token && org && appId && currentStep === 1
      ? ["/file/list", appId, debouncedIndexFileQuery, indexFileCurrentPage]
      : null,
    async () =>
      apiFetch<ApiResponse<ApiFile>>(
        "/file/list",
        {
          method: "GET",
          query: {
            search: indexFileSearch || undefined,
            page: indexFileCurrentPage,
            count: perPage,
          },
        },
        { token, org, app: appId }
      )
  );

  // Use appId from URL params in SWR key to ensure we fetch for the correct app when navigating
  const { data, error, isLoading } = useSWR(
    token && org && appId && currentStep === 2
      ? ["/file/list", appId, debouncedSearchQuery, packageFileCurrentPage]
      : null,
    async () =>
      apiFetch<ApiResponse<ApiFile>>(
        "/file/list",
        {
          method: "GET",
          query: {
            search: searchQuery || undefined,
            page: packageFileCurrentPage,
            count: perPage,
          },
        },
        { token, org, app: appId }
      )
  );

  const indexFiles: ApiFile[] = indexFileData?.data || [];
  const files: ApiFile[] = data?.data || [];

  // Pagination data
  const indexFileTotal = indexFileData?.total_items || 0;
  const indexFileTotalPages = indexFileData?.total_pages || 0;
  const packageFileTotal = data?.total_items || 0;
  const packageFileTotalPages = data?.total_pages || 0;

  const toggle = (fileId: string) => {
    const file_path = fileId.split("@version:")[0];

    setSelectedFiles((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(file_path)) {
        newMap.delete(file_path);
      } else {
        newMap.set(file_path, fileId);
      }
      return newMap;
    });
  };

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return selectedIndexFile;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleIndexFileSearchChange = (value: string) => {
    setIndexFileSearch(value);
    setIndexFileCurrentPage(1); // Reset to first page when searching
  };

  const handlePackageFileSearchChange = (value: string) => {
    setSearchQuery(value);
    setPackageFileCurrentPage(1); // Reset to first page when searching
  };

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

  async function onCreate(_submitAsDraft?: boolean) {
    setIsSubmitting(true);
    try {
      let properties: Record<string, any> = {};
      try {
        properties = packageProperties.trim() ? JSON.parse(packageProperties) : {};
      } catch {
        toastWarning("Invalid JSON", "Package properties must be valid JSON");
        setIsSubmitting(false);
        return;
      }

      const fileIds = Array.from(selectedFiles.values());
      const indexPath = selectedIndexFile ? `${selectedIndexFile.file_path}@version:${selectedIndexFile.version}` : "";

      await apiFetch(
        "/packages",
        {
          method: "POST",
          body: {
            index: indexPath,
            tag: tag || undefined,
            properties,
            files: fileIds,
          },
        },
        { token, org, app }
      );
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages`);
    } catch (e: any) {
      console.log("Package creation failed", e);
      // Error toast will be shown automatically by apiFetch
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectAllFiles = async () => {
    try {
      const { data: allFiles } = await apiFetch<ApiResponse<ApiFile>>(
        "/file/list",
        {
          method: "GET",
          query: {
            search: searchQuery || undefined,
            all: true,
          },
        },
        { token, org, app }
      );

      setSelectedFiles((prev) => {
        const newMap = new Map(prev);
        allFiles.map((f) => {
          if (!selectedFiles.has(f.file_path) && f.file_path !== selectedIndexFile?.file_path) {
            newMap.set(f.file_path, f.id);
          }
        });
        return newMap;
      });
    } catch (error) {
      console.error("Failed to fetch all files for select all:", error);
    }
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Map());
  };

  const onIndexFileSelect = (file_path: string, file_id: string) => {
    setSelectedIndexFile(() => {
      const file = indexFiles.filter((f) => f.file_path === file_path)[0];
      const version = parseInt(file_id.split("@version:")[1]);
      return {
        id: file_id,
        file_path: file.file_path,
        version,
      };
    });
  };

  const isIndexFileIdSelected = (_: string, file_id: string): boolean => {
    return selectedIndexFile?.id === file_id;
  };
  const isIndexFilePathSelected = (file_path: string): boolean => {
    return selectedIndexFile?.file_path === file_path;
  };

  const onSelect = (file_path: string, file_id: string) => {
    setSelectedFiles((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(file_path) && newMap.get(file_path) === file_id) {
        newMap.delete(file_path);
      } else {
        newMap.set(file_path, file_id);
      }
      return newMap;
    });
  };
  const isFileIdSelected = (file_path: string, file_id: string): boolean => {
    return selectedFiles.get(file_path) === file_id;
  };
  const isFilePathSelected = (file_path: string): boolean => {
    return selectedFiles.has(file_path);
  };

  const isDisabled = (file_path: string): { disabled: boolean; text: string } => {
    return {
      disabled: file_path === selectedIndexFile?.file_path,
      text: "Selected as index file",
    };
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
            Create Package Version
          </h1>
          <p className="text-muted-foreground mt-2">Bundle files together with properties and metadata</p>

          <div className="flex items-center gap-4 mt-6">
            {[
              { number: 1, title: "Package Details & Index File", icon: Package2 },
              { number: 2, title: "Select Package Files", icon: File },
            ].map((step, index) => {
              const status =
                step.number < currentStep ? "completed" : step.number === currentStep ? "current" : "upcoming";
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                          flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                          ${status === "completed" ? "bg-primary border-primary text-primary-foreground" : status === "current" ? "border-primary text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground"}
                        `}
                    >
                      {status === "completed" ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="hidden sm:block">
                      <div
                        className={`font-medium text-sm ${status !== "upcoming" ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">Step {step.number}</div>
                    </div>
                  </div>
                  {index < 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Package Details</CardTitle>
                <CardDescription>Basic information about your package</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tag">Tag</Label>
                  <Input
                    id="tag"
                    placeholder="e.g., latest, v1.0, production"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Index File</CardTitle>
                <CardDescription>Choose the main entry point file for your package</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={indexFileSearch}
                      onChange={(e) => handleIndexFileSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {indexFileError ? (
                  <div className="text-red-600">Failed to load files</div>
                ) : indexFileLoading ? (
                  <div>Loading…</div>
                ) : indexFiles.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {indexFileSearch
                      ? "No files found matching your search."
                      : "No files found. Create a file first from the Create menu or the Files page."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min(perPage, indexFiles.length)} of {indexFileTotal} files
                      {indexFileCurrentPage > 1 && ` (page ${indexFileCurrentPage})`}
                    </div>
                    <div className="">
                      <FileTable
                        files={indexFiles}
                        isLoading={indexFileLoading}
                        onSelect={onIndexFileSelect}
                        isFileIdSelected={isIndexFileIdSelected}
                        isFilePathSelected={isIndexFilePathSelected}
                      />
                    </div>

                    {/* Index File Pagination */}
                    {indexFileTotalPages > 1 && (
                      <div className="mt-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (indexFileCurrentPage > 1) setIndexFileCurrentPage(indexFileCurrentPage - 1);
                                }}
                                className={indexFileCurrentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>

                            {renderPaginationItems(indexFileCurrentPage, indexFileTotalPages, setIndexFileCurrentPage)}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (indexFileCurrentPage < indexFileTotalPages)
                                    setIndexFileCurrentPage(indexFileCurrentPage + 1);
                                }}
                                className={
                                  indexFileCurrentPage >= indexFileTotalPages ? "pointer-events-none opacity-50" : ""
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}

                {selectedIndexFile && (
                  <div className="mt-4 p-3 bg-green-10 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-sm">{selectedIndexFile.file_path}</span>
                      <span className="text-muted-foreground text-xs">(v{selectedIndexFile.version})</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Files</CardTitle>
                <CardDescription>Choose additional files to include in this package</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">Bulk Actions</p>
                    <p className="text-xs text-muted-foreground">
                      &quot;Select All&quot; selects the latest versions or files matching the current tag/search,
                      respecting manual selections. &quot;Deselect All&quot; clears all selections.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllFiles}
                      disabled={files.length === 0 || selectedFiles.size === packageFileTotal - 1}
                    >
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllFiles} disabled={selectedFiles.size === 0}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="my-4 space-y-3 ">
                  <div className="flex gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => handlePackageFileSearchChange(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="text-red-600">Failed to load files</div>
                ) : isLoading ? (
                  <div>Loading…</div>
                ) : files.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {searchQuery ? "No files found matching your search" : "No additional files available"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min(perPage, files.length)} of {packageFileTotal} files
                      {packageFileCurrentPage > 1 && ` (page ${packageFileCurrentPage})`}
                    </div>
                    <div>
                      <FileTable
                        files={files}
                        isLoading={isLoading}
                        onSelect={onSelect}
                        isFileIdSelected={isFileIdSelected}
                        isFilePathSelected={isFilePathSelected}
                        disabled={isDisabled}
                      />
                    </div>

                    {/* Package Files Pagination */}
                    {packageFileTotalPages > 1 && (
                      <div className="mt-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (packageFileCurrentPage > 1) setPackageFileCurrentPage(packageFileCurrentPage - 1);
                                }}
                                className={packageFileCurrentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>

                            {renderPaginationItems(
                              packageFileCurrentPage,
                              packageFileTotalPages,
                              setPackageFileCurrentPage
                            )}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (packageFileCurrentPage < packageFileTotalPages)
                                    setPackageFileCurrentPage(packageFileCurrentPage + 1);
                                }}
                                className={
                                  packageFileCurrentPage >= packageFileTotalPages
                                    ? "pointer-events-none opacity-50"
                                    : ""
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}

                {selectedFiles.size > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Selected Files ({selectedFiles.size})</Label>
                    <div className="max-h-120 overflow-y-auto space-y-1">
                      {Array.from(selectedFiles.values()).map((fileId) => {
                        const [file_path, versionPart] = fileId.split("@version:");
                        return (
                          <div
                            key={file_path}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-mono">{file_path}</span>
                              {versionPart && <span className="text-muted-foreground">(Version {versionPart})</span>}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                toggle(fileId);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages`}>
              Cancel
            </Link>
          </Button>
          {currentStep > 1 && (
            <Button variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>
              Previous
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {currentStep < totalSteps ? (
            <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceedToStep(currentStep)}>
              Next Step
            </Button>
          ) : (
            <>
              <Button
                onClick={() => onCreate()}
                disabled={!canProceedToStep(1) || !canProceedToStep(2) || isSubmitting}
                className="gap-2"
              >
                <Rocket className="h-4 w-4" />
                Create Package
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
