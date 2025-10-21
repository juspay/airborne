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
import { Search, Info, ChevronRight, Target, Check, PlugIcon as PkgIcon, FileText, Settings, Cog } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { notFound, useParams, useRouter } from "next/navigation";
import { hasAppAccess, parseFileRef } from "@/lib/utils";
import Link from "next/link";
import { toastWarning } from "@/hooks/use-toast";
import useSWR from "swr";
import { ReleasePayload } from "../page";
import { BackendPropertiesResponse, SchemaField } from "@/types/remote-configs";
import {
  convertDottedToNestedObject,
  validateAllRemoteConfigValues,
  validateValueAgainstSchema,
} from "@/components/remote-config/utils/helpers";
import json from "highlight.js/lib/languages/json";
import hljs from "highlight.js";
import "highlight.js/styles/vs2015.css";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

hljs.registerLanguage("json", json);

type Pkg = { index: string; tag: string; version: number; files: string[] };
type FileItem = { id: string; file_path: string; version?: number; tag?: string; size?: number };
type ResourceFile = {
  id: string;
  file_path: string;
  size?: number;
  created_at?: string;
  tag: string;
  checksum: string;
};

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

const convertBackendDataToFields = (data: BackendPropertiesResponse): SchemaField[] => {
  const fields: SchemaField[] = [];

  Object.entries(data.properties).forEach(([key, node]) => {
    fields.push({
      id: key,
      name: key,
      type: node.schema?.type || "string",
      required: false,
      description: node.description || "",
      enumValues: node.schema?.enum || undefined,
      defaultValue: node.default_value,
    });
  });

  return fields;
};

