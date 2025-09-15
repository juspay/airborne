"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, pointerWithin, rectIntersection } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Edit,
  Settings,
  Code,
  Eye,
  FolderOpen,
  Folder,
} from "lucide-react";

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

interface ConfigSchemaBuilderProps {
  fields: SchemaField[];
  onFieldsChange: (fields: SchemaField[]) => void;
}

// Generate proper JSON Schema v7 compliant schema
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

// Parse JSON Schema back to our field structure
function parseJsonSchema(schema: any): SchemaField[] {
  if (!schema.properties) return [];

  const fields: SchemaField[] = [];
  const required = schema.required || [];

  Object.entries(schema.properties).forEach(([name, propSchema]: [string, any]) => {
    const field: SchemaField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: propSchema.type || "string",
      description: propSchema.description,
      required: required.includes(name),
      defaultValue: propSchema.default,
    };

    // Handle string-specific properties
    if (propSchema.type === "string") {
      if (propSchema.minLength !== undefined) field.minLength = propSchema.minLength;
      if (propSchema.maxLength !== undefined) field.maxLength = propSchema.maxLength;
      if (propSchema.pattern) field.pattern = propSchema.pattern;
      if (propSchema.enum) field.enumValues = propSchema.enum;
    }

    // Handle number-specific properties
    if (propSchema.type === "number") {
      if (propSchema.minimum !== undefined) field.minValue = propSchema.minimum;
      if (propSchema.maximum !== undefined) field.maxValue = propSchema.maximum;
    }

    // Handle array properties
    if (propSchema.type === "array" && propSchema.items) {
      if (typeof propSchema.items.type === "string") {
        field.arrayItemType = propSchema.items.type;
      } else if (propSchema.items.type === "object" && propSchema.items.properties) {
        field.arrayItemType = "object";
        field.children = parseJsonSchema(propSchema.items);
      }
    }

    // Handle object properties
    if (propSchema.type === "object" && propSchema.properties) {
      field.children = parseJsonSchema(propSchema);
    }

    fields.push(field);
  });

  return fields;
}

