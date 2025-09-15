"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Search, Info, ChevronRight, Target, Check, PlugIcon as PkgIcon, FileText, Settings } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { parseFileRef } from "@/lib/utils";
import Link from "next/link";
import { toastWarning } from "@/hooks/use-toast";
import { ApiRelease } from "../page";
import useSWR from "swr";

type Pkg = { index: string; tag: string; version: number; files: string[] };
type FileItem = { id: string; file_path: string; version?: number; tag?: string; size?: number };
type ResourceFile = { id: string; file_path: string; size?: number; created_at?: string; tag: string };

type ApiResponse = {
  files: ResourceFile[];
  total: number;
  page?: number;
  per_page?: number;
};

type TargetingRule = {
  dimension: string;
  operator: "equals";
  values: string;
};

export default function CreateReleasePage() {
  const totalSteps = 5;
  const [currentStep, setCurrentStep] = useState(1);

  // Configuration state
  const [bootTimeout, setBootTimeout] = useState<number>(4000);
  const [releaseConfigTimeout, setReleaseConfigTimeout] = useState<number>(4000);
  const [configProperties, setConfigProperties] = useState<string>("{}");

  const [propertiesJSON, setPropertiesJSON] = useState<string>("{}");

  const [pkgSearch, setPkgSearch] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePriority, setFilePriority] = useState<Record<string, "important" | "lazy">>({});
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>([]);
  const [rolloutPercentage] = useState(100);
  const [dimensions, setDimensions] = useState<{ dimension: string; values: string[] }[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);

  // Resource-related state
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceCurrentPage, setResourceCurrentPage] = useState(1);

  const { token, org, app } = useAppContext();

  const router = useRouter();
  const perPage = 50;

  // Load packages list
  useEffect(() => {
    if (!token || !org || !app) return;
    apiFetch<any>("/packages/list", { query: { offset: 0, limit: 100 } }, { token, org, app })
      .then((res) => {
        setPackages(res.packages || []);
      })
      .catch(() => setPackages([]));
  }, [token, org, app]);

  useEffect(() => {
    if (selectedPackage) {
      const pkgFiles = [];
      for (const file of selectedPackage.files) {
        const file_parsed = parseFileRef(file);
        pkgFiles.push({
          id: file,
          file_path: file_parsed.filePath,
          version: file_parsed.version,
          tag: file_parsed.tag,
        });
        setFilePriority((prev) => ({ ...prev, [file]: "important" }));
      }
      setFiles(pkgFiles);
    }
  }, [selectedPackage]);

  // Load dimensions options
  useEffect(() => {
    if (!token || !org || !app) return;
    apiFetch<any>("/organisations/applications/dimension/list", {}, { token, org, app })
      .then((res) => {
        const data = (res.data || []) as any[];
        const dims: any = data.map((d) => ({
          dimension: d.dimension,
          values: Object.values((d.schema?.properties || {}).value?.enum || d.values || []),
        }));
        setDimensions(dims);
      })
      .catch(() => setDimensions([]));
  }, [token, org, app]);

  // Load all resources/files with pagination
  const {
    data: resourceData,
    error: resourceError,
    isLoading: resourceLoading,
  } = useSWR(
    token && org && app && currentStep === 4 ? ["/file/list", resourceSearch, resourceCurrentPage] : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        { method: "GET", query: { search: resourceSearch || undefined, page: resourceCurrentPage, per_page: perPage } },
        { token, org, app }
      )
  );

  const { data } = useSWR(token && org && app ? ["/releases/list"] : null, async () =>
    apiFetch<any>("/releases/list", {}, { token, org, app })
  );
  const releases: ApiRelease[] = data?.releases || [];

  const filteredPackages = useMemo(
    () => packages.filter((p) => (p.index || "").toLowerCase().includes(pkgSearch.toLowerCase())),
    [packages, pkgSearch]
  );

  // Get resource data from API response
  const allResources = resourceData?.files || [];
  const resourceTotal = resourceData?.total || 0;
  const resourceTotalPages = Math.ceil(resourceTotal / perPage);

  // Filter resources excluding package files and index file by file path only
  const packageFilePaths = new Set([
    // Add file paths from current package files
    ...files.map((f) => f.file_path),
    // Add index file path if selected package has an index
    ...(selectedPackage?.index ? [parseFileRef(selectedPackage.index).filePath] : []),
    // Add file paths from all package files
    ...(selectedPackage?.files || []).map((fileRef) => parseFileRef(fileRef).filePath),
  ]);

  const availableResources = useMemo(
    () => allResources.filter((r) => !packageFilePaths.has(r.file_path)),
    [allResources, packageFilePaths]
  );

  const importantFiles = Object.entries(filePriority)
    .filter(([, v]) => v === "important")
    .map(([k]) => k);
  const lazyFiles = Object.entries(filePriority)
    .filter(([, v]) => v === "lazy")
    .map(([k]) => k);

  const addRule = () => setTargetingRules((r) => [...r, { dimension: "", operator: "equals", values: "" }]);
  const removeRule = (i: number) => setTargetingRules((r) => r.filter((_, idx) => idx !== i));
  const updateRule = (i: number, patch: Partial<TargetingRule>) =>
    setTargetingRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return true; // Configuration step - always can proceed
      case 2:
        return selectedPackage !== null;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleResourceSearchChange = (value: string) => {
    setResourceSearch(value);
    setResourceCurrentPage(1); // Reset to first page when searching
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

  const handleSubmit = async () => {
    let properties: Record<string, any> = {};
    try {
      properties = propertiesJSON.trim() ? JSON.parse(propertiesJSON) : {};
    } catch {
      toastWarning("Invalid JSON", "Package properties must be valid JSON");
      return;
    }

    let configProps: Record<string, any> = {};
    try {
      configProps = configProperties.trim() ? JSON.parse(configProperties) : {};
    } catch {
      toastWarning("Invalid JSON", "Configuration properties must be valid JSON");
      return;
    }

    const dimensionsObj: Record<string, any> = {};
    targetingRules.forEach((r) => {
      if (!r.dimension || r.values.length === 0) return;
      // simplify: only "in" semantics
      dimensionsObj[r.dimension] = r.values.length === 1 ? r.values[0] : r.values;
    });

    const body: any = {
      config: {
        traffic_percentage: rolloutPercentage,
        boot_timeout: bootTimeout,
        release_config_timeout: releaseConfigTimeout,
        properties: configProps,
      },
      package: { properties, important: importantFiles, lazy: lazyFiles },
      dimensions: Object.keys(dimensionsObj).length ? dimensionsObj : undefined,
      resources: Array.from(selectedResources),
    };
    if (selectedPackage) {
      body.package_id = `version:${selectedPackage.version}`;
    }
    try {
      await apiFetch("/releases", { method: "POST", body }, { token, org, app });
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases`);
    } catch (e: any) {
      console.log("Release creation fail", e);
      // Error toast will be shown automatically by apiFetch
    }
  };

  return (
    <div className="p-6">
      <div className="flex-1">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Create Release</h1>
        <p className="text-muted-foreground mt-2">Step-by-step: configure, package, files, targeting</p>

        <div className="flex items-center gap-4 mt-6">
          {[
            { number: 1, title: "Configure", icon: Settings },
            { number: 2, title: "Package & Details", icon: PkgIcon },
            { number: 3, title: "Package File Priorities", icon: Info },
            { number: 4, title: "Resources", icon: FileText },
            { number: 5, title: "Targeting", icon: Target },
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
                {index < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6 mt-6">
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Configuration</CardTitle>
                <CardDescription>Configure timeout settings and additional properties for this release</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bootTimeout">Boot Timeout (ms)</Label>
                    <Input
                      id="bootTimeout"
                      type="number"
                      value={bootTimeout}
                      onChange={(e) => setBootTimeout(Number(e.target.value))}
                      placeholder="4000"
                      min="0"
                      step="100"
                    />
                    <p className="text-xs text-muted-foreground">Maximum time to wait for application boot</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="releaseConfigTimeout">Release Config Timeout (ms)</Label>
                    <Input
                      id="releaseConfigTimeout"
                      type="number"
                      value={releaseConfigTimeout}
                      onChange={(e) => setReleaseConfigTimeout(Number(e.target.value))}
                      placeholder="4000"
                      min="0"
                      step="100"
                    />
                    <p className="text-xs text-muted-foreground">Maximum time to wait for release configuration</p>
                  </div>
                </div>

                <div className="space-y-2 hidden">
                  <Label htmlFor="configProperties">Additional Properties (JSON)</Label>
                  <Textarea
                    id="configProperties"
                    rows={6}
                    value={configProperties}
                    onChange={(e) => setConfigProperties(e.target.value)}
                    placeholder='{"feature_flags": {"new_ui": true}, "api_version": "v2"}'
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Additional configuration properties in JSON format</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Version</CardTitle>
                <CardDescription>Choose an existing package to base this release on (optional)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search packages..."
                      value={pkgSearch}
                      onChange={(e) => setPkgSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

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
                    {filteredPackages.map((p) => {
                      const key = `${p.tag}:${p.version}`;
                      const checked = selectedPackage
                        ? `${selectedPackage.tag}:${selectedPackage.version}` === key
                        : false;
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => setSelectedPackage(checked ? null : p)}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.version}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.tag}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{p.index}</TableCell>
                          <TableCell className="text-muted-foreground">{p.files.length}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

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
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
                  Configure File Priorities
                </CardTitle>
                <CardDescription>Choose which files load immediately (important) vs on-demand (lazy)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 bg-blue-10 border border-blue-200 rounded-lg mb-4">
                  <Info className="h-4 w-4 text-blue-600" />
                  <div className="text-sm">All files default to Important. Switch to Lazy to defer loading.</div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((f) => {
                      const id = f.id || `${f.file_path}@version:${f.version}`;
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-mono text-sm">{f.file_path}</TableCell>
                          <TableCell className="text-muted-foreground">{f.tag}</TableCell>
                          <TableCell className="text-muted-foreground">{f.version}</TableCell>
                          <TableCell>
                            <Select
                              value={filePriority[id] || "important"}
                              onValueChange={(val: "important" | "lazy") => {
                                setFilePriority((prev) => ({ ...prev, [id]: val }));
                                console.log("Updated file priorities", filePriority);
                              }}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="important">Important</SelectItem>
                                <SelectItem value="lazy">Lazy</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Resources</CardTitle>
                <CardDescription>Choose additional files to include as resources in this release</CardDescription>
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
                      Showing {Math.min(perPage, availableResources.length)} available of {resourceTotal} files (Package
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
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedResources);
                                    if (checked) {
                                      newSelected.add(resource.id);
                                    } else {
                                      newSelected.delete(resource.id);
                                    }
                                    setSelectedResources(newSelected);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">{resource.file_path}</TableCell>
                              <TableCell className="text-muted-foreground">{resource.tag}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {resource.created_at ? new Date(resource.created_at).toLocaleDateString() : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Resources Pagination */}
                    {resourceTotalPages > 1 && (
                      <div className="mt-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (resourceCurrentPage > 1) setResourceCurrentPage(resourceCurrentPage - 1);
                                }}
                                className={resourceCurrentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>

                            {renderPaginationItems(resourceCurrentPage, resourceTotalPages, setResourceCurrentPage)}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (resourceCurrentPage < resourceTotalPages)
                                    setResourceCurrentPage(resourceCurrentPage + 1);
                                }}
                                className={
                                  resourceCurrentPage >= resourceTotalPages ? "pointer-events-none opacity-50" : ""
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}

                {selectedResources.size > 0 && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-green-800">
                      Selected {selectedResources.size} resource{selectedResources.size !== 1 ? "s" : ""} for this
                      release
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 5 && releases.length > 0 && (
          <div className="space-y-6">
            <Card>
              {/* <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Targeting</CardTitle>
                  <CardDescription>Control which users receive this release based on dimensions</CardDescription>
                </CardHeader> */}
              <CardContent className="space-y-6">
                {/* <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rollout">Rollout Percentage</Label>
                      <span className="text-sm font-medium">{rolloutPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      id="rollout"
                      min={0}
                      max={100}
                      step={5}
                      value={rolloutPercentage}
                      onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                  </div> */}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Targeting Rules</h4>
                      <p className="text-sm text-muted-foreground">Add rules to target specific user segments</p>
                    </div>
                    <Button variant="outline" onClick={() => addRule()}>
                      Add Rule
                    </Button>
                  </div>

                  {targetingRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="mx-auto h-8 w-8 mb-2" />
                      <p className="text-sm">No targeting rules set - release will go to all users</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {targetingRules.map((rule, idx) => {
                        return (
                          <Card key={idx} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label>Dimension</Label>
                                <Select
                                  value={rule.dimension}
                                  onValueChange={(v) => updateRule(idx, { dimension: v, values: "" })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select dimension" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dimensions.map((d) => (
                                      <SelectItem key={d.dimension} value={d.dimension}>
                                        {d.dimension}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Operator</Label>
                                <Select
                                  value={rule.operator}
                                  onValueChange={(v: any) => updateRule(idx, { operator: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="equals">Equals</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Value</Label>
                                <Input
                                  value={rule.values || ""}
                                  onChange={(e) => updateRule(idx, { values: e.target.value })}
                                />
                              </div>
                              <div className="flex items-end">
                                <Button variant="outline" onClick={() => removeRule(idx)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {currentStep == 5 && releases.length == 0 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Targeting</CardTitle>
                <CardDescription>
                  You are not allowed to target or stagger your first release, this is going to be your default release.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6"></CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases`}>
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
            <Button onClick={handleSubmit} disabled={!canProceedToStep(1)}>
              Create Release
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
