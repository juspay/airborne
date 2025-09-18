"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import SharedLayout from "@/components/shared-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigSchemaBuilder } from "@/components/remote-config/config-schema-builder";
import { ConfigPreview } from "@/components/remote-config/config-preview";
import { Plus, Settings } from "lucide-react";

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

export default function RemoteConfigsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const appId = params.appId as string;
  const [activeTab, setActiveTab] = useState("schema");
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);

  const handleSchemaSave = () => {
    // Handle successful save if needed
    console.log("Schema saved successfully");
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Schema Builder
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
                  orgId={orgId}
                  appId={appId}
                  onSave={handleSchemaSave}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Preview & Export</CardTitle>
                <CardDescription>
                  Review your JSON schema. You can copy the JSON schema or export your
                  configurations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfigPreview
                  schema={schemaFields}
                  values={[]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SharedLayout>
  );
}