// Root drop zone component
function RootDropZone({ children, isActive }: { children: React.ReactNode; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-drop-zone',
  });

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[250px] p-6 rounded-lg transition-all duration-200 ${
        isActive || isOver
          ? 'bg-blue-50 border-2 border-dashed border-blue-300' 
          : 'bg-gray-50/50 border border-transparent hover:border-gray-200'
      }`}
    >
      {children}
      {(isOver || isActive) && (
        <div className="flex items-center justify-center p-10 text-blue-600 bg-blue-100/50 rounded-lg mt-6 border-2 border-dashed border-blue-300">
          <div className="text-center">
            <FolderOpen className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Drop here to move to root level</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Drop zone for nested fields
function NestedDropZone({ parentId, isActive, children }: { 
  parentId: string; 
  isActive: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${parentId}`,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[80px] transition-all duration-200 ${
        isActive || isOver
          ? 'bg-green-50 border-2 border-dashed border-green-300 rounded-lg p-4' 
          : 'min-h-0'
      }`}
    >
      {children}
      {(isOver || isActive) && !children && (
        <div className="flex items-center justify-center p-6 text-green-600">
          <div className="text-center">
            <Folder className="h-6 w-6 mx-auto mb-1" />
            <p className="text-xs font-medium">Drop here to add as child field</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableFieldProps {
  field: SchemaField;
  onUpdate: (field: SchemaField) => void;
  onDelete: () => void;
  onAddChild: (parentId: string) => void;
  onMoveToRoot?: (fieldId: string) => void;
  depth?: number;
  isDragOverlay?: boolean;
  isDragging?: boolean;
  globalDragState?: boolean;
}

function SortableField({ field, onUpdate, onDelete, onAddChild, onMoveToRoot, depth = 0, isDragOverlay = false, isDragging = false, globalDragState = false }: SortableFieldProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<SchemaField>(field);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isCurrentlyDragging,
    isOver,
    setDroppableNodeRef,
  } = useSortable({
    id: field.id,
    data: {
      type: 'field',
      field,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isCurrentlyDragging ? 0.3 : 1,
  };

  const handleSave = () => {
    onUpdate(editingField);
    setIsEditDialogOpen(false);
  };

  const canHaveChildren = field.type === "object" || (field.type === "array" && field.arrayItemType === "object");
  const hasChildren = field.children && field.children.length > 0;

  return (
    <div 
      ref={!isDragOverlay ? setNodeRef : undefined} 
      style={style} 
      className={`${depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : ""}`}
    >
      <Card className={`mb-3 transition-all duration-200 ${
        isDragOverlay 
          ? 'shadow-2xl border-blue-300 bg-white' 
          : isCurrentlyDragging 
            ? 'opacity-50' 
            : 'hover:shadow-md border-transparent hover:border-gray-200'
      }`}>
        <CardHeader className="py-4 px-4">
          <div className="flex items-center gap-3">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab hover:text-blue-600 active:cursor-grabbing p-1 hover:bg-blue-50 rounded transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            
            {canHaveChildren && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}

            {canHaveChildren && (
              <div className="text-muted-foreground">
                {hasChildren ? (
                  <FolderOpen className="h-4 w-4 text-green-600" />
                ) : (
                  <Folder className="h-4 w-4 text-gray-400" />
                )}
              </div>
            )}

            <div className="flex-1 flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{field.name}</span>
                  <Badge variant="secondary" className="text-xs">{field.type}</Badge>
                  {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  {field.arrayItemType && (
                    <Badge variant="outline" className="text-xs">
                      Array of {field.arrayItemType}
                    </Badge>
                  )}
                </div>
                {field.description && (
                  <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {canHaveChildren && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddChild(field.id)}
                  className="h-8 px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}

              {depth > 0 && onMoveToRoot && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMoveToRoot(field.id)}
                  title="Move to root level"
                  className="h-8 px-2"
                >
                  <FolderOpen className="h-3 w-3" />
                </Button>
              )}
              
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 px-2">
                    <Edit className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Field</DialogTitle>
                    <DialogDescription>Configure the field properties and validation rules.</DialogDescription>
                  </DialogHeader>
                  <FieldEditor field={editingField} onChange={setEditingField} onSave={handleSave} />
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="destructive" onClick={onDelete} className="h-8 px-2">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {canHaveChildren && (
          <Collapsible open={isOpen}>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <NestedDropZone parentId={field.id} isActive={globalDragState && !hasChildren}>
                  {hasChildren && (
                    <div className="space-y-2">
                      {field.children?.map((child) => (
                        <SortableField
                          key={child.id}
                          field={child}
                          onUpdate={(updatedChild) => {
                            const updatedChildren = field.children?.map(c => 
                              c.id === child.id ? updatedChild : c
                            ) || [];
                            onUpdate({ ...field, children: updatedChildren });
                          }}
                          onDelete={() => {
                            const updatedChildren = field.children?.filter(c => c.id !== child.id) || [];
                            onUpdate({ ...field, children: updatedChildren });
                          }}
                          onAddChild={onAddChild}
                          onMoveToRoot={onMoveToRoot}
                          depth={depth + 1}
                          isDragging={isDragging}
                          globalDragState={globalDragState}
                        />
                      ))}
                    </div>
                  )}
                </NestedDropZone>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
    </div>
  );
}

interface FieldEditorProps {
  field: SchemaField;
  onChange: (field: SchemaField) => void;
  onSave: () => void;
}

function FieldEditor({ field, onChange, onSave }: FieldEditorProps) {
  const [editMode, setEditMode] = useState<"visual" | "json">("visual");
  const [jsonSchema, setJsonSchema] = useState("");
  const [jsonError, setJsonError] = useState("");

  const updateField = (updates: Partial<SchemaField>) => {
    onChange({ ...field, ...updates });
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
              placeholder="Describe what this field is for..."
              rows={2}
            />
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
            <div className="space-y-4">
              <Separator />
              <h4 className="font-medium">Validation Rules</h4>
              
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
                    <Label htmlFor="enumValues">Enum Values (comma-separated)</Label>
                    <Input
                      id="enumValues"
                      value={field.enumValues?.join(", ") || ""}
                      onChange={(e) => updateField({ 
                        enumValues: e.target.value.split(",").map(v => v.trim()).filter(v => v.length > 0)
                      })}
                      placeholder="option1, option2, option3"
                    />
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
            </div>
          )}

          <Separator />
          <div className="space-y-2">
            <Label htmlFor="defaultValue">Default Value</Label>
            <Input
              id="defaultValue"
              value={field.defaultValue ? JSON.stringify(field.defaultValue) : ""}
              onChange={(e) => {
                try {
                  const value = e.target.value ? JSON.parse(e.target.value) : undefined;
                  updateField({ defaultValue: value });
                } catch {
                  // Invalid JSON, keep as string for now
                  updateField({ defaultValue: e.target.value });
                }
              }}
              placeholder={`Default ${field.type} value...`}
            />
          </div>
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
            <Label htmlFor="fieldJsonSchema">JSON Schema for "{field.name}"</Label>
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
  ${field.type === "string" ? `"minLength": 1,
  "maxLength": 100,
  "pattern": "^[a-zA-Z0-9]+$"` : ""}
  ${field.type === "number" ? `"minimum": 0,
  "maximum": 100` : ""}
}`}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          
          {jsonError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {jsonError}
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Tip:</strong> Edit the JSON schema directly for this field. All changes will be applied to the field configuration.
            </p>
            <p>
              This follows the <a href="https://json-schema.org/specification" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">JSON Schema specification</a>.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={onSave}>Save Changes</Button>
      </div>
    </div>
  );
}

