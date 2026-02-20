import { SchemaField } from "./remote-configs";

export type ReleaseMode = "create" | "clone" | "edit";

export type Pkg = {
  index: string;
  tag: string;
  version: number;
  files: string[];
};

export type FileItem = {
  id: string;
  file_path: string;
  version?: number;
  tag?: string;
  size?: number;
};

export type ResourceFile = {
  id: string;
  file_path: string;
  size?: number;
  created_at?: string;
  tag: string;
};

export type FilesApiResponse = {
  files: ResourceFile[];
  total: number;
  page?: number;
  per_page?: number;
};

export type TargetingRule = {
  dimension: string;
  operator: "equals";
  values: string;
};

export type Dimension = {
  dimension: string;
  values: string[];
  type?: string;
  depends_on?: string;
};

export type ReleaseConfigRequest = {
  config: {
    boot_timeout: number;
    release_config_timeout: number;
    properties: Record<string, any>;
  };
  package: {
    important: string[];
    lazy: string[];
  };
  dimensions?: Record<string, string | string[]>;
  resources: string[];
  package_id?: string;
};

export interface ReleaseFormState {
  mode: ReleaseMode;
  releaseId?: string;

  hasExistingReleases: boolean;

  // Navigation
  currentStep: number;
  totalSteps: number;

  // Configuration (Step 1)
  bootTimeout: number;
  releaseConfigTimeout: number;
  configProperties: string;

  // Targeting (Step 2)
  targetingRules: TargetingRule[];

  // Remote Config (Step 3)
  schemaFields: SchemaField[];
  remoteConfigValues: Record<string, any>;

  // Package Selection (Step 4)
  selectedPackage: Pkg | null;

  // File Priorities (Step 5)
  files: FileItem[];
  filePriority: Record<string, "important" | "lazy">;

  // Resources (Step 6)
  selectedResources: Set<string>;
}

export interface ReleaseFormActions {
  // Navigation
  setCurrentStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Configuration
  setBootTimeout: (timeout: number) => void;
  setReleaseConfigTimeout: (timeout: number) => void;
  setConfigProperties: (properties: string) => void;

  // Targeting
  setTargetingRules: (rules: TargetingRule[]) => void;
  addTargetingRule: () => void;
  removeTargetingRule: (index: number) => void;
  updateTargetingRule: (index: number, patch: Partial<TargetingRule>) => void;

  // Remote Config
  setSchemaFields: (fields: SchemaField[]) => void;
  setRemoteConfigValues: (values: Record<string, any>) => void;
  updateRemoteConfigValue: (fieldPath: string, value: any) => void;

  // Package Selection
  setSelectedPackage: (pkg: Pkg | null) => void;

  // File Priorities
  setFiles: (files: FileItem[]) => void;
  setFilePriority: (priority: Record<string, "important" | "lazy">) => void;
  updateFilePriority: (fileId: string, priority: "important" | "lazy") => void;

  // Resources
  setSelectedResources: (resources: Set<string>) => void;
  toggleResource: (resourceId: string) => void;

  // Validation
  canProceedToStep: (step: number) => boolean;

  // Submit
  createReleaseConfig: () => ReleaseConfigRequest | undefined;
}

export interface ReleaseFormContextType extends ReleaseFormState, ReleaseFormActions {}

export interface ReleaseStep {
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}

// Release data from API (for clone/edit)
export interface ApiReleaseData {
  id: string;
  config: {
    boot_timeout: number;
    release_config_timeout: number;
    properties: Record<string, any>;
  };
  package: {
    tag: string;
    version: number;
    index: { file_path: string };
    properties: Record<string, any>;
    important: Array<{ file_path: string }>;
    lazy: Array<{ file_path: string }>;
  };
  dimensions?: Record<string, string | string[]>;
  resources: Array<{ file_id: string }>;
}
