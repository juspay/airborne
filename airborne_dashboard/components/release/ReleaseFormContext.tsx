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
import { parseFileRef } from "@/lib/utils";

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

      const filePriorities: Record<string, "important" | "lazy"> = {};
      initialData.package.important.forEach((file) => {
        filePriorities[file.file_path] = "important";
      });
      initialData.package.lazy.forEach((file) => {
        filePriorities[file.file_path] = "lazy";
      });
      state.filePriority = filePriorities;

      const allFiles = [
        ...initialData.package.important.map((file) => file.file_path),
        ...initialData.package.lazy.map((file) => file.file_path),
      ];

      state.selectedPackage = {
        tag: initialData.package.tag,
        version: initialData.package.version,
        index: initialData.package.index.file_path,
        files: allFiles,
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
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [remoteConfigValues, setRemoteConfigValues] = useState<Record<string, any>>(initialState.remoteConfigValues);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePriority, setFilePriority] = useState<Record<string, "important" | "lazy">>(initialState.filePriority);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(
    initialState.selectedResources || new Set<string>()
  );

  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(null);

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

  useEffect(() => {
    if (currentStep !== 5 || !selectedPackage) return;

    const pkgFiles: FileItem[] = [];
    const existingPriorities = filePriority || initialState.filePriority || {};
    const mergedPriorities: Record<string, "important" | "lazy"> = {};

    for (const file of selectedPackage.files) {
      const fileParsed = parseFileRef(file);
      pkgFiles.push({
        id: file,
        file_path: fileParsed.filePath,
        version: fileParsed.version,
        tag: fileParsed.tag,
      });

      const priority = existingPriorities[file] || existingPriorities[fileParsed.filePath] || "important";
      mergedPriorities[file] = priority;
    }

    setFiles(pkgFiles);
    setFilePriority(mergedPriorities);
  }, [currentStep, selectedPackage, initialState.filePriority]);

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
      package: { important: importantFiles, lazy: lazyFiles },
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
      hasExistingReleases,
      currentStep,
      totalSteps: defaultState.totalSteps,
      bootTimeout,
      releaseConfigTimeout,
      configProperties,
      targetingRules,
      schemaFields,
      remoteConfigValues,
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