export function ConfigSchemaBuilder({ fields, onFieldsChange }: ConfigSchemaBuilderProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [jsonSchemaText, setJsonSchemaText] = useState("");
  const [jsonEditMode, setJsonEditMode] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const activeField = activeId ? findFieldById(fields, activeId) : null;

  // Custom collision detection that prioritizes drop zones
  const customCollisionDetection = (args: any) => {
    // First check for pointer intersection with drop zones
    const pointerIntersections = pointerWithin(args);
    const dropZoneIntersections = pointerIntersections.filter((intersection: any) => 
      String(intersection.id).startsWith('drop-zone-') || String(intersection.id) === 'root-drop-zone'
    );
    
    // If we have drop zone intersections, prioritize them
    if (dropZoneIntersections.length > 0) {
      return dropZoneIntersections;
    }
    
    // Otherwise, use rectangle intersection for regular fields
    return rectIntersection(args);
  };

  function findFieldById(fieldsList: SchemaField[], id: string): SchemaField | null {
    for (const field of fieldsList) {
      if (field.id === id) return field;
      if (field.children) {
        const found = findFieldById(field.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function findParentField(fieldsList: SchemaField[], targetId: string): SchemaField | null {
    for (const field of fieldsList) {
      if (field.children?.some(child => child.id === targetId)) {
        return field;
      }
      if (field.children) {
        const found = findParentField(field.children, targetId);
        if (found) return found;
      }
    }
    return null;
  }

  const addField = (parentId?: string) => {
    const newField: SchemaField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `field${Date.now()}`,
      type: "string",
      description: "",
      required: false,
    };

    if (parentId) {
      const updateFields = (fieldsList: SchemaField[]): SchemaField[] => {
        return fieldsList.map(field => {
          if (field.id === parentId) {
            return {
              ...field,
              children: [...(field.children || []), newField],
            };
          }
          if (field.children) {
            return {
              ...field,
              children: updateFields(field.children),
            };
          }
          return field;
        });
      };
      onFieldsChange(updateFields(fields));
    } else {
      onFieldsChange([...fields, newField]);
    }
  };

  const updateField = (fieldId: string, updatedField: SchemaField) => {
    const updateFields = (fieldsList: SchemaField[]): SchemaField[] => {
      return fieldsList.map(field => {
        if (field.id === fieldId) {
          return updatedField;
        }
        if (field.children) {
          return {
            ...field,
            children: updateFields(field.children),
          };
        }
        return field;
      });
    };
    onFieldsChange(updateFields(fields));
  };

  const deleteField = (fieldId: string) => {
    const removeField = (fieldsList: SchemaField[]): SchemaField[] => {
      return fieldsList
        .filter(field => field.id !== fieldId)
        .map(field => ({
          ...field,
          children: field.children ? removeField(field.children) : undefined,
        }));
    };
    onFieldsChange(removeField(fields));
  };

  const moveFieldToParent = (fieldId: string, newParentId: string | null) => {
    let fieldToMove: SchemaField | null = null;
    
    // Remove field from current location
    const removeAndCapture = (fieldsList: SchemaField[]): SchemaField[] => {
      return fieldsList
        .filter(field => {
          if (field.id === fieldId) {
            fieldToMove = field;
            return false;
          }
          return true;
        })
        .map(field => ({
          ...field,
          children: field.children ? removeAndCapture(field.children) : undefined,
        }));
    };

    let updatedFields = removeAndCapture(fields);

    if (fieldToMove) {
      if (newParentId) {
        // Add to new parent
        const addToParent = (fieldsList: SchemaField[]): SchemaField[] => {
          return fieldsList.map(field => {
            if (field.id === newParentId) {
              return {
                ...field,
                children: [...(field.children || []), fieldToMove!],
              };
            }
            if (field.children) {
              return {
                ...field,
                children: addToParent(field.children),
              };
            }
            return field;
          });
        };
        updatedFields = addToParent(updatedFields);
      } else {
        // Add to root level
        updatedFields = [...updatedFields, fieldToMove];
      }
    }

    onFieldsChange(updatedFields);
  };

  const handleDragStart = (event: any) => {
    setActiveId(String(event.active.id));
    setIsDragging(true);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setIsOverDropZone(false);
      return;
    }

    // Check if we're over any drop zone
    const isOverDZ = String(over.id).startsWith('drop-zone-') || String(over.id) === 'root-drop-zone';
    setIsOverDropZone(isOverDZ);

    const activeField = findFieldById(fields, String(active.id));
    const overField = findFieldById(fields, String(over.id));

    if (!activeField || !overField) return;

    // Check if we can drop into this field (only objects and object arrays can have children)
    const canDropInto = overField.type === "object" || 
                       (overField.type === "array" && overField.arrayItemType === "object");

    if (canDropInto && active.id !== over.id) {
      // We're hovering over a field that can accept children
      // This is just for visual feedback, actual moving happens in dragEnd
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);
    setIsOverDropZone(false);

    if (!over || active.id === over.id) return;

    const activeField = findFieldById(fields, String(active.id));

    if (!activeField) return;

    // Check if we're dropping on a drop zone
    if (String(over.id).startsWith('drop-zone-')) {
      const parentId = String(over.id).replace('drop-zone-', '');
      moveFieldToParent(String(active.id), parentId);
      return;
    }

    // Check if we're dropping on root drop zone
    if (String(over.id) === 'root-drop-zone') {
      moveFieldToParent(String(active.id), null);
      return;
    }

    const overField = findFieldById(fields, String(over.id));
    if (!overField) return;

    // Check if we're dropping on a field
    const canDropInto = overField.type === "object" || 
                       (overField.type === "array" && overField.arrayItemType === "object");

    if (canDropInto) {
      // Move field into the target field
      moveFieldToParent(String(active.id), String(over.id));
    } else {
      // Only allow reordering if we're not trying to drop into a drop zone
      // This prevents unwanted reordering when aiming for nested drop zones
      if (!isOverDropZone) {
        const activeParent = findParentField(fields, String(active.id));
        const overParent = findParentField(fields, String(over.id));

        if (activeParent?.id === overParent?.id) {
          // Same parent, just reorder
          const parentFields = activeParent ? activeParent.children! : fields;
          const oldIndex = parentFields.findIndex(field => field.id === String(active.id));
          const newIndex = parentFields.findIndex(field => field.id === String(over.id));
          
          if (activeParent) {
            const newChildren = arrayMove(parentFields, oldIndex, newIndex);
            updateField(activeParent.id, { ...activeParent, children: newChildren });
          } else {
            onFieldsChange(arrayMove(fields, oldIndex, newIndex));
          }
        }
      }
    }
  };

  const handleJsonSchemaImport = () => {
    try {
      const parsed = JSON.parse(jsonSchemaText);
      const importedFields = parseJsonSchema(parsed);
      onFieldsChange(importedFields);
      setJsonError("");
      setJsonEditMode(false);
    } catch (error) {
      setJsonError("Invalid JSON schema format");
    }
  };

  const generateCurrentSchema = () => {
    return generateJsonSchema(fields);
  };

  const exportJsonSchema = () => {
    const schema = generateCurrentSchema();
    setJsonSchemaText(JSON.stringify(schema, null, 2));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Schema Fields</h3>
          <p className="text-sm text-muted-foreground">
            Drag fields into objects to create nested structures. Drop fields onto the root area to move them out of containers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => addField()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      </div>

      <Tabs value={jsonEditMode ? "json" : "visual"} onValueChange={(value) => setJsonEditMode(value === "json")}>
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

        <TabsContent value="visual" className="mt-4">
          {fields.length === 0 ? (
            <RootDropZone isActive={isDragging}>
              <Card>
                <CardContent className="py-8 text-center">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No fields yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start building your configuration schema by adding your first field.
                  </p>
                  <Button onClick={() => addField()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Field
                  </Button>
                </CardContent>
              </Card>
            </RootDropZone>
          ) : (
            <DndContext 
              sensors={sensors} 
              collisionDetection={customCollisionDetection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <RootDropZone isActive={isDragging}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="text-sm text-muted-foreground">
                      Root Level Fields ({fields.length})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      💡 Drag fields here to move them to root level
                    </div>
                  </div>
                  <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {fields.map((field) => (
                      <SortableField
                        key={field.id}
                        field={field}
                        onUpdate={(updatedField) => updateField(field.id, updatedField)}
                        onDelete={() => deleteField(field.id)}
                        onAddChild={addField}
                        onMoveToRoot={(fieldId) => moveFieldToParent(fieldId, null)}
                        globalDragState={isDragging}
                      />
                    ))}
                  </SortableContext>
                </div>
              </RootDropZone>
              <DragOverlay>
                {activeField ? (
                  <SortableField
                    field={activeField}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    onAddChild={() => {}}
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>JSON Schema Editor</span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={exportJsonSchema}
                    disabled={fields.length === 0}
                  >
                    Export Current
                  </Button>
                  <Button onClick={handleJsonSchemaImport} disabled={!jsonSchemaText.trim()}>
                    Import Schema
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jsonSchema">JSON Schema (JSON Schema Draft 2020-12)</Label>
                <Textarea
                  id="jsonSchema"
                  value={jsonSchemaText}
                  onChange={(e) => {
                    setJsonSchemaText(e.target.value);
                    setJsonError("");
                  }}
                  placeholder={`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Remote Configuration Schema",
  "type": "object",
  "properties": {
    "fieldName": {
      "type": "string",
      "description": "Field description"
    }
  },
  "required": ["fieldName"]
}`}
                  rows={20}
                  className="font-mono text-sm"
                />
              </div>
              
              {jsonError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {jsonError}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  <strong>Tip:</strong> You can edit the JSON schema directly here and import it, or export your current visual schema to JSON.
                </p>
                <p>
                  This follows the <a href="https://json-schema.org/specification" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">JSON Schema specification</a>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
