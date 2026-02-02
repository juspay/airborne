"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Search, ArrowLeft, FileText, Rocket, ChevronRight, Check, File, Package2, Crown, Info } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toastWarning } from "@/hooks/use-toast";
import { hasAppAccess } from "@/lib/utils";
import { notFound } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type ApiFile = { id?: string; file_path: string; url: string; version: number; tag?: string; size?: number };

type ApiResponse = {
  files: ApiFile[];
  total: number;
  page?: number;
  per_page?: number;
};

type PackageGroup = {
  id: string;
  name: string;
  is_primary: boolean;
};

export default function CreatePackagePage() {
  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const params = useParams<{ appId: string }>();
  const searchParams = useSearchParams();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";

  // Get group info from URL params
  const groupIdFromUrl = searchParams.get("groupId");
  const isPrimaryFromUrl = searchParams.get("isPrimary") === "true";

  const [currentStep, setCurrentStep] = useState(1);

  // Group selection state
  const [selectedGroup, setSelectedGroup] = useState<PackageGroup | null>(null);

  // Step 1: Package Details & Index File (only for primary groups)
  const [tag, setTag] = useState("");
  const [selectedIndexFile, setSelectedIndexFile] = useState<ApiFile | null>(null);
  const [indexFileSearch, setIndexFileSearch] = useState("");
  const debouncedIndexFileQuery = useDebouncedValue(indexFileSearch, 500);
  const [indexFileCurrentPage, setIndexFileCurrentPage] = useState(1);

  // Step 2 (or Step 1 for non-primary): Package Files
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

  // Fetch the specific group if groupId is provided in URL
  const { data: groupData, error: groupError } = useSWR(
    token && org && appId && groupIdFromUrl ? [`/package-groups/${groupIdFromUrl}`, appId] : null,
    async () =>
      apiFetch<PackageGroup>(`/package-groups/${groupIdFromUrl}`, { method: "GET" }, { token, org, app: appId })
  );

  // Show not found if groupId is invalid
  useEffect(() => {
    if (groupError) {
      notFound();
    }
  }, [groupError]);

  // Set selected group from URL param
  useEffect(() => {
    if (groupData) {
      setSelectedGroup(groupData);
    }
  }, [groupData]);

  // If no groupId is provided, show not found
  useEffect(() => {
    if (!groupIdFromUrl) {
      notFound();
    }
  }, [groupIdFromUrl]);

  const isPrimary = selectedGroup?.is_primary ?? isPrimaryFromUrl;
  const effectiveTotalSteps = isPrimary ? 2 : 1;

  // Data fetching for file lists (index file selection - only for primary groups)
  const {
    data: indexFileData,
    error: indexFileError,
    isLoading: indexFileLoading,
  } = useSWR(
    token && org && appId && isPrimary && currentStep === 1
      ? ["/file/list", appId, debouncedIndexFileQuery, indexFileCurrentPage, "index"]
      : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        {
          method: "GET",
          query: { search: indexFileSearch || undefined, page: indexFileCurrentPage, per_page: perPage },
        },
        { token, org, app: appId }
      )
  );

  // Data fetching for package files
  const filesStep = isPrimary ? 2 : 1;
  const { data, error, isLoading } = useSWR(
    token && org && appId && currentStep === filesStep
      ? ["/file/list", appId, debouncedSearchQuery, packageFileCurrentPage, "files"]
      : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        { method: "GET", query: { search: searchQuery || undefined, page: packageFileCurrentPage, per_page: perPage } },
        { token, org, app: appId }
      )
  );

  const indexFiles: ApiFile[] = indexFileData?.files || [];
  const files: ApiFile[] = data?.files || [];

  // Pagination data
  const indexFileTotal = indexFileData?.total || 0;
  const indexFileTotalPages = Math.ceil(indexFileTotal / perPage);
  const packageFileTotal = data?.total || 0;
  const packageFileTotalPages = Math.ceil(packageFileTotal / perPage);

  // Filter out the selected index file from package files (only relevant for primary groups)
  const availableFiles = useMemo(() => {
    if (!isPrimary || !selectedIndexFile) return files;
    return files.filter((f) => {
      const indexKey = selectedIndexFile.id || `${selectedIndexFile.file_path}@version:${selectedIndexFile.version}`;
      const fileKey = f.id || `${f.file_path}@version:${f.version}`;
      return fileKey !== indexKey;
    });
  }, [files, selectedIndexFile, isPrimary]);

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
    if (isPrimary) {
      switch (step) {
        case 1:
          return selectedIndexFile;
        case 2:
          return true;
        default:
          return false;
      }
    } else {
      // Non-primary: only files step
      return true;
    }
  };

  const handleIndexFileSearchChange = (value: string) => {
    setIndexFileSearch(value);
    setIndexFileCurrentPage(1);
  };

  const handlePackageFileSearchChange = (value: string) => {
    setSearchQuery(value);
    setPackageFileCurrentPage(1);
  };

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

      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

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

  async function onCreate() {
    if (!selectedGroup) {
      toastWarning("No Group Selected", "Please select a package group");
      return;
    }

    setIsSubmitting(true);
    try {
      const fileIds = Array.from(selectedFiles.values());

      // For primary groups, index is required
      // For non-primary groups, index should not be provided
      const indexPath =
        isPrimary && selectedIndexFile
          ? `${selectedIndexFile.file_path}@version:${selectedIndexFile.version}`
          : undefined;

      await apiFetch(
        `/package-groups/${selectedGroup.id}/packages`,
        {
          method: "POST",
          body: {
            ...(indexPath ? { index: indexPath } : {}),
            tag: tag || undefined,
            files: fileIds,
          },
        },
        { token, org, app: appId }
      );
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(appId)}/packages`);
    } catch (e: any) {
      console.log("Package creation failed", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  const steps = isPrimary
    ? [
        { number: 1, title: "Package Details & Index File", icon: Package2 },
        { number: 2, title: "Select Package Files", icon: File },
      ]
    : [{ number: 1, title: "Package Details & Files", icon: File }];

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(appId)}/packages`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
            Create Package
          </h1>
          <p className="text-muted-foreground mt-2">
            Creating package in <span className="font-medium">{selectedGroup?.name || "..."}</span>
            {isPrimary && (
              <Badge variant="outline" className="ml-2 gap-1">
                <Crown className="h-3 w-3" />
                Primary Group
              </Badge>
            )}
          </p>

          <div className="flex items-center gap-4 mt-6">
            {steps.map((step, index) => {
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
                  {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1 for Primary Groups: Index File Selection */}
        {isPrimary && currentStep === 1 && (
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
                <CardDescription>
                  Choose the main entry point file for your package.
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Index file is <strong>required</strong> for primary package groups. This serves as the main entry
                      point for OTA updates.
                    </AlertDescription>
                  </Alert>
                </CardDescription>
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
                      : "No files found. Create a file first from the Files page."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min(perPage, indexFiles.length)} of {indexFileTotal} files
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Tag</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {indexFiles.map((f) => {
                            const key = f.id || `${f.file_path}@version:${f.version}`;
                            const isSelected =
                              selectedIndexFile &&
                              (selectedIndexFile.id ||
                                `${selectedIndexFile.file_path}@version:${selectedIndexFile.version}`) === key;
                            return (
                              <TableRow key={key}>
                                <TableCell>
                                  <Checkbox
                                    checked={!!isSelected}
                                    onCheckedChange={() => setSelectedIndexFile(isSelected ? null : f)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{f.file_path}</TableCell>
                                <TableCell className="text-muted-foreground">{f.version}</TableCell>
                                <TableCell className="text-muted-foreground">{f.tag || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

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
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
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

        {/* Step 1 for Non-Primary Groups OR Step 2 for Primary Groups: Package Files */}
        {((!isPrimary && currentStep === 1) || (isPrimary && currentStep === 2)) && (
          <div className="space-y-6">
            {/* Show tag field for non-primary groups in the files step */}
            {!isPrimary && (
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
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This is a <strong>secondary package group</strong>. Index file is not required and cannot be
                      specified.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Files</CardTitle>
                <CardDescription>Choose files to include in this package</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => handlePackageFileSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="text-red-600">Failed to load files</div>
                ) : isLoading ? (
                  <div>Loading…</div>
                ) : availableFiles.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {searchQuery ? "No files found matching your search" : "No files available"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min(perPage, availableFiles.length)} of {packageFileTotal} files
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Tag</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {availableFiles.map((f) => {
                            const fileId = f.id || `${f.file_path}@version:${f.version}`;
                            const selectedFileId = selectedFiles.get(f.file_path);
                            const isThisVersionSelected = selectedFileId === fileId;
                            const isAnotherVersionSelected = selectedFileId && selectedFileId !== fileId;
                            const isSameAsIndexFile =
                              isPrimary && selectedIndexFile && f.file_path === selectedIndexFile.file_path;

                            return (
                              <TableRow
                                key={fileId}
                                className={isAnotherVersionSelected || isSameAsIndexFile ? "opacity-50" : ""}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isThisVersionSelected}
                                    disabled={!!isAnotherVersionSelected || !!isSameAsIndexFile}
                                    onCheckedChange={() => toggle(fileId)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {f.file_path}
                                  {isAnotherVersionSelected && (
                                    <div className="text-xs text-amber-600 mt-1">Another version already selected</div>
                                  )}
                                  {isSameAsIndexFile && (
                                    <div className="text-xs text-amber-600 mt-1">Selected as index file</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{f.version}</TableCell>
                                <TableCell className="text-muted-foreground">{f.tag || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

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
                    <div className="max-h-40 overflow-y-auto space-y-1">
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
                              {versionPart && <span className="text-muted-foreground">(v{versionPart})</span>}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => toggle(fileId)}>
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
            <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(appId)}/packages`}>
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
          {currentStep < effectiveTotalSteps ? (
            <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceedToStep(currentStep)}>
              Next Step
            </Button>
          ) : (
            <Button
              onClick={() => onCreate()}
              disabled={isPrimary ? !selectedIndexFile || isSubmitting : isSubmitting}
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              Create Package
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
