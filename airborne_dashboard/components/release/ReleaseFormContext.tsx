"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from "react";
import useSWR from "swr";
import {
  ReleaseFormContextType,
  ReleaseFormState,
  ReleaseMode,
  TargetingRule,
  Pkg,
  FileItem,
  ReleaseConfigRequest,
  ApiReleaseData,
} from "@/types/release";
import { SchemaField } from "@/types/remote-configs";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { validateAllRemoteConfigValues } from "@/components/remote-config/utils/helpers";
import { parseFileRef, parseSubGroupFileRef } from "@/lib/utils";

const defaultState: ReleaseFormState = {
  mode: "create",
  releaseId: undefined,
  hasExistingReleases: false,
  currentStep: 1,
  totalSteps: 6,
  bootTimeout: 4000,
  releaseConfigTimeout: 4000,
  configProperties: "{}",
  targetingRules: [],
  schemaFields: [],
  remoteConfigValues: {},
  sub_packages: [],
  selectedPackagesByGroup: new Map<string, Pkg>(),
  selectedPackage: null,
  files: [],
  filePriority: {},
  selectedResources: new Set<string>(),
};

const ReleaseFormContext = createContext<ReleaseFormContextType | undefined>(undefined);

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
      state.bootTimeout = initialData.config.boot_timeout ?? 4000;
      state.releaseConfigTimeout = initialData.config.release_config_timeout ?? 4000;

      state.targetingRules = Object.entries(initialData.dimensions || {}).map(([dimension, values]) => ({
        dimension,
        operator: "equals" as const,
        values: Array.isArray(values) ? values.join(",") : String(values),
      }));

      if (initialData.config.properties && typeof initialData.config.properties === "object") {
        state.remoteConfigValues = initialData.config.properties;
      }

      state.selectedResources = new Set(initialData.resources.map((res) => res.file_id));

      const allFiles = initialData.package.important.concat(initialData.package.lazy);
      state.selectedPackage = {
        index: initialData.package.index.file_path,
        tag: initialData.package.tag,
        version: initialData.package.version,
        files: allFiles.map((file) => file.file_path),
        package_group_id: initialData.package.group_id,
      };

      state.sub_packages =
        initialData.sub_packages?.map((subPkg) => {
          const { groupId, version } = parseSubGroupFileRef(subPkg);
          return { groupId, version };
        }) || [];

      const filePriorities: Record<string, "important" | "lazy"> = {};
      initialData.package.important.forEach((file) => {
        filePriorities[file.file_path] = "important";
      });
      initialData.package.lazy.forEach((file) => {
        filePriorities[file.file_path] = "lazy";
      });
      state.filePriority = filePriorities;
    }

    return state;
  };

  const initialState = useMemo(() => getInitialState(), []);

  const [currentStep, setCurrentStep] = useState(initialState.currentStep);
  const [bootTimeout, setBootTimeout] = useState(initialState.bootTimeout);
  const [releaseConfigTimeout, setReleaseConfigTimeout] = useState(initialState.releaseConfigTimeout);
  const [configProperties, setConfigProperties] = useState(initialState.configProperties);
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>(initialState.targetingRules);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [remoteConfigValues, setRemoteConfigValues] = useState<Record<string, any>>(initialState.remoteConfigValues);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePriority, setFilePriority] = useState<Record<string, "important" | "lazy">>(initialState.filePriority);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(
    initialState.selectedResources || new Set<string>()
  );

  const [selectedPackagesByGroup, setSelectedPackagesByGroup] = useState<Map<string, Pkg>>(
    initialState.selectedPackagesByGroup
  );

  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(initialState.selectedPackage);

  // Fetch primary package details when initialData has package info
  // using older package route for backward compatibility
  // new one requires group id which will not be there for older releases
  useEffect(() => {
    if (!token || !org || !app) return;
    if (!initialState.selectedPackage) return;

    const targetVersion = initialState.selectedPackage.version;

    apiFetch<Pkg>("/packages", { query: { package_key: `version:${targetVersion}` } }, { token, org, app })
      .then((pkg) => {
        if (pkg) {
          setSelectedPackage(pkg);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch package:", error);
      });
  }, [initialState.selectedPackage, token, org, app]);

  useEffect(() => {
    if (!initialState || initialState.sub_packages.length === 0 || !token || !org || !app) return;

    const fetchSubPackageDetails = async () => {
      const subPackagePromises = initialState.sub_packages.map(async (subPkg) => {
        try {
          const res = await apiFetch<Pkg>(
            `/package-groups/${subPkg.groupId}/packages/version/${subPkg.version}`,
            {},
            { token, org, app }
          );

          if (res) {
            return { groupId: subPkg.groupId, pkg: res };
          }
          return null;
        } catch (error) {
          console.error(`Failed to fetch package for group ${subPkg.groupId}:`, error);
          return null;
        }
      });

      const results = await Promise.all(subPackagePromises);

      setSelectedPackagesByGroup((prev) => {
        const newMap = new Map(prev);
        results.forEach((result) => {
          if (result) {
            newMap.set(result.groupId, result.pkg);
          }
        });
        return newMap;
      });
    };

    fetchSubPackageDetails();
  }, [initialState.sub_packages, token, org, app]);

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

  const updateRemoteConfigValue = useCallback((fieldPath: string, value: any) => {
    setRemoteConfigValues((prev) => ({
      ...prev,
      [fieldPath]: value,
    }));
  }, []);

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

  // Package Groups functions
  const setSelectedPackageForGroup = (groupId: string, pkg: Pkg | null, primary: boolean) => {
    if (primary) {
      setSelectedPackage(pkg);
    }

    setSelectedPackagesByGroup((prev) => {
      const newMap = new Map(prev);
      if (pkg) {
        newMap.set(groupId, pkg);
      } else {
        newMap.delete(groupId);
      }
      return newMap;
    });
  };

  const getSelectedPackageForGroup = useCallback(
    (groupId: string): Pkg | null => {
      return selectedPackagesByGroup.get(groupId) || null;
    },
    [selectedPackagesByGroup]
  );

  // Memoized computation of resolved files from all selected packages
  // Primary group takes precedence, then latest version wins across sub-groups
  const { resolvedFiles, resolvedFilePriorities } = useMemo(() => {
    // Early return for steps other than 5 (File Priorities) to avoid unnecessary computation
    if (currentStep !== 5) {
      return { resolvedFiles: [], resolvedFilePriorities: {} };
    }

    const primaryPackage = selectedPackage !== null ? selectedPackage : null;

    if (!primaryPackage) {
      return { resolvedFiles: [], resolvedFilePriorities: {} };
    }

    // Map to track file paths and their best version
    // Key: file_path, Value: { fileItem, version, isPrimary }
    const fileMap = new Map<string, { fileItem: FileItem; version: number; isPrimary: boolean }>();

    // First, add all files from primary package (they take precedence)
    for (const file of primaryPackage.files) {
      const fileParsed = parseFileRef(file);
      fileMap.set(fileParsed.filePath, {
        fileItem: {
          id: file,
          file_path: fileParsed.filePath,
          version: fileParsed.version,
          tag: fileParsed.tag,
          sourceGroupId: primaryPackage ? primaryPackage.package_group_id : undefined,
          isPrimary: true,
        },
        version: fileParsed.version || 0,
        isPrimary: true,
      });
    }

    // Then, add files from sub-packages (only if not in primary, or if newer version)
    selectedPackagesByGroup.forEach((pkg, groupId) => {
      for (const file of pkg.files) {
        const fileParsed = parseFileRef(file);
        const existing = fileMap.get(fileParsed.filePath);

        // If file exists in primary, skip it (primary takes precedence)
        if (existing?.isPrimary) continue;

        // If file doesn't exist or has older version, use this one
        if (!existing || (fileParsed.version || 0) > existing.version) {
          fileMap.set(fileParsed.filePath, {
            fileItem: {
              id: file,
              file_path: fileParsed.filePath,
              version: fileParsed.version,
              tag: fileParsed.tag,
              sourceGroupId: groupId,
              isPrimary: false,
            },
            version: fileParsed.version || 0,
            isPrimary: false,
          });
        }
      }
    });

    // Convert map to array
    const files = Array.from(fileMap.values()).map((entry) => entry.fileItem);

    // Set default priorities (use existing if available from initial data)
    // Check both file.id (full reference) and file.file_path (just the path) for existing priorities
    const existingPriorities = filePriority || initialState.filePriority || {};
    const priorities: Record<string, "important" | "lazy"> = {};

    for (const file of files) {
      const priority = existingPriorities[file.id] || existingPriorities[file.file_path] || "important";
      priorities[file.id] = priority;
    }
    return { resolvedFiles: files, resolvedFilePriorities: priorities };
  }, [selectedPackagesByGroup, currentStep, selectedPackage]);

  useEffect(() => {
    if (currentStep === 5) {
      setFiles(resolvedFiles);
      setFilePriority(resolvedFilePriorities);
    }
  }, [currentStep, resolvedFiles, resolvedFilePriorities, initialState.filePriority]);

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
          // Must have primary package selected
          return selectedPackage !== null;
        case 5:
          return true;
        case 6:
          return true;
        default:
          return false;
      }
    },
    [schemaFields, remoteConfigValues, selectedPackage, selectedPackagesByGroup]
  );

  const createReleaseConfig = useCallback((): ReleaseConfigRequest | undefined => {
    const configProps: Record<string, any> = { ...remoteConfigValues };

    const dimensionsObj: Record<string, any> = {};
    targetingRules.forEach((r) => {
      if (!r.dimension || r.values.length === 0) return;
      dimensionsObj[r.dimension] = r.values.length === 1 ? r.values[0] : r.values;
    });

    // Build file references - file.id already contains the full reference (e.g., /dist/bundle.js@version:1)
    const importantFiles = files.filter((file) => filePriority[file.id] === "important").map((file) => file.id);
    const lazyFiles = files.filter((file) => filePriority[file.id] === "lazy").map((file) => file.id);

    const body: ReleaseConfigRequest = {
      config: {
        boot_timeout: bootTimeout,
        release_config_timeout: releaseConfigTimeout,
        properties: configProps,
      },
      package: { important: importantFiles, lazy: lazyFiles },
      dimensions: Object.keys(dimensionsObj).length ? dimensionsObj : undefined,
      resources: Array.from(selectedResources),
    };

    // Get primary package
    const primaryPkg = selectedPackage;

    if (primaryPkg) {
      body.package_id = `version:${primaryPkg.version}`;
    }

    // Build sub_packages array: "groupId@version" for non-primary groups
    // The primary package's group ID is stored in selectedPackage.package_group_id
    const primaryGroupId = primaryPkg?.package_group_id;
    const subPackages: string[] = [];
    selectedPackagesByGroup.forEach((pkg, groupId) => {
      if (primaryGroupId && groupId === primaryGroupId) return; // Skip primary
      subPackages.push(`${groupId}@${pkg.version}`);
    });

    if (subPackages.length > 0) {
      body.sub_packages = subPackages;
    }

    return body;
  }, [
    bootTimeout,
    releaseConfigTimeout,
    remoteConfigValues,
    targetingRules,
    files,
    filePriority,
    selectedResources,
    selectedPackage,
    selectedPackagesByGroup,
  ]);

  const contextValue = useMemo<ReleaseFormContextType>(
    () => ({
      mode,
      releaseId,
      sub_packages: initialState.sub_packages,
      hasExistingReleases,
      currentStep,
      totalSteps: defaultState.totalSteps,
      bootTimeout,
      releaseConfigTimeout,
      configProperties,
      targetingRules,
      schemaFields,
      remoteConfigValues,
      selectedPackagesByGroup,
      selectedPackage,
      files,
      filePriority,
      selectedResources,

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
      setSchemaFields,
      setRemoteConfigValues,
      updateRemoteConfigValue,
      setSelectedPackageForGroup,
      getSelectedPackageForGroup,
      setSelectedPackage,
      setFiles,
      setFilePriority,
      updateFilePriority,
      setSelectedResources,
      toggleResource,
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
      schemaFields,
      remoteConfigValues,
      selectedPackagesByGroup,
      selectedPackage,
      files,
      filePriority,
      selectedResources,
      goToNextStep,
      goToPreviousStep,
      addTargetingRule,
      removeTargetingRule,
      updateTargetingRule,
      updateRemoteConfigValue,
      setSelectedPackageForGroup,
      getSelectedPackageForGroup,
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
