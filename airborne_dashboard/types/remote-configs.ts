export type SchemaField = {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  defaultValue?: any;
  required?: boolean;
  children?: SchemaField[];
  arrayItemType?: "string" | "number" | "boolean" | "object";
  enumValues?: string[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

// Backend types
export type BackendSchemaNode = {
  description: string;
  default_value: any;
  schema: any;
};

export type BackendPropertiesResponse = {
  properties: Record<string, BackendSchemaNode>;
};

export interface ConfigSchemaBuilderProps {
  orgId: string;
  appId: string;
  onSave?: (transformedSchema: SchemaField[]) => void;
}

export type ConfigValue = {
  [key: string]: any;
};

export interface ConfigValuesEditorProps {
  schema: SchemaField[];
  values: ConfigValue[];
  currentConfig: ConfigValue;
  onCurrentConfigChange: (config: ConfigValue) => void;
  onAddConfig: (config: ConfigValue) => void;
  onUpdateConfig: (index: number, config: ConfigValue) => void;
  onDeleteConfig: (index: number) => void;
}

export interface ValidationError {
  field: string;
  message: string;
}

export type PropertyEntry = {
  dimensions: { [key: string]: any };
  experiment_id: string; // This is actually release_id
  status: string;
  properties: { [key: string]: any };
};

export type ListPropertiesResponse = {
  properties: PropertyEntry[];
};

export interface ConfigPreviewProps {
  schema: SchemaField[];
  values: ConfigValue[];
}
