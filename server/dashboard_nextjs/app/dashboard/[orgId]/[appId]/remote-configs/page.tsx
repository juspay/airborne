"use client";

import { useState } from "react";
import SharedLayout from "@/components/shared-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigSchemaBuilder } from "@/components/remote-config/config-schema-builder";
import { ConfigValuesEditor } from "@/components/remote-config/config-values-editor";
import { ConfigPreview } from "@/components/remote-config/config-preview";
import { Plus, Settings, FileJson } from "lucide-react";

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

export type ConfigValue = {
  [key: string]: any;
};

export default function RemoteConfigsPage() {
  const [activeTab, setActiveTab] = useState("schema");
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [configValues, setConfigValues] = useState<ConfigValue[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ConfigValue>({});

  const handleSchemaChange = (fields: SchemaField[]) => {
    setSchemaFields(fields);
    // Reset config values when schema changes
    setConfigValues([]);
    setCurrentConfig({});
  };

  const handleAddConfigValue = (values: ConfigValue) => {
    setConfigValues([...configValues, values]);
    setCurrentConfig({});
  };

  const handleUpdateConfigValue = (index: number, values: ConfigValue) => {
    const updated = [...configValues];
    updated[index] = values;
    setConfigValues(updated);
  };

  const handleDeleteConfigValue = (index: number) => {
    const updated = configValues.filter((_, i) => i !== index);
    setConfigValues(updated);
  };

  return (
    <SharedLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
              Remote Configurations
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage JSON-based configurations with schema validation
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Schema Builder
            </TabsTrigger>
            <TabsTrigger value="values" className="flex items-center gap-2" disabled={schemaFields.length === 0}>
              <FileJson className="h-4 w-4" />
              Configuration Values
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Preview & Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schema">
            <Card>
              <CardHeader>
                <CardTitle>Schema Builder</CardTitle>
                <CardDescription>
                  Define the structure and validation rules for your configuration. You can add fields, set types,
                  descriptions, and default values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfigSchemaBuilder
                  fields={schemaFields}
                  onFieldsChange={handleSchemaChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="values">
            <Card>
              <CardHeader>
                <CardTitle>Configuration Values</CardTitle>
                <CardDescription>
                  Create different sets of values that conform to your schema. Each configuration can be used in
                  different environments or scenarios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfigValuesEditor
                  schema={schemaFields}
                  values={configValues}
                  currentConfig={currentConfig}
                  onCurrentConfigChange={setCurrentConfig}
                  onAddConfig={handleAddConfigValue}
                  onUpdateConfig={handleUpdateConfigValue}
                  onDeleteConfig={handleDeleteConfigValue}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Preview & Export</CardTitle>
                <CardDescription>
                  Review your JSON schema and configuration values. You can copy the JSON schema or export your
                  configurations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfigPreview
                  schema={schemaFields}
                  values={configValues}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SharedLayout>
  );
}
