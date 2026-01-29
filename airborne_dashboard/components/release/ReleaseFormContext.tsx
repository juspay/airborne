"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import useSWR from "swr";
import {
  ReleaseFormContextType,
  ReleaseFormState,
  ReleaseMode,
  TargetingRule,
  Dimension,
  Pkg,
  FileItem,
  ReleaseConfigRequest,
  ApiReleaseData,
} from "@/types/release";
import { SchemaField, BackendPropertiesResponse } from "@/types/remote-configs";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { toastWarning } from "@/hooks/use-toast";
import { validateAllRemoteConfigValues } from "@/components/remote-config/utils/helpers";

const defaultState: ReleaseFormState = {
  mode: "create",
  releaseId: undefined,
  initialPackageInfo: null,
  initialResourceFilePaths: [],
  hasExistingReleases: false,
  currentStep: 1,
  totalSteps: 6,
  bootTimeout: 4000,
  releaseConfigTimeout: 4000,
  configProperties: "{}",
  targetingRules: [],
  dimensions: [],
  cohorts: {},
  schemaFields: [],
  remoteConfigValues: {},
  schemaLoading: false,
  schemaError: null,
  selectedPackage: null,
  packages: [],
  packagesLoading: false,
  pkgSearch: "",
  pkgPage: 1,
  totalPackagesPage: 0,
  propertiesJSON: "{}",
  files: [],
  filePriority: {},
  filesSearch: "",
  filesCurrentPage: 1,
  selectedResources: new Set<string>(),
  resourceSearch: "",
  resourceCurrentPage: 1,
};

const ReleaseFormContext = createContext<ReleaseFormContextType | undefined>(undefined);

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

interface ReleaseFormProviderProps {
  children: ReactNode;
  mode: ReleaseMode;
  releaseId?: string;
  initialData?: ApiReleaseData;
}

