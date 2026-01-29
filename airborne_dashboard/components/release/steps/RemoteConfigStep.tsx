"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cog, Info } from "lucide-react";
import { useReleaseForm } from "../ReleaseFormContext";
import { SchemaField } from "@/types/remote-configs";
import {
  validateValueAgainstSchema,
  generateDefaultValue,
  convertBackendDataToFields,
} from "@/components/remote-config/utils/helpers";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import hljs from "highlight.js";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/vs2015.css";

hljs.registerLanguage("json", json);

interface BackendPropertiesResponse {
  properties: Record<string, any>;
}

export function RemoteConfigStep() {
  const { token, org, app } = useAppContext();
  const { schemaFields, remoteConfigValues, targetingRules, setSchemaFields, updateRemoteConfigValue } =
    useReleaseForm();

  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const dimensionsQuery = targetingRules
        .filter((r) => r.dimension && r.values)
        .map((r) => `${r.dimension}=${r.values}`)
        .join("&");

      const url = `/organisations/applications/properties/schema${dimensionsQuery ? `?${dimensionsQuery}` : ""}`;
      const data = await apiFetch<BackendPropertiesResponse>(url, { method: "GET" }, { token, org, app });

      if (data && data.properties && Object.keys(data.properties).length > 0) {
        const convertedFields = convertBackendDataToFields(data.properties);
        setSchemaFields(convertedFields);
      }
    } catch (err: any) {
      setSchemaError(err?.message || "Failed to load schema");
    } finally {
      setSchemaLoading(false);
    }
  }, [token, org, app, targetingRules, setSchemaFields]);

  useEffect(() => {
    if (token && org && app) {
      fetchSchema();
    }
  }, [fetchSchema, token, org, app]);

  const buildPreviewFromSchema = useCallback(
    (fields: SchemaField[], path: string = ""): Record<string, any> => {
      const result: Record<string, any> = {};

      for (const field of fields) {
        const fieldPath = path ? `${path}.${field.name}` : field.name;
        const currentValue = remoteConfigValues[fieldPath];

        if (field.children && field.children.length > 0) {
          result[field.name] = buildPreviewFromSchema(field.children, fieldPath);
        } else {
          if (currentValue !== undefined) {
            result[field.name] = currentValue;
          } else if (field.defaultValue !== undefined) {
            result[field.name] = field.defaultValue;
          } else {
            result[field.name] = generateDefaultValue(field.type, {
              enum: field.enumValues,
              minimum: field.minValue,
            });
          }
        }
      }

      return result;
    },
    [remoteConfigValues]
  );

  const renderRemoteConfigField = (field: SchemaField, path: string = "") => {
    const fieldPath = path ? `${path}.${field.name}` : field.name;
    const currentValue = remoteConfigValues[fieldPath];

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
        updateRemoteConfigValue(fieldPath, field.type === "array" ? [] : field.type === "object" ? {} : undefined);
        return;
      }

      try {
        const parsed = JSON.parse(inputValue);
        if (field.type === "array" && Array.isArray(parsed)) {
          updateRemoteConfigValue(fieldPath, parsed);
        } else if (field.type === "object" && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          updateRemoteConfigValue(fieldPath, parsed);
        } else {
          updateRemoteConfigValue(fieldPath, inputValue);
        }
      } catch {
        updateRemoteConfigValue(fieldPath, inputValue);
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
          <Select value={currentValue || ""} onValueChange={(value) => updateRemoteConfigValue(fieldPath, value)}>
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
              onCheckedChange={(checked) => updateRemoteConfigValue(fieldPath, checked === true)}
            />
            <Label htmlFor={fieldPath} className="text-sm font-normal">
              Enable {field.name}
            </Label>
          </div>
        ) : field.type === "number" ? (
          <Input
            id={fieldPath}
            type="number"
            value={currentValue ?? ""}
            onChange={(e) => updateRemoteConfigValue(fieldPath, e.target.value ? Number(e.target.value) : "")}
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
            onChange={(e) => updateRemoteConfigValue(fieldPath, e.target.value)}
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

  return (
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
                      __html: hljs.highlight(JSON.stringify(buildPreviewFromSchema(schemaFields), null, 2), {
                        language: "json",
                      }).value,
                    }}
                  />
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RemoteConfigStep;
