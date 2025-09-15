"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Copy, 
  Download, 
  FileJson, 
  FileCode, 
  Eye, 
  CheckCircle, 
  XCircle,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface ConfigPreviewProps {
  schema: SchemaField[];
  values: ConfigValue[];
}

function generateJsonSchema(fields: SchemaField[]): any {
  const properties: any = {};
  const required: string[] = [];

  fields.forEach(field => {
    if (field.required) {
      required.push(field.name);
    }

    let fieldSchema: any = {};

    switch (field.type) {
      case "string":
        fieldSchema = { type: "string" };
        if (field.minLength !== undefined) fieldSchema.minLength = field.minLength;
        if (field.maxLength !== undefined) fieldSchema.maxLength = field.maxLength;
        if (field.pattern) fieldSchema.pattern = field.pattern;
        if (field.enumValues && field.enumValues.length > 0) {
          fieldSchema.enum = field.enumValues;
        }
        break;
      case "number":
        fieldSchema = { type: "number" };
        if (field.minValue !== undefined) fieldSchema.minimum = field.minValue;
        if (field.maxValue !== undefined) fieldSchema.maximum = field.maxValue;
        break;
      case "boolean":
        fieldSchema = { type: "boolean" };
        break;
      case "array":
        fieldSchema = { type: "array" };
        if (field.arrayItemType) {
          if (field.arrayItemType === "object" && field.children && field.children.length > 0) {
            const itemSchema = generateJsonSchema(field.children);
            fieldSchema.items = itemSchema;
          } else {
            fieldSchema.items = { type: field.arrayItemType };
          }
        }
        break;
      case "object":
        fieldSchema = { type: "object" };
        if (field.children && field.children.length > 0) {
          const childSchema = generateJsonSchema(field.children);
          fieldSchema.properties = childSchema.properties;
          if (childSchema.required?.length > 0) {
            fieldSchema.required = childSchema.required;
          }
        } else {
          fieldSchema.additionalProperties = true;
        }
        break;
    }

    if (field.description) {
      fieldSchema.description = field.description;
    }

    if (field.defaultValue !== undefined) {
      fieldSchema.default = field.defaultValue;
    }

    properties[field.name] = fieldSchema;
  });

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://example.com/remote-config.schema.json",
    title: "Remote Configuration Schema",
    description: "Schema for remote configuration values",
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
  };
}

function SchemaVisualizer({ fields }: { fields: SchemaField[] }) {
  const renderField = (field: SchemaField, depth = 0) => (
    <div key={field.id} className={`space-y-2 ${depth > 0 ? 'ml-6 border-l-2 border-muted pl-4' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{field.name}</span>
        <Badge variant="outline">{field.type}</Badge>
        {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
        {field.arrayItemType && (
          <Badge variant="secondary" className="text-xs">
            Array of {field.arrayItemType}
          </Badge>
        )}
      </div>
      
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {field.defaultValue !== undefined && (
          <span>Default: {JSON.stringify(field.defaultValue)}</span>
        )}
        {field.minLength !== undefined && <span>Min Length: {field.minLength}</span>}
        {field.maxLength !== undefined && <span>Max Length: {field.maxLength}</span>}
        {field.minValue !== undefined && <span>Min: {field.minValue}</span>}
        {field.maxValue !== undefined && <span>Max: {field.maxValue}</span>}
        {field.pattern && <span>Pattern: {field.pattern}</span>}
      </div>
      
      {field.children && field.children.length > 0 && (
        <div className="mt-3">
          {field.children.map(child => renderField(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {fields.map(field => renderField(field))}
    </div>
  );
}

function ConfigSummary({ schema, values }: { schema: SchemaField[]; values: ConfigValue[] }) {
  const totalFields = schema.length;
  const requiredFields = schema.filter(f => f.required).length;
  const fieldTypes = schema.reduce((acc, field) => {
    acc[field.type] = (acc[field.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Schema Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Fields:</span>
            <span className="font-medium">{totalFields}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Required:</span>
            <span className="font-medium">{requiredFields}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Optional:</span>
            <span className="font-medium">{totalFields - requiredFields}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Field Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(fieldTypes).map(([type, count]) => (
            <div key={type} className="flex justify-between">
              <span className="text-sm text-muted-foreground capitalize">{type}:</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Configurations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Configs:</span>
            <span className="font-medium">{values.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Valid Configs:</span>
            <span className="font-medium text-green-600">
              {values.filter(v => Object.keys(v).length > 0).length}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConfigPreview({ schema, values }: ConfigPreviewProps) {
  const [activeView, setActiveView] = useState("summary");
  const { toast } = useToast();

  const jsonSchema = generateJsonSchema(schema);

  const copyToClipboard = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: `${label} has been copied to your clipboard.`,
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadJson = (content: any, filename: string) => {
    const dataStr = JSON.stringify(content, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = filename;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (schema.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nothing to preview</h3>
          <p className="text-muted-foreground">
            Create your schema and configuration values to see the preview here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ConfigSummary schema={schema} values={values} />
      
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="schema">JSON Schema</TabsTrigger>
          <TabsTrigger value="visual">Visual Schema</TabsTrigger>
          <TabsTrigger value="values">Config Values</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Configuration Summary</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify({
                      schema: jsonSchema,
                      values: values
                    }, null, 2), "Complete configuration")}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copy All
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => downloadJson({
                      schema: jsonSchema,
                      values: values
                    }, "remote-config-complete.json")}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Export All
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Schema Fields ({schema.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {schema.map(field => (
                      <div key={field.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Badge variant="outline">{field.type}</Badge>
                        <span className="font-medium">{field.name}</span>
                        {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Configuration Values ({values.length})</h4>
                  {values.length === 0 ? (
                    <p className="text-muted-foreground">No configuration values created yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {values.map((config, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">Config #{index + 1}</span>
                            <Badge variant="secondary">{Object.keys(config).length} fields</Badge>
                            <Badge variant={Object.keys(config).length > 0 ? "default" : "destructive"}>
                              {Object.keys(config).length > 0 ? (
                                <><CheckCircle className="h-3 w-3 mr-1" />Valid</>
                              ) : (
                                <><XCircle className="h-3 w-3 mr-1" />Empty</>
                              )}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>JSON Schema</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(jsonSchema, null, 2), "JSON Schema")}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copy Schema
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => downloadJson(jsonSchema, "remote-config-schema.json")}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                <pre className="text-sm p-4 bg-muted rounded-lg overflow-auto">
                  {JSON.stringify(jsonSchema, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visual">
          <Card>
            <CardHeader>
              <CardTitle>Visual Schema Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                <SchemaVisualizer fields={schema} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="values">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Configuration Values</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(values, null, 2), "Configuration values")}
                    disabled={values.length === 0}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copy Values
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => downloadJson(values, "remote-config-values.json")}
                    disabled={values.length === 0}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {values.length === 0 ? (
                <div className="text-center py-8">
                  <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No configuration values to display.</p>
                </div>
              ) : (
                <ScrollArea className="h-96 w-full">
                  <div className="space-y-4">
                    {values.map((config, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Configuration #{index + 1}</h4>
                          <Badge variant="secondary">{Object.keys(config).length} fields</Badge>
                        </div>
                        <pre className="text-sm bg-muted p-3 rounded overflow-auto">
                          {JSON.stringify(config, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