export function ReleaseFormProvider({ children, mode, releaseId, initialData }: ReleaseFormProviderProps) {
  const { token, org, app } = useAppContext();

  const getInitialState = (): ReleaseFormState => {
    const state = { ...defaultState, mode, releaseId };

    if (initialData) {
      state.bootTimeout = initialData.config.boot_timeout || 4000;
      state.releaseConfigTimeout = initialData.config.release_config_timeout || 4000;

      state.targetingRules = Object.entries(initialData.dimensions || {}).map(([dimension, values]) => ({
        dimension,
        operator: "equals" as const,
        values: Array.isArray(values) ? values.join(",") : String(values),
      }));

      if (initialData.config.properties && typeof initialData.config.properties === "object") {
        state.remoteConfigValues = initialData.config.properties;
      }

      // Store initial resource file paths for later matching with actual file IDs
      // We don't pre-populate selectedResources here because the file list API returns
      // resources with IDs (including version), and we need to match them when resources load
      state.initialResourceFilePaths = initialData.resources.map((resource) => resource.file_path);

      if (initialData.package.properties) {
        state.propertiesJSON = JSON.stringify(initialData.package.properties, null, 2);
      }

      state.initialPackageInfo = {
        tag: initialData.package.tag,
        version: initialData.package.version,
        indexFilePath: initialData.package.index.file_path,
        filePriorities: {
          ...initialData.package.important.reduce((acc: Record<string, "important" | "lazy">, file: any) => {
            acc[file.file_path] = "important";
            return acc;
          }, {}),
          ...initialData.package.lazy.reduce((acc: Record<string, "important" | "lazy">, file: any) => {
            acc[file.file_path] = "lazy";
            return acc;
          }, {}),
        },
      };
    }

    return state;
  };

  const initialState = useMemo(() => getInitialState(), []);

  const [currentStep, setCurrentStep] = useState(initialState.currentStep);
  const [bootTimeout, setBootTimeout] = useState(initialState.bootTimeout);
  const [releaseConfigTimeout, setReleaseConfigTimeout] = useState(initialState.releaseConfigTimeout);
  const [configProperties, setConfigProperties] = useState(initialState.configProperties);
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>(initialState.targetingRules);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [cohorts, setCohorts] = useState<Record<string, string[]>>({});
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [remoteConfigValues, setRemoteConfigValues] = useState<Record<string, any>>(initialState.remoteConfigValues);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [pkgSearch, setPkgSearch] = useState("");
  const [pkgPage, setPkgPage] = useState(1);
  const [totalPackagesPage, setTotalPackagesPage] = useState(0);
  const [propertiesJSON, setPropertiesJSON] = useState(initialState.propertiesJSON);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePriority, setFilePriority] = useState<Record<string, "important" | "lazy">>({});
  const [filesSearch, setFilesSearch] = useState("");
  const [filesCurrentPage, setFilesCurrentPage] = useState(1);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(initialState.selectedResources);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceCurrentPage, setResourceCurrentPage] = useState(1);

  // Store initial package info and resource file paths (memoized, won't change after mount)
  const initialPackageInfo = initialState.initialPackageInfo;
  const initialResourceFilePaths = initialState.initialResourceFilePaths;

  const { data: releasesData } = useSWR(
    token && org && app ? ["/releases/list", app, "release-form-context"] : null,
    async () => apiFetch<any>("/releases/list", { query: { page: 1, count: 1 } }, { token, org, app })
  );
  const hasExistingReleases = (releasesData?.data?.length || 0) > 0;

  const goToNextStep = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, defaultState.totalSteps));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const addTargetingRule = useCallback(() => {
    setTargetingRules((r) => [...r, { dimension: "", operator: "equals", values: "" }]);
  }, []);

  const removeTargetingRule = useCallback((index: number) => {
    setTargetingRules((r) => r.filter((_, idx) => idx !== index));
  }, []);

  const updateTargetingRule = useCallback((index: number, patch: Partial<TargetingRule>) => {
    setTargetingRules((r) => r.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)));
  }, []);

  const loadCohortsForDimension = useCallback(
    async (dimensionName: string) => {
      if (!token || !org || !app) return;

      try {
        const result = await apiFetch<{ enum: string[]; definitions?: any }>(
          `/organisations/applications/dimension/${encodeURIComponent(dimensionName)}/cohort`,
          {},
          { token, org, app }
        );
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
    },
    [token, org, app]
  );

  const updateRemoteConfigValue = useCallback((fieldPath: string, value: any) => {
    setRemoteConfigValues((prev) => ({
      ...prev,
      [fieldPath]: value,
    }));
  }, []);

  const fetchSchema = useCallback(async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
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

        const hasExistingValues = Object.keys(remoteConfigValues).length > 0;
        const shouldPreserveValues = (mode === "clone" || mode === "edit") && hasExistingValues;

        if (shouldPreserveValues) {
          const flattenObject = (obj: any, prefix = ""): Record<string, any> => {
            const flattened: Record<string, any> = {};

            Object.keys(obj).forEach((key) => {
              const value = obj[key];
              const newKey = prefix ? `${prefix}.${key}` : key;

              if (value && typeof value === "object" && !Array.isArray(value)) {
                Object.assign(flattened, flattenObject(value, newKey));
              } else {
                flattened[newKey] = value;
              }
            });

            return flattened;
          };

          const flattenedValues = flattenObject(remoteConfigValues);
          setRemoteConfigValues(flattenedValues);
        } else {
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
  }, [targetingRules, token, org, app, mode, remoteConfigValues]);

  const updateFilePriority = useCallback((fileId: string, priority: "important" | "lazy") => {
    setFilePriority((prev) => ({
      ...prev,
      [fileId]: priority,
    }));
  }, []);

  const toggleResource = useCallback((resourceId: string) => {
    setSelectedResources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resourceId)) {
        newSet.delete(resourceId);
      } else {
        newSet.add(resourceId);
      }
      return newSet;
    });
  }, []);

  const canProceedToStep = useCallback(
    (step: number) => {
      switch (step) {
        case 1:
          return true;
        case 2:
          return true;
        case 3:
          if (schemaFields.length > 0) {
            const validation = validateAllRemoteConfigValues(remoteConfigValues, schemaFields);
            return validation.isValid;
          }
          return true;
        case 4:
          return selectedPackage !== null;
        case 5:
          return true;
        case 6:
          return true;
        default:
          return false;
      }
    },
    [schemaFields, remoteConfigValues, selectedPackage]
  );

  const createReleaseConfig = useCallback((): ReleaseConfigRequest | undefined => {
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

    const importantFiles = Object.entries(filePriority)
      .filter(([, v]) => v === "important")
      .map(([k]) => k);
    const lazyFiles = Object.entries(filePriority)
      .filter(([, v]) => v === "lazy")
      .map(([k]) => k);

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
  }, [
    bootTimeout,
    releaseConfigTimeout,
    propertiesJSON,
    remoteConfigValues,
    targetingRules,
    filePriority,
    selectedResources,
    selectedPackage,
  ]);

  const contextValue = useMemo<ReleaseFormContextType>(
    () => ({
      mode,
      releaseId,
      initialPackageInfo,
      initialResourceFilePaths,
      hasExistingReleases,
      currentStep,
      totalSteps: defaultState.totalSteps,
      bootTimeout,
      releaseConfigTimeout,
      configProperties,
      targetingRules,
      dimensions,
      cohorts,
      schemaFields,
      remoteConfigValues,
      schemaLoading,
      schemaError,
      selectedPackage,
      packages,
      packagesLoading,
      pkgSearch,
      pkgPage,
      totalPackagesPage,
      propertiesJSON,
      files,
      filePriority,
      filesSearch,
      filesCurrentPage,
      selectedResources,
      resourceSearch,
      resourceCurrentPage,

      setCurrentStep,
      goToNextStep,
      goToPreviousStep,
      setBootTimeout,
      setReleaseConfigTimeout,
      setConfigProperties,
      setTargetingRules,
      addTargetingRule,
      removeTargetingRule,
      updateTargetingRule,
      setDimensions,
      setCohorts,
      loadCohortsForDimension,
      setSchemaFields,
      setRemoteConfigValues,
      updateRemoteConfigValue,
      setSchemaLoading,
      setSchemaError,
      fetchSchema,
      setSelectedPackage,
      setPackages,
      setPackagesLoading,
      setPkgSearch,
      setPkgPage,
      setTotalPackagesPage,
      setPropertiesJSON,
      setFiles,
      setFilePriority,
      updateFilePriority,
      setFilesSearch,
      setFilesCurrentPage,
      setSelectedResources,
      toggleResource,
      setResourceSearch,
      setResourceCurrentPage,
      canProceedToStep,
      createReleaseConfig,
    }),
    [
      mode,
      releaseId,
      currentStep,
      bootTimeout,
      releaseConfigTimeout,
      configProperties,
      targetingRules,
      dimensions,
      cohorts,
      schemaFields,
      remoteConfigValues,
      schemaLoading,
      schemaError,
      selectedPackage,
      packages,
      packagesLoading,
      pkgSearch,
      pkgPage,
      totalPackagesPage,
      propertiesJSON,
      files,
      filePriority,
      filesSearch,
      filesCurrentPage,
      selectedResources,
      resourceSearch,
      resourceCurrentPage,
      goToNextStep,
      goToPreviousStep,
      addTargetingRule,
      removeTargetingRule,
      updateTargetingRule,
      loadCohortsForDimension,
      updateRemoteConfigValue,
      fetchSchema,
      updateFilePriority,
      toggleResource,
      canProceedToStep,
      createReleaseConfig,
    ]
  );

  return <ReleaseFormContext.Provider value={contextValue}>{children}</ReleaseFormContext.Provider>;
}

export function useReleaseForm(): ReleaseFormContextType {
  const context = useContext(ReleaseFormContext);
  if (!context) {
    throw new Error("useReleaseForm must be used within a ReleaseFormProvider");
  }
  return context;
}

export { ReleaseFormContext };
