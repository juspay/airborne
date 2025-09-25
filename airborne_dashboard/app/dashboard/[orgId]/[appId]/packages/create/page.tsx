"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Search, ArrowLeft, FileText, Rocket, ChevronRight, Check, File, Package2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useRouter } from "next/navigation";
import { toastWarning } from "@/hooks/use-toast";
import { hasAppAccess } from "@/lib/utils";
import { notFound } from "next/navigation";

type ApiFile = { id?: string; file_path: string; url: string; version: number; tag?: string; size?: number };

type ApiResponse = {
  files: ApiFile[];
  total: number;
  page?: number;
  per_page?: number;
};

export default function CreatePackagePage() {
  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const totalSteps = 2;
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Package Details & Index File
  const [tag, setTag] = useState("");
  const [packageProperties] = useState("{}");
  const [selectedIndexFile, setSelectedIndexFile] = useState<ApiFile | null>(null);
  const [indexFileSearch, setIndexFileSearch] = useState("");
  const [indexFileCurrentPage, setIndexFileCurrentPage] = useState(1);

  // Step 2: Package Files
  const [searchQuery, setSearchQuery] = useState("");
  const [packageFileCurrentPage, setPackageFileCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const perPage = 10;
  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess]);

  // Data fetching for file lists
  const {
    data: indexFileData,
    error: indexFileError,
    isLoading: indexFileLoading,
  } = useSWR(
    token && org && app && currentStep === 1 ? ["/file/list", indexFileSearch, indexFileCurrentPage] : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        {
          method: "GET",
          query: { search: indexFileSearch || undefined, page: indexFileCurrentPage, per_page: perPage },
        },
        { token, org, app }
      )
  );

  const { data, error, isLoading } = useSWR(
    token && org && app && currentStep === 2 ? ["/file/list", searchQuery, packageFileCurrentPage] : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        { method: "GET", query: { search: searchQuery || undefined, page: packageFileCurrentPage, per_page: perPage } },
        { token, org, app }
      )
  );

  const indexFiles: ApiFile[] = indexFileData?.files || [];
  const files: ApiFile[] = data?.files || [];

  // Pagination data
  const indexFileTotal = indexFileData?.total || 0;
  const indexFileTotalPages = Math.ceil(indexFileTotal / perPage);
  const packageFileTotal = data?.total || 0;
  const packageFileTotalPages = Math.ceil(packageFileTotal / perPage);

  // Filter out the selected index file from package files
  const availableFiles = useMemo(() => {
    if (!selectedIndexFile) return files;
    return files.filter((f) => {
      const indexKey = selectedIndexFile.id || `${selectedIndexFile.file_path}@${selectedIndexFile.version}`;
      const fileKey = f.id || `${f.file_path}@${f.version}`;
      return fileKey !== indexKey;
    });
  }, [files, selectedIndexFile]);

  const toggle = (f: ApiFile) => {
    const key = f.id || `${f.file_path}@${f.version}`;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedList = useMemo(() => {
    return availableFiles.filter((f) => {
      const key = f.id || `${f.file_path}@${f.version}`;
      return selected[key];
    });
  }, [availableFiles, selected]);

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return tag && selectedIndexFile;
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

      const fileIds = selectedList.map((f) => f.id || f.file_path);
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
                  <Label htmlFor="tag">Tag *</Label>
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
                            const key = f.id || `${f.file_path}@${f.version}`;
                            const isSelected =
                              selectedIndexFile &&
                              (selectedIndexFile.id ||
                                `${selectedIndexFile.file_path}@${selectedIndexFile.version}`) === key;
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
                    {searchQuery ? "No files found matching your search" : "No additional files available"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min(perPage, availableFiles.length)} of {packageFileTotal} files
                      {packageFileCurrentPage > 1 && ` (page ${packageFileCurrentPage})`}
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
                            const key = f.id || `${f.file_path}@${f.version}`;
                            return (
                              <TableRow key={key}>
                                <TableCell>
                                  <Checkbox checked={!!selected[key]} onCheckedChange={() => toggle(f)} />
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

                {selectedList.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Selected Files ({selectedList.length})</Label>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {selectedList.map((f) => {
                        const key = f.id || `${f.file_path}@${f.version}`;
                        return (
                          <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-mono">{f.file_path}</span>
                              <span className="text-muted-foreground">(v{f.version})</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => toggle(f)}>
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
              <Button variant="outline" onClick={() => onCreate(true)} disabled={isSubmitting}>
                Save as Draft
              </Button>
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
