"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Eye, CheckCircle, XCircle, FileJson } from "lucide-react";
import Ajv from "ajv";

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

interface ConfigValuesEditorProps {
  schema: SchemaField[];
  values: ConfigValue[];
  currentConfig: ConfigValue;
  onCurrentConfigChange: (config: ConfigValue) => void;
  onAddConfig: (config: ConfigValue) => void;
  onUpdateConfig: (index: number, config: ConfigValue) => void;
  onDeleteConfig: (index: number) => void;
}

interface ValidationError {
  field: string;
  message: string;
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
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
  };
}

function validateConfigValue(config: ConfigValue, schema: SchemaField[]): ValidationError[] {
  const jsonSchema = generateJsonSchema(schema);
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(jsonSchema);
  const valid = validate(config);

  if (valid) {
    return [];
  }

  return (validate.errors || []).map(error => ({
    field: error.instancePath || "root",
    message: error.message || "Validation error",
  }));
}

function ConfigValueForm({ schema, value, onChange, onSave, onCancel }: {
  schema: SchemaField[];
  value: ConfigValue;
  onChange: (value: ConfigValue) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const handleSave = () => {
    const validationErrors = validateConfigValue(value, schema);
    setErrors(validationErrors);
    
    if (validationErrors.length === 0) {
      onSave();
    }
  };

  const renderField = (field: SchemaField, path: string = "") => {
    const fieldPath = path ? `${path}.${field.name}` : field.name;
    const currentValue = path ? value[path]?.[field.name] : value[field.name];
    const fieldErrors = errors.filter(e => e.field === `/${fieldPath.replace(/\./g, "/")}`);

    const updateValue = (newValue: any) => {
      const updatedConfig = { ...value };
      if (path) {
        if (!updatedConfig[path]) updatedConfig[path] = {};
        updatedConfig[path][field.name] = newValue;
      } else {
        updatedConfig[field.name] = newValue;
      }
      onChange(updatedConfig);
    };

    return (
      <div key={field.id} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={field.id}>
            {field.name}
            {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Badge variant="outline" className="text-xs">
            {field.type}
          </Badge>
        </div>
        
        {field.description && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}

        {field.type === "string" && (
          <Input
            id={field.id}
            value={currentValue || ""}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.defaultValue || `Enter ${field.name}...`}
            className={fieldErrors.length > 0 ? "border-red-500" : ""}
          />
        )}

        {field.type === "number" && (
          <Input
            id={field.id}
            type="number"
            value={currentValue || ""}
            onChange={(e) => updateValue(parseFloat(e.target.value) || 0)}
            placeholder={field.defaultValue?.toString() || "0"}
            min={field.minValue}
            max={field.maxValue}
            className={fieldErrors.length > 0 ? "border-red-500" : ""}
          />
        )}

        {field.type === "boolean" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={currentValue || false}
              onCheckedChange={(checked) => updateValue(!!checked)}
            />
            <Label htmlFor={field.id}>Enable {field.name}</Label>
          </div>
        )}

        {field.type === "array" && (
          <div className="space-y-2">
            <Textarea
              value={currentValue ? JSON.stringify(currentValue, null, 2) : "[]"}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateValue(parsed);
                } catch {
                  // Invalid JSON, keep the string for now
                }
              }}
              placeholder="[]"
              rows={3}
              className={fieldErrors.length > 0 ? "border-red-500" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Enter a JSON array of {field.arrayItemType || "any"} values
            </p>
          </div>
        )}

        {field.type === "object" && field.children && (
          <Card className="ml-4">
            <CardContent className="pt-4 space-y-4">
              {field.children.map(childField => renderField(childField, fieldPath))}
            </CardContent>
          </Card>
        )}

        {fieldErrors.length > 0 && (
          <div className="text-sm text-red-500">
            {fieldErrors.map((error, idx) => (
              <p key={idx}>{error.message}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {schema.map(field => renderField(field))}
      </div>

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, idx) => (
              <li key={idx}>• {error.field}: {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

export function ConfigValuesEditor({
  schema,
  values,
  currentConfig,
  onCurrentConfigChange,
  onAddConfig,
  onUpdateConfig,
  onDeleteConfig,
}: ConfigValuesEditorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  const handleAddConfig = () => {
    onAddConfig(currentConfig);
    onCurrentConfigChange({});
    setIsAddDialogOpen(false);
  };

  const handleUpdateConfig = (index: number) => {
    onUpdateConfig(index, currentConfig);
    onCurrentConfigChange({});
    setEditingIndex(null);
  };

  const validateConfig = (config: ConfigValue): boolean => {
    return validateConfigValue(config, schema).length === 0;
  };

  if (schema.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No schema defined</h3>
          <p className="text-muted-foreground">
            Please define your schema first in the Schema Builder tab before creating configuration values.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configuration Values</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage different sets of configuration values based on your schema.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Configuration</DialogTitle>
              <DialogDescription>
                Create a new set of configuration values that conform to your schema.
              </DialogDescription>
            </DialogHeader>
            <ConfigValueForm
              schema={schema}
              value={currentConfig}
              onChange={onCurrentConfigChange}
              onSave={handleAddConfig}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {values.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No configurations yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by creating your first configuration that follows your defined schema.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Configuration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Saved Configurations ({values.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Valid</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.map((config, index) => {
                  const isValid = validateConfig(config);
                  const fieldCount = Object.keys(config).length;
                  
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono">
                        Config #{index + 1}
                      </TableCell>
                      <TableCell>
                        {isValid ? (
                          <Badge variant="default" className="flex items-center gap-1 w-fit">
                            <CheckCircle className="h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <XCircle className="h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{fieldCount} fields</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog
                            open={viewingIndex === index}
                            onOpenChange={(open) => setViewingIndex(open ? index : null)}
                          >
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>View Configuration #{index + 1}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                                  {JSON.stringify(config, null, 2)}
                                </pre>
                                {!isValid && (
                                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
                                    <ul className="text-sm text-red-700 space-y-1">
                                      {validateConfigValue(config, schema).map((error, idx) => (
                                        <li key={idx}>• {error.field}: {error.message}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog
                            open={editingIndex === index}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditingIndex(index);
                                onCurrentConfigChange(config);
                              } else {
                                setEditingIndex(null);
                                onCurrentConfigChange({});
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Configuration #{index + 1}</DialogTitle>
                              </DialogHeader>
                              <ConfigValueForm
                                schema={schema}
                                value={currentConfig}
                                onChange={onCurrentConfigChange}
                                onSave={() => handleUpdateConfig(index)}
                                onCancel={() => setEditingIndex(null)}
                              />
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete Configuration #{index + 1}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteConfig(index)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
