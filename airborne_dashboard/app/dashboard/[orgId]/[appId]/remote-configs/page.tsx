"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigSchemaBuilder } from "@/components/remote-config/config-schema-builder";
import { ConfigPreview } from "@/components/remote-config/config-preview";
import { Plus, Settings } from "lucide-react";
import { BackendPropertiesResponse, SchemaField } from "@/types/remote-configs";
import { hasAppAccess } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { convertBackendDataToFields } from "@/components/remote-config/utils/helpers";

export default function RemoteConfigsPage() {
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const params = useParams();
  const orgId = params.orgId as string;
  const appId = params.appId as string;
  const [activeTab, setActiveTab] = useState("schema");
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const fetchSchema = async () => {
    try {
      console.log(`Fetching schema for org: ${orgId}, app: ${appId}`);
      const data = await apiFetch<BackendPropertiesResponse>(
        `/organisations/applications/properties/schema`,
        { method: "GET" },
        { token, org, app }
      );

      console.log("Backend schema data:", data);

      if (data && data.properties && Object.keys(data.properties).length > 0) {
        const convertedFields = convertBackendDataToFields(data.properties);
        console.log("Converted fields:", convertedFields);
        handleSchemaSave(convertedFields);
      }
    } catch (error) {
      console.error("Error fetching schema:", error);
    }
  };

  useEffect(() => {
    if (token && orgId && appId) {
      fetchSchema();
    }
  }, [token, orgId, appId]);

  const handleSchemaSave = (schemaFields: SchemaField[]) => {
    // Handle successful save if needed
    setSchemaFields(schemaFields);
    console.log("Schema saved successfully");
  };

  const configSnapshots = function () {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration Snapshots</CardTitle>
          <CardDescription>
            Review your JSON schema. You can copy the JSON schema or export your configurations. You can also see the
            current and previous states of your configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigPreview schema={schemaFields} values={[]} />
        </CardContent>
      </Card>
    );
  };

  return (
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

      {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Schema Builder
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Configuration Snapshots
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
                <ConfigSchemaBuilder orgId={orgId} appId={appId} onSave={handleSchemaSave} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">{configSnapshots()}</TabsContent>
        </Tabs>
      )}
      {!hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && configSnapshots()}
    </div>
  );
}
