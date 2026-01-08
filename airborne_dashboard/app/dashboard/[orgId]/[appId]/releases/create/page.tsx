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
import {
  Search,
  Info,
  ChevronRight,
  Target,
  Check,
  PlugIcon as PkgIcon,
  FileText,
  Settings,
  Cog,
  Copy,
  Package,
  Plus,
} from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { hasAppAccess, parseFileRef } from "@/lib/utils";
import Link from "next/link";
import { toastWarning } from "@/hooks/use-toast";
import { ApiRelease } from "../page";
import useSWR from "swr";
import { BackendPropertiesResponse, SchemaField } from "@/types/remote-configs";
import {
  convertDottedToNestedObject,
  validateAllRemoteConfigValues,
  validateValueAgainstSchema,
} from "@/components/remote-config/utils/helpers";
import json from "highlight.js/lib/languages/json";
import hljs from "highlight.js";
import "highlight.js/styles/vs2015.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

hljs.registerLanguage("json", json);

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

type ReleaseConfigRequest = {
  config: {
    boot_timeout: number;
    release_config_timeout: number;
    properties: Record<string, any>;
  };
  package: {
    properties: Record<string, any>;
    important: string[];
    lazy: string[];
  };
  dimensions?: Record<string, string | string[]>;
  resources: string[];
  package_id?: string;
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

export default function CreateReleasePage() {
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
  const [pkgPage, setPkgPage] = useState(1);
  const pkgCount = 10;
  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePriority, setFilePriority] = useState<Record<string, "important" | "lazy">>({});
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>([]);
  const [dimensions, setDimensions] = useState<
    { dimension: string; values: string[]; type?: string; depends_on?: string }[]
  >([]);
  const [cohorts, setCohorts] = useState<Record<string, string[]>>({});
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [totalPackagesPage, setTotalPackagesPage] = useState(0);
  const [pkgLoading, setPkgLoading] = useState(true);

  // Resource-related state
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [resourceSearch, setResourceSearch] = useState("");
  const debouncedResourcesSearch = useDebouncedValue(resourceSearch, 500);
  const [resourceCurrentPage, setResourceCurrentPage] = useState(1);

  // File priorities pagination state
  const [filesCurrentPage, setFilesCurrentPage] = useState(1);
  const [filesSearch, setFilesSearch] = useState("");
  const debouncedFilesSearch = useDebouncedValue(filesSearch, 300);
  const filesPerPage = 10;

  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();

  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState<boolean>(false);
  const [releaseConfig, setReleaseConfig] = useState<ReleaseConfigRequest | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const perPage = 50;

  // Check if we're in clone mode and get the release ID
  const isClone = searchParams.get("clone") === "true";
  const cloneReleaseId = searchParams.get("releaseId");

  // Fetch the release data if we're cloning
  const { data: cloneReleaseData, isLoading: cloneReleaseLoading } = useSWR(
    isClone && cloneReleaseId && token && org && app ? ["/releases", cloneReleaseId, token, org, app] : null,
    ([, id, t, o, a]) => apiFetch<any>(`/releases/${encodeURIComponent(id)}`, {}, { token: t, org: o, app: a })
  );

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess]);

  // Initialize state from cloned release data
  useEffect(() => {
    if (isClone && cloneReleaseData && !cloneReleaseLoading) {
      try {
        const release = cloneReleaseData;

        // Initialize configuration
        setBootTimeout(release.config.boot_timeout || 4000);
        setReleaseConfigTimeout(release.config.release_config_timeout || 4000);

        // Initialize targeting rules from dimensions
        const targetingRules = Object.entries(release.dimensions || {}).map(([dimension, values]) => ({
          dimension,
          operator: "equals" as const,
          values: Array.isArray(values) ? values.join(",") : String(values),
        }));
        setTargetingRules(targetingRules);

        // Initialize remote config values
        if (release.config.properties && typeof release.config.properties === "object") {
          setRemoteConfigValues(release.config.properties);
        }

        // Initialize selected resources (using file paths)
        const resourceFilePaths = release.resources.map((resource: any) => resource.file_path);
        setSelectedResources(new Set(resourceFilePaths));

        // Initialize package properties
        if (release.package.properties) {
          setPropertiesJSON(JSON.stringify(release.package.properties, null, 2));
        }

        // Store package and file priority info for later use when packages are loaded
        sessionStorage.setItem(
          "clonePackageInfo",
          JSON.stringify({
            tag: release.package.tag,
            version: release.package.version,
            indexFilePath: release.package.index.file_path,
            filePriorities: {
              ...release.package.important.reduce((acc: any, file: any) => {
                acc[file.file_path] = "important";
                return acc;
              }, {}),
              ...release.package.lazy.reduce((acc: any, file: any) => {
                acc[file.file_path] = "lazy";
                return acc;
              }, {}),
            },
          })
        );
      } catch (error) {
        console.error("Failed to initialize clone data:", error);
        toastWarning("Clone Error", "Failed to load cloned release data");
      }
    }
  }, [isClone, cloneReleaseData, cloneReleaseLoading]);

  // Load cohorts for cloned targeting rules
  useEffect(() => {
    if (isClone && targetingRules.length > 0 && dimensions.length > 0) {
      // Load cohorts for any cohort dimensions in the targeting rules
      targetingRules.forEach(async (rule) => {
        if (rule.dimension) {
          const dimension = dimensions.find((d) => d.dimension === rule.dimension);
          if (dimension?.type === "cohort") {
            await loadCohortsForDimension(rule.dimension);
          }
        }
      });
    }
  }, [isClone, targetingRules, dimensions]);

  // Fetch schema for remote config
  const fetchSchema = async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      // Build dimensions header from targeting rules
      console.log("Targeting Rules", targetingRules);
      const dimensionsHeader = targetingRules
        .filter((rule) => rule.dimension && rule.values)
        .map((rule) => `${rule.dimension}=${rule.values}`)
        .join(";");

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

        // Check if we're in clone mode and already have remote config values
        const hasExistingValues = Object.keys(remoteConfigValues).length > 0;
        let shouldPreserveValues = false;
        let cloneConfigValues = {};

        if (isClone && hasExistingValues) {
          shouldPreserveValues = true;
          cloneConfigValues = remoteConfigValues;
        }

        if (shouldPreserveValues) {
          // Convert nested clone values to dotted key format
          const flattenObject = (obj: any, prefix = ""): Record<string, any> => {
            const flattened: Record<string, any> = {};

            Object.keys(obj).forEach((key) => {
              const value = obj[key];
              const newKey = prefix ? `${prefix}.${key}` : key;

              if (value && typeof value === "object" && !Array.isArray(value)) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey));
              } else {
                // Use the value directly
                flattened[newKey] = value;
              }
            });

            return flattened;
          };

          const flattenedCloneValues = flattenObject(cloneConfigValues);
          console.log("Clone mode: converted nested values to dotted keys:", flattenedCloneValues);
          setRemoteConfigValues(flattenedCloneValues);
        } else {
          // Initialize remote config values with default values
          const initialValues: Record<string, any> = {};
          const extractDefaults = (fields: SchemaField[], prefix = "") => {
            fields.forEach((field) => {
              const key = prefix ? `${prefix}.${field.name}` : field.name;
              if (field.children && field.children.length > 0) {
                extractDefaults(field.children, key);
              } else {
                initialValues[key] = field.defaultValue;
              }
            });
          };
          extractDefaults(convertedFields);
          setRemoteConfigValues(initialValues);
        }
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

  // Load schema when component mounts or when stepping to remote config or when targeting rules change
  useEffect(() => {
    if (currentStep === 3) {
      fetchSchema();
    }
  }, [currentStep, targetingRules, token, org, app]);

  // Load packages list
  useEffect(() => {
    if (!token || !org || !app) return;
    setPkgLoading(true);
    apiFetch<any>(
      "/packages/list",
      { query: { page: pkgPage, count: pkgCount, search: pkgSearch ? pkgSearch : undefined } },
      { token, org, app }
    )
      .then((res) => {
        const loadedPackages = res.data || [];
        setPackages(loadedPackages);
        setTotalPackagesPage(res.total_pages);

        // Handle package selection from clone data
        if (isClone) {
          try {
            const clonePackageInfoStr = sessionStorage.getItem("clonePackageInfo");
            if (clonePackageInfoStr) {
              const clonePackageInfo = JSON.parse(clonePackageInfoStr);
              const targetTag = clonePackageInfo.tag;
              const targetVersion = clonePackageInfo.version;

              // Extract tag from index file path as fallback if not directly available
              let fallbackTag: string | undefined;
              if (clonePackageInfo.indexFilePath) {
                try {
                  const parsed = parseFileRef(clonePackageInfo.indexFilePath);
                  fallbackTag = parsed.tag;
                } catch (error) {
                  console.error("Failed to extract tag from index file path:", error);
                }
              }

              // First try to find by tag and version (convert version to number if needed)
              console.log("Looking for package with tag:", targetTag, "version:", targetVersion);
              console.log(
                "Available packages:",
                loadedPackages.map((p: Pkg) => ({ tag: p.tag, version: p.version, versionType: typeof p.version }))
              );

              let matchingPackage: Pkg | undefined = loadedPackages.find(
                (pkg: Pkg) => pkg.tag === targetTag && Number(pkg.version) === Number(targetVersion)
              );

              // If not found and we have a fallback tag, try with that
              if (!matchingPackage && fallbackTag && fallbackTag !== targetTag) {
                matchingPackage = loadedPackages.find(
                  (pkg: Pkg) => pkg.tag === fallbackTag && Number(pkg.version) === Number(targetVersion)
                );
              }

              // If still not found, try to find by version only (convert to number for comparison)
              if (!matchingPackage) {
                matchingPackage = loadedPackages.find((pkg: Pkg) => Number(pkg.version) === Number(targetVersion));
              }

              if (matchingPackage) {
                console.log("Found matching package:", matchingPackage);
                setSelectedPackage(matchingPackage);
              } else {
                console.log("No matching package found");
              }
            }
          } catch (error) {
            console.error("Failed to select cloned package:", error);
          }
        }
      })
      .catch(() => setPackages([]))
      .finally(() => setPkgLoading(false));
  }, [token, org, app, searchParams, pkgCount, pkgPage, debouncedPackageSearch]);

  useEffect(() => {
    if (selectedPackage) {
      const pkgFiles = [];
      let clonedPriorities: Record<string, "important" | "lazy"> = {};

      // Extract cloned priorities if available
      if (isClone) {
        try {
          const clonePackageInfoStr = sessionStorage.getItem("clonePackageInfo");
          if (clonePackageInfoStr) {
            const clonePackageInfo = JSON.parse(clonePackageInfoStr);
            clonedPriorities = clonePackageInfo.filePriorities || {};
          }
        } catch (error) {
          console.error("Failed to parse cloned priorities:", error);
        }
      }

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

        // Use cloned priority if available, otherwise default to important
        const priority = clonedPriorities[file_parsed.filePath] || "important";
        newPriorities[file] = priority;
      }

      // Set the new priorities, replacing any existing ones
      setFilePriority(newPriorities);
      setFiles(pkgFiles);
    }
  }, [selectedPackage, isClone]);

  // Load dimensions options
  useEffect(() => {
    if (!token || !org || !app) return;
    apiFetch<any>("/organisations/applications/dimension/list", {}, { token, org, app })
      .then((res) => {
        const data = (res.data || []) as any[];

        const dims: any = data.map((d) => ({
          dimension: d.dimension,
          values: Object.values((d.schema?.properties || {}).value?.enum || d.values || []),
          type: d.dimension_type,
          depends_on: d.depends_on,
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
    token && org && app && currentStep === 6 ? ["/file/list", debouncedResourcesSearch, resourceCurrentPage] : null,
    async () =>
      apiFetch<ApiResponse>(
        "/file/list",
        { method: "GET", query: { search: resourceSearch || undefined, page: resourceCurrentPage, per_page: perPage } },
        { token, org, app }
      )
  );

  const { data } = useSWR(token && org && app ? ["/releases/list"] : null, async () =>
    apiFetch<any>("/releases/list", { query: { page: 1, count: 1 } }, { token, org, app })
  );
  const releases: ApiRelease[] = data?.data || [];

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

  // Convert cloned resource file paths to resource IDs when resources are loaded
  useEffect(() => {
    if (isClone && allResources.length > 0) {
      // Check if we have file paths in selectedResources that need to be converted to IDs
      const currentSelection = Array.from(selectedResources);
      if (currentSelection.length > 0) {
        // Check if any of the current selections are file paths (not found in resource IDs)
        const resourceIds = new Set(allResources.map((r) => r.id));
        const hasFilePaths = currentSelection.some((id) => !resourceIds.has(id));

        if (hasFilePaths) {
          // Convert file paths to resource IDs
          const newResourceIds = new Set<string>();

          currentSelection.forEach((filePath: string) => {
            const matchingResource = allResources.find((resource) => resource.file_path === filePath);
            if (matchingResource) {
              newResourceIds.add(matchingResource.id);
            }
          });

          if (newResourceIds.size > 0) {
            setSelectedResources(newResourceIds);
          }
        }
      }
    }
  }, [isClone, allResources, selectedResources]);

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

  // Load cohorts for a specific dimension
  const loadCohortsForDimension = async (dimensionName: string) => {
    if (!token || !org || !app) return;

    try {
      const result = await apiFetch<{ enum: string[]; definitions?: any }>(
        `/organisations/applications/dimension/${encodeURIComponent(dimensionName)}/cohort`,
        {},
        { token, org, app }
      );
      console.log("Cohorts API response:", result);
      setCohorts((prev) => ({
        ...prev,
        [dimensionName]: result.enum || [],
      }));
    } catch (error) {
      console.error("Failed to load cohorts:", error);
      setCohorts((prev) => ({
        ...prev,
        [dimensionName]: [],
      }));
    }
  };

  const addRule = () => setTargetingRules((r) => [...r, { dimension: "", operator: "equals", values: "" }]);
  const removeRule = (i: number) => setTargetingRules((r) => r.filter((_, idx) => idx !== i));
  const updateRule = (i: number, patch: Partial<TargetingRule>) =>
    setTargetingRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return true; // Configuration step - always can proceed
      case 2:
        return true; // Targeting step - always can proceed
      case 3:
        // Remote config step - validate all fields
        if (schemaFields.length > 0) {
          const validation = validateAllRemoteConfigValues(remoteConfigValues, schemaFields);
          return validation.isValid;
        }
        return true; // No schema means no validation needed
      case 4:
        return selectedPackage !== null;
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

  const createReleaseConfig = (): ReleaseConfigRequest | undefined => {
    let properties: Record<string, any> = {};
    try {
      properties = propertiesJSON.trim() ? JSON.parse(propertiesJSON) : {};
    } catch {
      toastWarning("Invalid JSON", "Package properties must be valid JSON");
      return undefined;
    }

    const configProps: Record<string, any> = { ...remoteConfigValues };

    const dimensionsObj: Record<string, any> = {};
    targetingRules.forEach((r) => {
      if (!r.dimension || r.values.length === 0) return;
      dimensionsObj[r.dimension] = r.values.length === 1 ? r.values[0] : r.values;
    });

    const body: ReleaseConfigRequest = {
      config: {
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

    return body;
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

  const handleSubmit = async (release_config: ReleaseConfigRequest) => {
    try {
      await apiFetch("/releases", { method: "POST", body: release_config }, { token, org, app });
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases`);
    } catch (e: any) {
      console.log("Release creation fail", e);
      // Error toast will be shown automatically by apiFetch
    }
  };

  const isCloneMode = isClone;

  // Show loading state when cloning and waiting for release data
  if (isClone && cloneReleaseLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block h-8 w-8 border-4 border-current border-t-transparent text-muted-foreground rounded-full mb-4" />
          <p className="text-muted-foreground">Loading release data for cloning...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex-1">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Create Release</h1>
        <p className="text-muted-foreground mt-2">Step-by-step: configure, remote config, package, files, targeting</p>

        {isCloneMode && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
            <Copy className="h-4 w-4 text-amber-600" />
            <div className="text-sm text-amber-800">
              You&apos;re creating a release based on a cloned configuration. All settings have been pre-populated from
              the original release.
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mt-6">
          {[
            { number: 1, title: "Configure", icon: Settings },
            { number: 2, title: "Targeting", icon: Target },
            { number: 3, title: "Remote Config", icon: Cog },
            { number: 4, title: "Package & Details", icon: PkgIcon },
            { number: 5, title: "File Priorities", icon: Info },
            { number: 6, title: "Resources", icon: FileText },
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
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Targeting Rules</h4>
                      <p className="text-sm text-muted-foreground">Add rules to target specific user segments</p>
                    </div>
                    {releases.length > 0 && (
                      <Button variant="outline" onClick={() => addRule()}>
                        Add Rule
                      </Button>
                    )}
                  </div>

                  {targetingRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="mx-auto h-8 w-8 mb-2" />
                      {releases.length > 0 && (
                        <p className="text-sm">No targeting rules set - release will go to all users</p>
                      )}
                      {releases.length == 0 && (
                        <p className="text-sm">You can&lsquo;t target your first release. It goes to all users.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {targetingRules.map((rule, idx) => {
                        const selectedDim = dimensions.find((d) => d.dimension === rule.dimension);
                        const isCohortDimension = selectedDim?.type === "cohort";
                        const cohortOptions = isCohortDimension ? cohorts[rule.dimension] || [] : [];

                        return (
                          <Card key={idx} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label>Dimension</Label>
                                <Select
                                  value={rule.dimension}
                                  onValueChange={async (v) => {
                                    updateRule(idx, { dimension: v, values: "" });
                                    const dim = dimensions.find((d) => d.dimension === v);
                                    if (dim?.type === "cohort") {
                                      await loadCohortsForDimension(v);
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select dimension" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dimensions.map((d) => (
                                      <SelectItem key={d.dimension} value={d.dimension}>
                                        <div className="flex items-center gap-2">
                                          {d.dimension}
                                          {d.type === "cohort" && (
                                            <Badge variant="secondary" className="text-xs">
                                              Cohort
                                            </Badge>
                                          )}
                                        </div>
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
                                <Label>{isCohortDimension ? "Cohort" : "Value"}</Label>
                                {isCohortDimension ? (
                                  <Select
                                    value={rule.values || ""}
                                    onValueChange={(v) => updateRule(idx, { values: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select cohort" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {cohortOptions && cohortOptions.length > 0 ? (
                                        cohortOptions.map((cohort) => (
                                          <SelectItem key={cohort} value={cohort}>
                                            {cohort}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem disabled value="__loading__">
                                          {isCohortDimension ? "No cohorts available" : "Loading cohorts..."}
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    value={rule.values || ""}
                                    onChange={(e) => updateRule(idx, { values: e.target.value })}
                                    placeholder={selectedDim ? "Enter value" : "Select dimension first"}
                                  />
                                )}
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

        {currentStep === 3 && (
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
                        {targetingRules.length > 0 && (
                          <span className="block mt-1 text-xs">
                            Schema loaded with targeting dimensions:{" "}
                            {targetingRules
                              .map((rule) => rule.dimension)
                              .filter(Boolean)
                              .join(", ")}
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

        {currentStep === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Version</CardTitle>
                <CardDescription>Choose an existing package to base this release on (optional)</CardDescription>
                {isCloneMode && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <div className="text-sm text-blue-800">
                      The original release used package version{" "}
                      {(() => {
                        try {
                          const clonePackageInfoStr = sessionStorage.getItem("clonePackageInfo");
                          if (clonePackageInfoStr) {
                            const clonePackageInfo = JSON.parse(clonePackageInfoStr);
                            return clonePackageInfo.version;
                          }
                        } catch (error) {
                          console.error("Error reading clone package info:", error);
                        }
                        return "unknown";
                      })()}{" "}
                      - it should be automatically selected if available.
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
                {pkgLoading ? (
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
                          href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages/create`}
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
                              <Badge variant="outline">{p.tag}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{p.index}</TableCell>
                            <TableCell className="text-muted-foreground">{p.files.length}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {totalPackagesPage > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (pkgPage > 1) setPkgPage(pkgPage - 1);
                            }}
                            className={pkgPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>

                        {renderPaginationItems(pkgPage, totalPackagesPage, setPkgPage)}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (pkgPage < totalPackagesPage) setPkgPage(pkgPage + 1);
                            }}
                            className={pkgPage >= totalPackagesPage ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

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

        {currentStep === 5 && (
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

        {currentStep === 6 && (
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
            <Button
              onClick={() => {
                const config = createReleaseConfig();
                if (config) {
                  setReleaseConfig(config);
                  setIsConfirmationDialogOpen(true);
                }
              }}
              disabled={!canProceedToStep(1)}
            >
              Create Release
            </Button>
          )}
        </div>
      </div>
      {isConfirmationDialogOpen && releaseConfig && (
        <Dialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
          <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-6xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Confirm Release</DialogTitle>
              <DialogDescription>Please confirm the details below before creating the release.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4 overflow-y-auto max-h-[calc(80vh-200px)]">
              <div>
                <span className="font-semibold">Organization:</span> {org}
              </div>
              <div>
                <span className="font-semibold">Application:</span> {app}
              </div>
              <div>
                <span className="font-semibold">Release Config:</span>
                <div className="mt-2 max-h-48 md:max-h-64 lg:max-h-80 overflow-x-auto overflow-y-auto rounded-md border border-gray-200">
                  <pre className="whitespace-pre p-4 text-sm md:text-base">
                    <code
                      className="language-json"
                      dangerouslySetInnerHTML={{
                        __html: hljs.highlight(
                          JSON.stringify(
                            {
                              ...releaseConfig,
                              package: {
                                ...(selectedPackage?.index && { index: selectedPackage.index }),
                                ...releaseConfig.package,
                              },
                            },
                            null,
                            2
                          ),
                          { language: "json" }
                        ).value,
                      }}
                    />
                  </pre>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsConfirmationDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  handleSubmit(releaseConfig);
                  setIsConfirmationDialogOpen(false);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
