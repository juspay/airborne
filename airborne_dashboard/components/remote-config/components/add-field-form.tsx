"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown, Code, Eye } from "lucide-react";
import { SchemaField } from "@/types/remote-configs";
import { generateJsonSchema, parseJsonSchema } from "../utils/helpers";

interface FieldEditorProps {
  field: SchemaField;
  onChange: (field: SchemaField) => void;
  onSave: () => void;
}

export function FieldEditor({ field, onChange, onSave }: FieldEditorProps) {
  const [editMode, setEditMode] = useState<"visual" | "json">("visual");
  const [jsonSchema, setJsonSchema] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [validationRulesOpen, setValidationRulesOpen] = useState(false);
  const [defaultValueOpen, setDefaultValueOpen] = useState(false);
  const [defaultValueText, setDefaultValueText] = useState("");
  const [defaultValueError, setDefaultValueError] = useState("");
  const [newOptionValue, setNewOptionValue] = useState(""); // New state for option input

  // Ref for the default value textarea to preserve cursor position
  const defaultValueTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Function to preserve cursor position when formatting JSON
  const preserveCursorPosition = useCallback((oldText: string, newText: string) => {
    const textarea = defaultValueTextareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;

    // If the text hasn't actually changed (same content, just formatting), preserve position
    if (oldText.replace(/\s/g, "") === newText.replace(/\s/g, "")) {
      // Find the closest character in the new formatted text
      let newPos = cursorPos;

      // If cursor was at the end, keep it at the end
      if (cursorPos >= oldText.length) {
        newPos = newText.length;
      } else {
        // Try to find equivalent position by counting non-whitespace characters
        let nonWhitespaceCount = 0;
        for (let i = 0; i < cursorPos && i < oldText.length; i++) {
          if (oldText[i] !== " " && oldText[i] !== "\n" && oldText[i] !== "\t") {
            nonWhitespaceCount++;
          }
        }

        // Find the same position in the new text
        let currentNonWhitespace = 0;
        for (let i = 0; i < newText.length; i++) {
          if (newText[i] !== " " && newText[i] !== "\n" && newText[i] !== "\t") {
            currentNonWhitespace++;
          }
          if (currentNonWhitespace > nonWhitespaceCount) {
            newPos = i;
            break;
          }
          newPos = i + 1;
        }
      }

      // Set the cursor position after the next render
      setTimeout(() => {
        if (textarea) {
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  }, []);

  // Initialize default value text when field changes
  useEffect(() => {
    let newText = "";

    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      if (typeof field.defaultValue === "string") {
        newText = field.defaultValue;
      } else {
        newText = JSON.stringify(field.defaultValue, null, 2);
      }
    }

    const oldText = defaultValueText;

    // Only update if the content is actually different (avoid infinite loops)
    if (oldText !== newText) {
      setDefaultValueText(newText);

      // Preserve cursor position if this is a formatting change
      if (oldText && newText) {
        preserveCursorPosition(oldText, newText);
      }
    }
  }, [field.defaultValue]);

  const updateField = (updates: Partial<SchemaField>) => {
    onChange({ ...field, ...updates });
  };

  // Validate default value without setting it (for real-time validation)
  const validateDefaultValue = useCallback(
    (value: string): string | null => {
      if (!value.trim()) {
        return null; // Empty is valid, will use auto-generated default
      }

      try {
        // Handle different field types
        switch (field.type) {
          case "string":
            // For string type, check enum values if they exist
            if (field.enumValues && field.enumValues.length > 0) {
              if (!field.enumValues.includes(value)) {
                return `Value must be one of: ${field.enumValues.join(", ")}`;
              }
            }
            // Check pattern if exists
            if (field.pattern) {
              const regex = new RegExp(field.pattern);
              if (!regex.test(value)) {
                return `Value must match pattern: ${field.pattern}`;
              }
            }
            // Check length constraints
            if (field.minLength !== undefined && value.length < field.minLength) {
              return `Minimum length is ${field.minLength}`;
            }
            if (field.maxLength !== undefined && value.length > field.maxLength) {
              return `Maximum length is ${field.maxLength}`;
            }
            break;
          case "number":
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              return "Invalid number format";
            }
            if (field.minValue !== undefined && numValue < field.minValue) {
              return `Minimum value is ${field.minValue}`;
            }
            if (field.maxValue !== undefined && numValue > field.maxValue) {
              return `Maximum value is ${field.maxValue}`;
            }
            break;
          case "boolean":
            const lowerText = value.toLowerCase().trim();
            if (lowerText !== "true" && lowerText !== "false") {
              return "Boolean must be 'true' or 'false'";
            }
            break;
          case "array":
          case "object":
            JSON.parse(value); // This will throw if invalid JSON
            break;
        }
        return null; // No error
      } catch (error) {
        if (field.type === "array") {
          return "Invalid JSON array format";
        } else if (field.type === "object") {
          return "Invalid JSON object format";
        }
        return error instanceof Error ? error.message : "Invalid value format";
      }
    },
    [field.type, field.enumValues, field.pattern, field.minLength, field.maxLength, field.minValue, field.maxValue]
  );

  // Update the field's default value (called when user stops typing)
  const updateDefaultValue = useCallback(() => {
    if (!defaultValueText.trim()) {
      updateField({ defaultValue: undefined });
      return;
    }

    const validationError = validateDefaultValue(defaultValueText);
    if (validationError) {
      return; // Don't update if there's an error
    }

    try {
      let parsedValue;

      switch (field.type) {
        case "string":
          parsedValue = defaultValueText;
          break;
        case "number":
          parsedValue = parseFloat(defaultValueText);
          break;
        case "boolean":
          const lowerText = defaultValueText.toLowerCase().trim();
          parsedValue = lowerText === "true";
          break;
        case "array":
        case "object":
          parsedValue = JSON.parse(defaultValueText);
          break;
        default:
          parsedValue = defaultValueText;
      }

      updateField({ defaultValue: parsedValue });
    } catch (error) {
      // This shouldn't happen since we validated above, but just in case
      console.error("Unexpected validation error:", error);
    }
  }, [defaultValueText, field.type, validateDefaultValue, updateField]);

  // Debounced validation effect
  useEffect(() => {
    const validationError = validateDefaultValue(defaultValueText);
    setDefaultValueError(validationError || "");

    // Debounce the actual field update
    const timeoutId = setTimeout(() => {
      updateDefaultValue();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [defaultValueText, validateDefaultValue, updateDefaultValue]);

  // Helper functions for managing options
  const addOption = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    const currentOptions = field.enumValues || [];
    if (!currentOptions.includes(trimmedValue)) {
      updateField({ enumValues: [...currentOptions, trimmedValue] });
    }
    setNewOptionValue("");
  };

  const removeOption = (valueToRemove: string) => {
    const currentOptions = field.enumValues || [];
    const updatedOptions = currentOptions.filter((option) => option !== valueToRemove);
    updateField({ enumValues: updatedOptions.length > 0 ? updatedOptions : undefined });
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addOption(newOptionValue);
    }
  };

  // Generate JSON schema for this specific field
  const generateFieldJsonSchema = (field: SchemaField): any => {
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

    return fieldSchema;
  };

  // Parse JSON schema back to field
  const parseFieldJsonSchema = (schema: any): Partial<SchemaField> => {
    const updates: Partial<SchemaField> = {
      type: schema.type || field.type,
      description: schema.description,
      defaultValue: schema.default,
    };

    // Handle string-specific properties
    if (schema.type === "string") {
      if (schema.minLength !== undefined) updates.minLength = schema.minLength;
      if (schema.maxLength !== undefined) updates.maxLength = schema.maxLength;
      if (schema.pattern) updates.pattern = schema.pattern;
      if (schema.enum) updates.enumValues = schema.enum;
    }

    // Handle number-specific properties
    if (schema.type === "number") {
      if (schema.minimum !== undefined) updates.minValue = schema.minimum;
      if (schema.maximum !== undefined) updates.maxValue = schema.maximum;
    }

    // Handle array properties
    if (schema.type === "array" && schema.items) {
      if (typeof schema.items.type === "string") {
        updates.arrayItemType = schema.items.type;
      } else if (schema.items.type === "object" && schema.items.properties) {
        updates.arrayItemType = "object";
        updates.children = parseJsonSchema(schema.items);
      }
    }

    // Handle object properties
    if (schema.type === "object" && schema.properties) {
      updates.children = parseJsonSchema(schema);
    }

    return updates;
  };

  const handleJsonSchemaUpdate = () => {
    try {
      const parsed = JSON.parse(jsonSchema);
      const updates = parseFieldJsonSchema(parsed);
      updateField(updates);
      setJsonError("");
    } catch (error) {
      console.log("Invalid JSON schema format", error);
      setJsonError("Invalid JSON schema format");
    }
  };

  const exportFieldSchema = () => {
    const schema = generateFieldJsonSchema(field);
    setJsonSchema(JSON.stringify(schema, null, 2));
  };

  return (
    <div className="space-y-4">
      <Tabs value={editMode} onValueChange={(value) => setEditMode(value as "visual" | "json")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Visual Editor
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            JSON Schema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Field Name *</Label>
              <Input
                id="name"
                value={field.name}
                onChange={(e) => updateField({ name: e.target.value })}
                placeholder="fieldName"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={field.type} onValueChange={(value) => updateField({ type: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={field.description || ""}
              onChange={(e) => updateField({ description: e.target.value })}
              placeholder="Describe what this field is for... (auto-generated if empty)"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              If left empty, a description will be auto-generated from the field name
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={field.required || false}
              onCheckedChange={(checked) => updateField({ required: !!checked })}
            />
            <Label htmlFor="required">Required field</Label>
          </div>

          {field.type === "array" && (
            <div className="space-y-2">
              <Label htmlFor="arrayItemType">Array Item Type</Label>
              <Select
                value={field.arrayItemType || "string"}
                onValueChange={(value) => updateField({ arrayItemType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(field.type === "string" || field.type === "number") && (
            <Collapsible open={validationRulesOpen} onOpenChange={setValidationRulesOpen}>
              <div className="space-y-4">
                <Separator />
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 p-0 h-auto font-medium w-full justify-start hover:bg-transparent"
                  >
                    {validationRulesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Validation Rules
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-4">
                  {field.type === "string" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="minLength">Min Length</Label>
                          <Input
                            id="minLength"
                            type="number"
                            value={field.minLength || ""}
                            onChange={(e) => updateField({ minLength: parseInt(e.target.value) || undefined })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxLength">Max Length</Label>
                          <Input
                            id="maxLength"
                            type="number"
                            value={field.maxLength || ""}
                            onChange={(e) => updateField({ maxLength: parseInt(e.target.value) || undefined })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pattern">Pattern (regex)</Label>
                        <Input
                          id="pattern"
                          value={field.pattern || ""}
                          onChange={(e) => updateField({ pattern: e.target.value })}
                          placeholder="^[a-zA-Z0-9]+$"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="enumValues">Options</Label>

                        {/* Display existing options as chips */}
                        {field.enumValues && field.enumValues.length > 0 && (
                          <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50 min-h-[2.5rem]">
                            {field.enumValues.map((option, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                                {option}
                                <button
                                  type="button"
                                  onClick={() => removeOption(option)}
                                  className="ml-1 text-muted-foreground hover:text-foreground"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Input for new options */}
                        <Input
                          id="enumValues"
                          value={newOptionValue}
                          onChange={(e) => setNewOptionValue(e.target.value)}
                          onKeyDown={handleOptionKeyDown}
                          placeholder="Type an option and press Enter to add"
                        />

                        <p className="text-xs text-muted-foreground">
                          Press Enter to add options. These will be the only allowed values.
                        </p>
                      </div>
                    </>
                  )}

                  {field.type === "number" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minValue">Min Value</Label>
                        <Input
                          id="minValue"
                          type="number"
                          value={field.minValue || ""}
                          onChange={(e) => updateField({ minValue: parseFloat(e.target.value) || undefined })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxValue">Max Value</Label>
                        <Input
                          id="maxValue"
                          type="number"
                          value={field.maxValue || ""}
                          onChange={(e) => updateField({ maxValue: parseFloat(e.target.value) || undefined })}
                        />
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          <Collapsible open={defaultValueOpen} onOpenChange={setDefaultValueOpen}>
            <div className="space-y-4">
              <Separator />
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 p-0 h-auto font-medium w-full justify-start hover:bg-white"
                >
                  {defaultValueOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Default Value
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-2">
                <Label htmlFor="defaultValue">Default Value</Label>
                <Textarea
                  ref={defaultValueTextareaRef}
                  id="defaultValue"
                  value={defaultValueText}
                  onChange={(e) => {
                    setDefaultValueText(e.target.value);
                  }}
                  placeholder={`Enter default ${field.type} value... (auto-generated if empty)`}
                  rows={4}
                  className={defaultValueError ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {defaultValueError && <p className="text-sm text-red-600">{defaultValueError}</p>}
                <p className="text-xs text-muted-foreground">
                  {field.type === "string" && "Enter a string value"}
                  {field.type === "number" && "Enter a numeric value"}
                  {field.type === "boolean" && "Enter 'true' or 'false'"}
                  {(field.type === "array" || field.type === "object") && "Enter valid JSON"}
                  {" • If left empty, a schema-compliant default value will be auto-generated"}
                </p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </TabsContent>

        <TabsContent value="json" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Field JSON Schema</h4>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportFieldSchema}>
                Export Current
              </Button>
              <Button onClick={handleJsonSchemaUpdate} disabled={!jsonSchema.trim()}>
                Apply Changes
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fieldJsonSchema">JSON Schema for &ldquo;{field.name}&rdquo;</Label>
            <Textarea
              id="fieldJsonSchema"
              value={jsonSchema}
              onChange={(e) => {
                setJsonSchema(e.target.value);
                setJsonError("");
              }}
              placeholder={`{
  "type": "${field.type}",
  "description": "Field description",
  ${
    field.type === "string"
      ? `"minLength": 1,
  "maxLength": 100,
  "pattern": "^[a-zA-Z0-9]+$"`
      : ""
  }
  ${
    field.type === "number"
      ? `"minimum": 0,
  "maximum": 100`
      : ""
  }
}`}
              rows={15}
              className="font-mono text-sm"
            />
          </div>

          {jsonError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{jsonError}</div>}

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Tip:</strong> Edit the JSON schema directly for this field. All changes will be applied to the
              field configuration.
            </p>
            <p>
              This follows the{" "}
              <a
                href="https://json-schema.org/specification"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                JSON Schema specification
              </a>
              .
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={onSave} disabled={!!defaultValueError}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// Add Field Form Component
interface AddFieldFormProps {
  onSave: (fieldData: Partial<SchemaField>) => void;
  onCancel: () => void;
}

export function AddFieldForm({ onSave, onCancel }: AddFieldFormProps) {
  const [formData, setFormData] = useState<Partial<SchemaField>>({
    name: "",
    type: "string",
    description: "",
    required: false,
  });

  const handleSave = () => {
    if (!formData.name?.trim()) {
      alert("Field name is required");
      return;
    }
    onSave(formData);
  };

  const updateFormData = (updates: Partial<SchemaField>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fieldName">Field Name *</Label>
          <Input
            id="fieldName"
            value={formData.name || ""}
            onChange={(e) => updateFormData({ name: e.target.value })}
            placeholder="fieldName"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fieldType">Type</Label>
          <Select
            value={formData.type || "string"}
            onValueChange={(value) => updateFormData({ type: value as SchemaField["type"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="array">Array</SelectItem>
              <SelectItem value="object">Object</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fieldDescription">Description</Label>
        <Textarea
          id="fieldDescription"
          value={formData.description || ""}
          onChange={(e) => updateFormData({ description: e.target.value })}
          placeholder="Describe what this field is for..."
          rows={2}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="required"
          checked={formData.required || false}
          onCheckedChange={(checked) => updateFormData({ required: checked as boolean })}
        />
        <Label htmlFor="required">Required field</Label>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Add Field</Button>
      </div>
    </div>
  );
}