export default function EditReleasePage() {
  // Helper function to convert nested object to dotted keys
  const convertNestedToDottedKeys = (obj: Record<string, any>, prefix = ""): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, convertNestedToDottedKeys(value, newKey));
      } else {
        // Keep the value as is for primitives and arrays
        result[newKey] = value;
      }
    }

    return result;
  };

  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const params = useParams();
  const releaseId = params.releaseId as string;
  const { data } = useSWR(["/releases", releaseId, token, org, app], ([, id, t, o, a]) =>
    apiFetch<any>(`/releases/${encodeURIComponent(id)}`, {}, { token: t, org: o, app: a })
  );
  const release: ReleasePayload = data;

  const totalSteps = 6;
  const [currentStep, setCurrentStep] = useState(1);

  // Configuration state
  const [bootTimeout, setBootTimeout] = useState<number>(4000);
  const [releaseConfigTimeout, setReleaseConfigTimeout] = useState<number>(4000);
  const [configProperties, setConfigProperties] = useState<string>("{}");

  // Remote config state
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [remoteConfigValues, setRemoteConfigValues] = useState<Record<string, any>>({});
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [propertiesJSON, setPropertiesJSON] = useState<string>("{}");

  const [pkgSearch, setPkgSearch] = useState("");
  const debouncedPackageSearch = useDebouncedValue(pkgSearch, 500);
  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePriority, setFilePriority] = useState<Record<string, "important" | "lazy">>({});
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>([]);
  const [rolloutPercentage] = useState(100);
  const [packages, setPackages] = useState<Pkg[]>([]);

  // Resource-related state
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [resourceSearch, setResourceSearch] = useState("");
  const debouncedResourceSearch = useDebouncedValue(resourceSearch, 500);
  const [resourceCurrentPage, setResourceCurrentPage] = useState(1);

  const [filesCurrentPage, setFilesCurrentPage] = useState(1);
  const [filesSearch, setFilesSearch] = useState("");
  const debouncedFilesSearch = useDebouncedValue(filesSearch, 300);
  const filesPerPage = 10;

  const router = useRouter();
  const perPage = 50;

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess]);

  // Fetch schema for remote config
  const fetchSchema = async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      // Build dimensions header from existing release dimensions
      const dimensionsHeader = release?.dimensions
        ? Object.entries(release.dimensions)
            .map(([key, value]) => `${key}=${value}`)
            .join(";")
        : "";

      const headers: Record<string, string> = {};
      if (dimensionsHeader) {
        headers["x-dimension"] = dimensionsHeader;
      }

      const data = await apiFetch<BackendPropertiesResponse>(
        `/organisations/applications/properties/schema`,
        {
          method: "GET",
          headers,
        },
        { token, org, app }
      );

      if (data && data.properties && Object.keys(data.properties).length > 0) {
        const convertedFields = convertBackendDataToFields(data);
        setSchemaFields(convertedFields);

        // Initialize remote config values with existing values from release or default values
        const initialValues: Record<string, any> = {};

        // First, load existing values from release if available (convert from nested to dotted format)
        if (release?.config && (release.config as any).properties) {
          const existingDottedValues = convertNestedToDottedKeys((release.config as any).properties);
          Object.assign(initialValues, existingDottedValues);
        }

        // Then fill in any missing default values from schema
        const extractDefaults = (fields: SchemaField[], prefix = "") => {
          fields.forEach((field) => {
            const key = prefix ? `${prefix}.${field.name}` : field.name;
            if (field.children && field.children.length > 0) {
              extractDefaults(field.children, key);
            } else {
              // Only set default if no existing value
              if (initialValues[key] === undefined && field.defaultValue !== undefined) {
                initialValues[key] = field.defaultValue;
              }
            }
          });
        };
        extractDefaults(convertedFields);
        setRemoteConfigValues(initialValues);
      } else {
        setSchemaFields([]);
        setRemoteConfigValues({});
      }
    } catch (error) {
      console.error("Error fetching schema:", error);
      setSchemaError("Failed to load remote config schema");
      setSchemaFields([]);
      setRemoteConfigValues({});
    } finally {
      setSchemaLoading(false);
    }
  };

  // Load schema when component mounts or when stepping to remote config
  useEffect(() => {
    if (currentStep === 2) {
      fetchSchema();
    }
  }, [currentStep, token, org, app, release]);

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
    if (!selectedPackage || !release) return;

    const pkgFiles: FileItem[] = [];
    const newPriorities: Record<string, "important" | "lazy"> = {};

    // Build file list from selected package
    for (const file of selectedPackage.files) {
      const file_parsed = parseFileRef(file);
      pkgFiles.push({
        id: file,
        file_path: file_parsed.filePath,
        version: file_parsed.version,
        tag: file_parsed.tag,
      });
      if (selectedPackage.version == release.package.version) {
        if (release.package.important.some((f) => f.file_path === file_parsed.filePath)) {
          newPriorities[file] = "important";
        } else if (release.package.lazy.some((f) => f.file_path === file_parsed.filePath)) {
          newPriorities[file] = "lazy";
        } else {
          newPriorities[file] = "important"; // fallback
        }
      } else {
        // Different package: default all files to important
        newPriorities[file] = "important";
      }
    }

    setFiles(pkgFiles);
    setFilePriority(newPriorities);
  }, [selectedPackage]);

  useEffect(() => {
    if (packages.length > 0 && release) {
      setSelectedPackage(packages.find((pkg) => release.package.version == pkg.version) || null);
    }
  }, [packages, release]);

  // Load all resources/files with pagination
  const {
    data: resourceData,
    error: resourceError,
    isLoading: resourceLoading,
  } = useSWR(
    token && org && app && currentStep === 5 ? ["/file/list", debouncedResourceSearch, resourceCurrentPage] : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        { method: "GET", query: { search: resourceSearch || undefined, page: resourceCurrentPage, per_page: perPage } },
        { token, org, app }
      )
  );

  const filteredPackages = useMemo(
    () => packages.filter((p) => (p.index || "").toLowerCase().includes(pkgSearch.toLowerCase())),
    [packages, debouncedPackageSearch]
  );

  // Calculate filtered and paginated files for step 5
  const filteredFiles = useMemo(
    () => files.filter((f) => f.file_path.toLowerCase().includes(filesSearch.toLowerCase())),
    [files, debouncedFilesSearch]
  );

  const filesTotalPages = Math.ceil(filteredFiles.length / filesPerPage);
  const paginatedFiles = useMemo(
    () => filteredFiles.slice((filesCurrentPage - 1) * filesPerPage, filesCurrentPage * filesPerPage),
    [filteredFiles, filesCurrentPage, filesPerPage]
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
    [allResources, selectedPackage]
  );

  const importantFiles = Object.entries(filePriority)
    .filter(([, v]) => v === "important")
    .map(([k]) => k);
  const lazyFiles = Object.entries(filePriority)
    .filter(([, v]) => v === "lazy")
    .map(([k]) => k);

  useEffect(() => {
    if (release) {
      if (release?.config?.boot_timeout !== undefined) {
        setBootTimeout(release.config.boot_timeout);
      }
      if (release?.config?.release_config_timeout !== undefined) {
        setReleaseConfigTimeout(release.config.release_config_timeout);
      }
      if (release?.dimensions) {
        const rules: TargetingRule[] = Object.entries(release.dimensions).map(([key, value]) => ({
          dimension: key,
          operator: "equals",
          values: `${value}`,
        }));
        setTargetingRules(rules);
      }
      // Load existing config properties if available
      if ((release.config as any)?.properties) {
        // Convert nested properties to dotted keys for the UI
        const existingConfigValues = convertNestedToDottedKeys((release.config as any).properties);
        setRemoteConfigValues(existingConfigValues);
      }
    }
  }, [release]);

  useEffect(() => {
    if (availableResources.length > 0) {
      const selected = new Set<string>();

      release.resources.forEach((res) => {
        const match = availableResources.find((ar) => ar.file_path === res.file_path && ar.checksum === res.checksum);
        if (match) {
          selected.add(match.id);
        }
      });
      setSelectedResources(selected);
    }
  }, [availableResources]);

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return true; // Configuration step - always can proceed
      case 2:
        // Remote config step - validate all fields
        if (schemaFields.length > 0) {
          const validation = validateAllRemoteConfigValues(remoteConfigValues, schemaFields);
          return validation.isValid;
        }
        return true; // No schema means no validation needed
      case 3:
        return selectedPackage !== null;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleResourceSearchChange = (value: string) => {
    setResourceSearch(value);
    setResourceCurrentPage(1); // Reset to first page when searching
  };

  const handleFilesSearchChange = (value: string) => {
    setFilesSearch(value);
    setFilesCurrentPage(1); // Reset to first page when searching
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

  const renderRemoteConfigField = (field: SchemaField, path: string = "") => {
    const fieldPath = path ? `${path}.${field.name}` : field.name;
    const currentValue = remoteConfigValues[fieldPath];

    const updateFieldValue = (value: any) => {
      setRemoteConfigValues((prev) => ({
        ...prev,
        [fieldPath]: value,
      }));
    };

    const validateField = (value: any) => {
      const schema = {
        type: field.type,
        minLength: field.minLength,
        maxLength: field.maxLength,
        minimum: field.minValue,
        maximum: field.maxValue,
        pattern: field.pattern,
        enum: field.enumValues,
      };
      return validateValueAgainstSchema(value, schema);
    };

    const validation = validateField(currentValue);

    // For complex types, use string representation for input
    const getInputValue = () => {
      if (field.type === "array" || field.type === "object") {
        if (currentValue === undefined || currentValue === null) {
          return "";
        }
        return typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue, null, 2);
      }
      return currentValue || "";
    };

    const handleComplexValueChange = (inputValue: string) => {
      if (!inputValue.trim()) {
        updateFieldValue(field.type === "array" ? [] : field.type === "object" ? {} : undefined);
        return;
      }

      try {
        const parsed = JSON.parse(inputValue);
        // Validate that the parsed value matches the expected type
        if (field.type === "array" && Array.isArray(parsed)) {
          updateFieldValue(parsed);
        } else if (field.type === "object" && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          updateFieldValue(parsed);
        } else {
          // Invalid type, keep as string for now (will show validation error)
          updateFieldValue(inputValue);
        }
      } catch {
        // Invalid JSON, keep as string (will show validation error)
        updateFieldValue(inputValue);
      }
    };

    if (field.children && field.children.length > 0) {
      return (
        <Card key={field.id} className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">{field.name}</CardTitle>
            {field.description && <CardDescription className="text-sm">{field.description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {field.children.map((childField) => renderRemoteConfigField(childField, fieldPath))}
          </CardContent>
        </Card>
      );
    }

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={fieldPath}>
          {field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {field.type === "string" && field.enumValues && field.enumValues.length > 0 ? (
          <Select value={currentValue || ""} onValueChange={(value) => updateFieldValue(value)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.name}`} />
            </SelectTrigger>
            <SelectContent>
              {field.enumValues.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "boolean" ? (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={fieldPath}
              checked={currentValue === true}
              onCheckedChange={(checked) => updateFieldValue(checked === true)}
            />
            <Label htmlFor={fieldPath} className="text-sm font-normal">
              Enable {field.name}
            </Label>
          </div>
        ) : field.type === "number" ? (
          <Input
            id={fieldPath}
            type="number"
            value={currentValue || ""}
            onChange={(e) => updateFieldValue(e.target.value ? Number(e.target.value) : "")}
            placeholder={field.defaultValue?.toString() || "Enter number"}
            min={field.minValue}
            max={field.maxValue}
          />
        ) : field.type === "array" || field.type === "object" ? (
          <div className="space-y-2">
            <Textarea
              id={fieldPath}
              value={getInputValue()}
              onChange={(e) => handleComplexValueChange(e.target.value)}
              placeholder={field.type === "array" ? "[]" : "{}"}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter valid JSON for {field.type === "array" ? "array" : "object"} type
              {field.defaultValue && ` • Default: ${JSON.stringify(field.defaultValue)}`}
            </p>
          </div>
        ) : (
          <Input
            id={fieldPath}
            type="text"
            value={currentValue || ""}
            onChange={(e) => updateFieldValue(e.target.value)}
            placeholder={field.defaultValue?.toString() || `Enter ${field.name}`}
            minLength={field.minLength}
            maxLength={field.maxLength}
            pattern={field.pattern}
          />
        )}

        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}

        {!validation.isValid && (
          <div className="text-sm text-red-600">
            {validation.errors.map((error, idx) => (
              <div key={idx}>{error}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = async () => {
    let properties: Record<string, any> = {};
    try {
      properties = propertiesJSON.trim() ? JSON.parse(propertiesJSON) : {};
    } catch {
      toastWarning("Invalid JSON", "Package properties must be valid JSON");
      return;
    }

    // Convert remote config values to dotted keys format for backend
    const configProps: Record<string, any> = convertNestedToDottedKeys(remoteConfigValues);

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
      await apiFetch(`/releases/${releaseId}`, { method: "PUT", body }, { token, org, app });
      router.push(
        `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(releaseId)}`
      );
    } catch (e: any) {
      console.log("Release creation fail", e);
      // Error toast will be shown automatically by apiFetch
    }
  };

  return (
    <div className="p-6">
      <div className="flex-1">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Update Release</h1>
        <p className="text-muted-foreground mt-2">Step-by-step: configure, remote config, package, files, targeting</p>

        <div className="flex items-center gap-4 mt-6">
          {[
            { number: 1, title: "Configure", icon: Settings },
            { number: 2, title: "Remote Config", icon: Cog },
            { number: 3, title: "Package & Details", icon: PkgIcon },
            { number: 4, title: "Package File Priorities", icon: Info },
            { number: 5, title: "Resources", icon: FileText },
            { number: 6, title: "Targeting", icon: Target },
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
                {index < 5 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
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
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Remote Configuration</CardTitle>
                <CardDescription>Configure values for your remote configuration schema</CardDescription>
              </CardHeader>
              <CardContent>
                {schemaLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin inline-block h-8 w-8 border-4 border-current border-t-transparent text-muted-foreground rounded-full mb-4" />
                    <p className="text-muted-foreground">Loading schema...</p>
                  </div>
                ) : schemaError ? (
                  <div className="text-center py-8">
                    <div className="text-red-600 mb-4">{schemaError}</div>
                    <Button onClick={fetchSchema} variant="outline">
                      Retry
                    </Button>
                  </div>
                ) : schemaFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Cog className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm mb-4">No remote configuration schema found</p>
                    <p className="text-xs">
                      Configure your remote config schema first to add configuration values for this release.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Info className="h-4 w-4 text-blue-600" />
                      <div className="text-sm text-blue-800">
                        Configure the values for your remote configuration. These will be applied when this release is
                        deployed.
                        {release?.dimensions && Object.keys(release.dimensions).length > 0 && (
                          <span className="block mt-1 text-xs">
                            Schema loaded with targeting dimensions: {Object.keys(release.dimensions).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {schemaFields.map((field) => renderRemoteConfigField(field))}

                    <div className="mt-6 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Preview (JSON)</h4>
                      <pre className="hljs text-xs p-3 rounded border overflow-auto max-h-48">
                        <code
                          className="language-json"
                          dangerouslySetInnerHTML={{
                            __html: hljs.highlight(
                              JSON.stringify(convertDottedToNestedObject(remoteConfigValues), null, 2),
                              { language: "json" }
                            ).value,
                          }}
                        />
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 3 && (
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

        {currentStep === 4 && (
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
                {files.length > 0 && (
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search files..."
                        value={filesSearch}
                        onChange={(e) => handleFilesSearchChange(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                )}
                {files.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm">No files available.</p>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm">No files found matching your search.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min(filesPerPage, filteredFiles.length)} of {filteredFiles.length} files
                      {filesCurrentPage > 1 && ` (page ${filesCurrentPage})`}
                      {filesSearch && ` matching "${filesSearch}"`}
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
                        {paginatedFiles.map((f) => {
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
                    {/* Files Pagination */}
                    {filesTotalPages > 1 && (
                      <div className="mt-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (filesCurrentPage > 1) setFilesCurrentPage(filesCurrentPage - 1);
                                }}
                                className={filesCurrentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>

                            {renderPaginationItems(filesCurrentPage, filesTotalPages, setFilesCurrentPage)}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (filesCurrentPage < filesTotalPages) setFilesCurrentPage(filesCurrentPage + 1);
                                }}
                                className={filesCurrentPage >= filesTotalPages ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 5 && (
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

        {currentStep === 6 && (
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
                      <p className="text-sm text-muted-foreground">Rules applied to target specific user segments</p>
                    </div>
                  </div>

                  {targetingRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="mx-auto h-8 w-8 mb-2" />
                      <p className="text-sm">No targeting rules set - release will go to all users</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {targetingRules.map((rule, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label>Dimension</Label>
                              <p className="text-muted-foreground">{rule.dimension}</p>
                            </div>

                            <div className="space-y-2">
                              <Label>Operator</Label>
                              <p className="text-muted-foreground">{rule.operator}</p>
                            </div>

                            <div className="space-y-2">
                              <Label>Value</Label>
                              <p className="text-muted-foreground">{rule.values}</p>
                            </div>

                            {/* Remove action buttons */}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link
              href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(releaseId)}`}
            >
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
              Update Release
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
