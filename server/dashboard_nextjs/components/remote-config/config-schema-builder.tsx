"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";

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
type BackendSchemaNode = {
  description: string;
  default_value: any;
  schema: any;
};

type BackendPropertiesResponse = {
  properties: Record<string, BackendSchemaNode>;
};

interface ConfigSchemaBuilderProps {
  orgId: string;
  appId: string;
  onSave?: (transformedSchema: Record<string, any>) => void;
}

// Helper function to generate unique IDs
function generateId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to generate default values based on schema type
function generateDefaultValue(type: string, schema: any): any {
  switch (type) {
    case "string":
      if (schema.enum && schema.enum.length > 0) {
        return schema.enum[0];
      }
      return "";
    case "number":
      if (schema.minimum !== undefined) {
        return schema.minimum;
      }
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

// Helper function to generate description from field name
function generateDescription(fieldName: string): string {
  // Convert camelCase or snake_case to readable format
  const readable = fieldName
    .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
  
  return readable;
}

// Schema validation function
function validateValueAgainstSchema(value: any, schema: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (value === null || value === undefined) {
    return { isValid: true, errors: [] }; // Allow null/undefined values
  }
  
  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && actualType !== schema.type) {
    errors.push(`Expected type ${schema.type}, but got ${actualType}`);
  }
  
  // String validations
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`String length ${value.length} is less than minimum ${schema.minLength}`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push(`String length ${value.length} exceeds maximum ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`String does not match pattern ${schema.pattern}`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Value "${value}" is not in allowed enum values: ${schema.enum.join(', ')}`);
    }
  }
  
  // Number validations
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`Number ${value} is less than minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`Number ${value} exceeds maximum ${schema.maximum}`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
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
          ? 'bg-blue-50 dark:bg-blue-950 border-2 border-dashed border-blue-300 dark:border-blue-600' 
          : 'bg-gray-50/50 dark:bg-gray-800/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
      }`}
    >
      {children}
      {(isOver || isActive) && (
        <div className="flex items-center justify-center p-10 text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/50 rounded-lg mt-6 border-2 border-dashed border-blue-300 dark:border-blue-600">
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
function NestedDropZone({ parentId, isActive, children, isInvalid = false }: { 
  parentId: string; 
  isActive: boolean;
  children?: React.ReactNode;
  isInvalid?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${parentId}`,
  });

  const isInvalidDrop = isInvalid && isOver;

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[80px] transition-all duration-200 ${
        isInvalidDrop
          ? 'bg-red-50 dark:bg-red-950 border-2 border-dashed border-red-300 dark:border-red-600 rounded-lg p-4'
          : isActive || isOver
            ? 'bg-green-50 dark:bg-green-950 border-2 border-dashed border-green-300 dark:border-green-600 rounded-lg p-4' 
            : 'min-h-0'
      }`}
    >
      {children}
      {(isOver || isActive) && !children && (
        <div className={`flex items-center justify-center p-6 ${
          isInvalidDrop 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-green-600 dark:text-green-400'
        }`}>
          <div className="text-center">
            {isInvalidDrop ? (
              <>
                <Folder className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium">⚠️ Invalid drop target</p>
              </>
            ) : (
              <>
                <Folder className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium">Drop here to add as child field</p>
              </>
            )}
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
  invalidDropTarget?: string | null;
  autoOpenEditId?: string | null;
  setAutoOpenEditId?: (id: string | null) => void;
}

function SortableField({ field, onUpdate, onDelete, onAddChild, onMoveToRoot, depth = 0, isDragOverlay = false, isDragging = false, globalDragState = false, invalidDropTarget = null, autoOpenEditId = null, setAutoOpenEditId }: SortableFieldProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<SchemaField>(field);

  // Auto-open edit dialog for new fields
  React.useEffect(() => {
    if (autoOpenEditId === field.id && setAutoOpenEditId) {
      setIsEditDialogOpen(true);
      setAutoOpenEditId(null);
    }
  }, [autoOpenEditId, field.id, setAutoOpenEditId]);

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
          ? 'shadow-2xl border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800' 
          : isCurrentlyDragging 
            ? 'opacity-50' 
            : 'hover:shadow-md border-transparent hover:border-gray-200 dark:hover:border-gray-600'
      }`}>
        <CardHeader className="py-4 px-4">
          <div className="flex items-center gap-3">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab hover:text-blue-600 dark:hover:text-blue-400 active:cursor-grabbing p-1 hover:bg-blue-50 dark:hover:bg-blue-950 rounded transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            
            {canHaveChildren && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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
                  <FolderOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Folder className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                )}
              </div>
            )}

            <div className="flex-1 flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{field.name}</span>
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
                <NestedDropZone 
                  parentId={field.id} 
                  isActive={globalDragState && !hasChildren}
                  isInvalid={invalidDropTarget === `drop-zone-${field.id}`}
                >
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
                          invalidDropTarget={invalidDropTarget}
                          autoOpenEditId={autoOpenEditId}
                          setAutoOpenEditId={setAutoOpenEditId}
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
    if (oldText.replace(/\s/g, '') === newText.replace(/\s/g, '')) {
      // Find the closest character in the new formatted text
      let newPos = cursorPos;
      
      // If cursor was at the end, keep it at the end
      if (cursorPos >= oldText.length) {
        newPos = newText.length;
      } else {
        // Try to find equivalent position by counting non-whitespace characters
        let nonWhitespaceCount = 0;
        for (let i = 0; i < cursorPos && i < oldText.length; i++) {
          if (oldText[i] !== ' ' && oldText[i] !== '\n' && oldText[i] !== '\t') {
            nonWhitespaceCount++;
          }
        }
        
        // Find the same position in the new text
        let currentNonWhitespace = 0;
        for (let i = 0; i < newText.length; i++) {
          if (newText[i] !== ' ' && newText[i] !== '\n' && newText[i] !== '\t') {
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
      if (typeof field.defaultValue === 'string') {
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
  const validateDefaultValue = useCallback((value: string): string | null => {
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
              return `Value must be one of: ${field.enumValues.join(', ')}`;
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
  }, [field.type, field.enumValues, field.pattern, field.minLength, field.maxLength, field.minValue, field.maxValue]);

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
    const updatedOptions = currentOptions.filter(option => option !== valueToRemove);
    updateField({ enumValues: updatedOptions.length > 0 ? updatedOptions : undefined });
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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
                  <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto font-medium w-full justify-start hover:bg-transparent">
                    {validationRulesOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
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
                              <Badge 
                                key={index} 
                                variant="secondary" 
                                className="flex items-center gap-1 px-2 py-1"
                              >
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
                <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto font-medium w-full justify-start hover:bg-white">
                  {defaultValueOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
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
                {defaultValueError && (
                  <p className="text-sm text-red-600">
                    {defaultValueError}
                  </p>
                )}
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
        <Button 
          onClick={onSave}
          disabled={!!defaultValueError}
        >
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

function AddFieldForm({ onSave, onCancel }: AddFieldFormProps) {
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
    setFormData(prev => ({ ...prev, ...updates }));
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
            onValueChange={(value) => updateFormData({ type: value as SchemaField['type'] })}
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
        <Button onClick={handleSave}>
          Add Field
        </Button>
      </div>
    </div>
  );
}

export function ConfigSchemaBuilder({ orgId, appId, onSave }: ConfigSchemaBuilderProps) {
  const { token, org, app } = useAppContext();
  const sensors = useSensors(useSensor(PointerSensor));
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [jsonSchemaText, setJsonSchemaText] = useState("");
  const [jsonEditMode, setJsonEditMode] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [invalidDropTarget, setInvalidDropTarget] = useState<string | null>(null);
  const [autoOpenEditId, setAutoOpenEditId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFields, setInitialFields] = useState<SchemaField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Add Field modal state
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [newFieldParentId, setNewFieldParentId] = useState<string | undefined>(undefined);

  const activeField = activeId ? findFieldById(fields, activeId) : null;

  // API functions
  const fetchSchema = async () => {
    setIsLoading(true);
    try {
      console.log(`Fetching schema for org: ${orgId}, app: ${appId}`);
      const data = await apiFetch<BackendPropertiesResponse>(
        `/organisations/applications/properties/schema`,
        { method: 'GET' },
        { token, org, app }
      );
      
      console.log('Backend schema data:', data);
      
      if (data && data.properties && Object.keys(data.properties).length > 0) {
        const convertedFields = convertBackendDataToFields(data.properties);
        console.log('Converted fields:', convertedFields);
        setFields(convertedFields);
        setInitialFields([...convertedFields]);
      } else {
        console.log('No schema data found, starting with empty fields');
        setFields([]);
        setInitialFields([]);
      }
    } catch (error) {
      console.error('Error fetching schema:', error);
      // If there's no schema yet, start with empty fields
      setFields([]);
      setInitialFields([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSchema = async (transformedSchema: Record<string, any>) => {
    setSaveLoading(true);
    try {
      await apiFetch(
        `/organisations/applications/properties/schema`,
        {
          method: 'PUT',
          body: { properties: transformedSchema }
        },
        { token, org, app }
      );
      
      // Reset the initial state to current state
      setInitialFields([...fields]);
      setHasChanges(false);
      if (onSave) {
        onSave(transformedSchema);
      }
    } catch (error) {
      console.error('Error saving schema:', error);
    } finally {
      setSaveLoading(false);
    }
  };

  // Convert backend data to internal field format
  // Convert backend data to internal field format
  const convertBackendDataToFields = (properties: Record<string, BackendSchemaNode>): SchemaField[] => {
    const fieldMap = new Map<string, SchemaField>();
    const rootFields: SchemaField[] = [];

    // Sort keys to ensure proper hierarchy building
    const sortedKeys = Object.keys(properties).sort();

    sortedKeys.forEach(key => {
      const node = properties[key];
      const pathParts = key.replace('config.properties.', '').split('.');
      
      // Remove 'properties' parts from the path for internal representation
      const cleanPath = pathParts.filter(part => part !== 'properties');
      const fieldName = cleanPath[cleanPath.length - 1];
      const fieldType = (node.schema.type || 'string') as SchemaField['type'];
      
      // Generate default value if not provided
      const defaultValue = node.default_value !== null && node.default_value !== undefined 
        ? node.default_value 
        : generateDefaultValue(fieldType, node.schema);
      
      // Generate description if not provided
      const description = node.description || generateDescription(fieldName);
      
      const field: SchemaField = {
        id: generateId(),
        name: fieldName,
        type: fieldType,
        description: description,
        defaultValue: defaultValue,
        required: false, // Can be enhanced based on schema.required array
        children: [],
      };

      // Add additional schema properties
      if (node.schema.minLength !== undefined) field.minLength = node.schema.minLength;
      if (node.schema.maxLength !== undefined) field.maxLength = node.schema.maxLength;
      if (node.schema.minimum !== undefined) field.minValue = node.schema.minimum;
      if (node.schema.maximum !== undefined) field.maxValue = node.schema.maximum;
      if (node.schema.pattern) field.pattern = node.schema.pattern;
      if (node.schema.enum) field.enumValues = node.schema.enum;
      if (node.schema.items && node.schema.items.type) field.arrayItemType = node.schema.items.type;

      // Handle nested objects by building hierarchy
      if (cleanPath.length === 1) {
        rootFields.push(field);
        fieldMap.set(key, field);
      } else {
        // This is a nested field, need to find or create parent structure
        let currentPath = 'config.properties';
        let currentParent: SchemaField | null = null;
        
        for (let i = 0; i < cleanPath.length - 1; i++) {
          currentPath += '.' + cleanPath[i];
          let parentField = fieldMap.get(currentPath);
          
          if (!parentField) {
            // Create parent field if it doesn't exist
            parentField = {
              id: generateId(),
              name: cleanPath[i],
              type: 'object',
              description: generateDescription(cleanPath[i]),
              defaultValue: {},
              required: false,
              children: [],
            };
            
            if (i === 0) {
              rootFields.push(parentField);
            } else if (currentParent) {
              currentParent.children = currentParent.children || [];
              currentParent.children.push(parentField);
            }
            
            fieldMap.set(currentPath, parentField);
          }
          
          currentParent = parentField;
        }
        
        // Add the field to its parent
        if (currentParent) {
          currentParent.children = currentParent.children || [];
          currentParent.children.push(field);
        }
        
        fieldMap.set(key, field);
      }
    });

    return rootFields;
  };

  // Load initial data
  useEffect(() => {
    fetchSchema();
  }, [orgId, appId]);

  // Track changes
  React.useEffect(() => {
    const hasFieldsChanged = JSON.stringify(fields) !== JSON.stringify(initialFields);
    setHasChanges(hasFieldsChanged);
  }, [fields, initialFields]);

  // Auto-populate JSON schema when switching to JSON tab
  React.useEffect(() => {
    if (jsonEditMode && fields.length > 0) {
      const schema = generateJsonSchema(fields);
      setJsonSchemaText(JSON.stringify(schema, null, 2));
    }
  }, [jsonEditMode, fields]);

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

  function isAncestorOf(potentialAncestorId: string, potentialDescendantId: string): boolean {
    const ancestor = findFieldById(fields, potentialAncestorId);
    if (!ancestor || !ancestor.children) return false;
    
    // Check if potentialDescendantId is a direct child
    if (ancestor.children.some(child => child.id === potentialDescendantId)) {
      return true;
    }
    
    // Check if potentialDescendantId is a descendant of any child
    return ancestor.children.some(child => isAncestorOf(child.id, potentialDescendantId));
  }

  const addField = (parentId?: string) => {
    setNewFieldParentId(parentId);
    setIsAddFieldModalOpen(true);
  };

  const createNewField = (fieldData: Partial<SchemaField>) => {
    const newField: SchemaField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fieldData.name || `field${Date.now()}`,
      type: fieldData.type || "string",
      description: fieldData.description || generateDescription(fieldData.name || `field${Date.now()}`),
      defaultValue: fieldData.defaultValue || generateDefaultValue(fieldData.type || "string", { type: fieldData.type || "string" }),
      required: fieldData.required || false,
      ...fieldData
    };

    if (newFieldParentId) {
      const updateFields = (fieldsList: SchemaField[]): SchemaField[] => {
        return fieldsList.map(field => {
          if (field.id === newFieldParentId) {
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
      setFields(updateFields(fields));
    } else {
      setFields([...fields, newField]);
    }

    // Set this field to auto-open for further editing
    setAutoOpenEditId(newField.id);

    // Close modal and reset state
    setIsAddFieldModalOpen(false);
    setNewFieldParentId(undefined);
  };

  const updateField = (fieldId: string, updatedField: SchemaField) => {
    const updateFields = (fieldsList: SchemaField[]): SchemaField[] => {
      return fieldsList.map(field => {
        if (field.id === fieldId) {
          // Ensure default value and description are set when updating
          const finalField = { ...updatedField };
          
          // Set default value if not provided
          if (finalField.defaultValue === null || finalField.defaultValue === undefined || finalField.defaultValue === '') {
            finalField.defaultValue = generateDefaultValue(finalField.type, {
              type: finalField.type,
              enum: finalField.enumValues,
              minimum: finalField.minValue,
              maximum: finalField.maxValue,
            });
          }
          
          // Set description if not provided
          if (!finalField.description || finalField.description.trim() === '') {
            finalField.description = generateDescription(finalField.name);
          }
          
          return finalField;
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
    setFields(updateFields(fields));
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
    setFields(removeField(fields));
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

    setFields(updatedFields);
  };

  const handleDragStart = (event: any) => {
    setActiveId(String(event.active.id));
    setIsDragging(true);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setIsOverDropZone(false);
      setInvalidDropTarget(null);
      return;
    }

    // Check if we're over any drop zone
    const isOverDZ = String(over.id).startsWith('drop-zone-') || String(over.id) === 'root-drop-zone';
    setIsOverDropZone(isOverDZ);

    const activeField = findFieldById(fields, String(active.id));
    const overField = findFieldById(fields, String(over.id));

    if (!activeField) return;

    // If we're over a drop zone, check for circular dependency
    if (String(over.id).startsWith('drop-zone-')) {
      const parentId = String(over.id).replace('drop-zone-', '');
      
      // Check if trying to drop into itself
      if (String(active.id) === parentId) {
        setInvalidDropTarget(String(over.id));
        return;
      }
      
      // Check for circular dependency
      if (isAncestorOf(String(active.id), parentId)) {
        setInvalidDropTarget(String(over.id));
        return;
      } else {
        setInvalidDropTarget(null);
      }
    }

    if (!overField) return;

    // Check if we can drop into this field (only objects and object arrays can have children)
    const canDropInto = overField.type === "object" || 
                       (overField.type === "array" && overField.arrayItemType === "object");

    if (canDropInto && active.id !== over.id) {
      // Check if trying to drop into itself
      if (String(active.id) === String(over.id)) {
        setInvalidDropTarget(String(over.id));
        return;
      }
      
      // Check for circular dependency when hovering over a field
      if (isAncestorOf(String(active.id), String(over.id))) {
        setInvalidDropTarget(String(over.id));
        return;
      } else {
        setInvalidDropTarget(null);
      }
      
      // We're hovering over a field that can accept children
      // This is just for visual feedback, actual moving happens in dragEnd
    } else {
      setInvalidDropTarget(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);
    setIsOverDropZone(false);
    setInvalidDropTarget(null);

    if (!over || active.id === over.id) return;

    const activeField = findFieldById(fields, String(active.id));

    if (!activeField) return;

    // Check if we're dropping on a drop zone
    if (String(over.id).startsWith('drop-zone-')) {
      const parentId = String(over.id).replace('drop-zone-', '');
      
      // Prevent moving a field into itself
      if (String(active.id) === parentId) {
        console.warn("Cannot move a field into itself");
        return;
      }
      
      // Prevent circular dependency: don't allow dropping a field into its own descendants
      if (isAncestorOf(String(active.id), parentId)) {
        console.warn("Cannot move a field into its own descendant");
        return;
      }
      
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
      // Prevent moving a field into itself
      if (String(active.id) === String(over.id)) {
        console.warn("Cannot move a field into itself");
        return;
      }
      
      // Prevent circular dependency: don't allow dropping a field into its own descendants
      if (isAncestorOf(String(active.id), String(over.id))) {
        console.warn("Cannot move a field into its own descendant");
        return;
      }
      
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
            setFields(arrayMove(fields, oldIndex, newIndex));
          }
        }
      }
    }
  };

  const handleJsonSchemaImport = () => {
    try {
      const parsed = JSON.parse(jsonSchemaText);
      const importedFields = parseJsonSchema(parsed);
      setFields(importedFields);
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

  // Transform schema to dot notation format
  const transformSchemaToFlatFormat = (schema: any): Record<string, any> => {
    const result: Record<string, any> = {};
    
    const traverseSchema = (obj: any, path: string = '') => {
      if (obj.type === 'object' && obj.properties) {
        const hasNonObjectProperties = Object.values(obj.properties).some((prop: any) => 
          prop.type !== 'object' || !prop.properties
        );
        
        if (hasNonObjectProperties) {
          // If this object has non-object properties, add them with dot notation
          Object.entries(obj.properties).forEach(([key, prop]: [string, any]) => {
            const fullPath = path ? `${path}.properties.${key}` : `${key}`;
            
            if (prop.type === 'object' && prop.properties) {
              // Recurse for nested objects
              traverseSchema(prop, fullPath);
            } else {
              // Add leaf property
              const cleanProp = { ...prop };
              delete cleanProp.description; // Remove description if not needed in final format
              result[fullPath] = cleanProp;
            }
          });
        } else {
          // If this object only has object properties, recurse into them
          Object.entries(obj.properties).forEach(([key, prop]: [string, any]) => {
            const fullPath = path ? `${path}.${key}` : key;
            traverseSchema(prop, fullPath);
          });
        }
      } else {
        // This is a leaf node or non-object, add it directly
        const cleanObj = { ...obj };
        delete cleanObj.description; // Remove description if not needed
        result[path] = cleanObj;
      }
    };
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
        traverseSchema(prop, key);
      });
    }
    
    return result;
  };

  const handleSubmitChanges = async () => {
    const schema = generateCurrentSchema();
    const transformedSchema = transformSchemaToFlatFormat(schema);
    
    // Convert to backend format with validation and defaults
    const backendSchema: Record<string, BackendSchemaNode> = {};
    const validationErrors: string[] = [];
    
    Object.entries(transformedSchema).forEach(([key, schemaData]) => {
      const fullKey = key.startsWith('config.properties.') ? key : `config.properties.${key}`;
      const field = findFieldByPath(fields, key);
      
      if (field) {
        // Ensure default value is provided and valid
        let defaultValue = field.defaultValue;
        if (defaultValue === null || defaultValue === undefined) {
          defaultValue = generateDefaultValue(field.type, schemaData);
        }
        
        // Validate default value against schema
        const validation = validateValueAgainstSchema(defaultValue, schemaData);
        if (!validation.isValid) {
          validationErrors.push(`Field "${field.name}": ${validation.errors.join(', ')}`);
          // Use generated default if validation fails
          defaultValue = generateDefaultValue(field.type, schemaData);
        }
        
        // Ensure description is provided
        const description = field.description || generateDescription(field.name);
        
        backendSchema[fullKey] = {
          description: description,
          default_value: defaultValue,
          schema: schemaData,
        };
      } else {
        // Fallback for fields not found (shouldn't happen but safety)
        const fieldName = key.split('.').pop() || key;
        backendSchema[fullKey] = {
          description: generateDescription(fieldName),
          default_value: generateDefaultValue(schemaData.type || 'string', schemaData),
          schema: schemaData,
        };
      }
    });

    // Show validation errors if any (optional - you might want to show these as warnings)
    if (validationErrors.length > 0) {
      console.warn('Schema validation warnings:', validationErrors);
    }

    await saveSchema(backendSchema);
  };

  // Helper functions to find field data by path
  const findFieldDescriptionByPath = (path: string): string => {
    const field = findFieldByPath(fields, path);
    return field?.description || '';
  };

  const findFieldDefaultValueByPath = (path: string): any => {
    const field = findFieldByPath(fields, path);
    return field?.defaultValue || null;
  };

  const findFieldByPath = (fieldsList: SchemaField[], path: string): SchemaField | null => {
    const pathParts = path.split('.').filter(part => part !== 'properties');
    
    for (const field of fieldsList) {
      if (pathParts.length === 1 && field.name === pathParts[0]) {
        return field;
      } else if (pathParts.length > 1 && field.name === pathParts[0] && field.children) {
        const remainingPath = pathParts.slice(1).join('.');
        const found = findFieldByPath(field.children, remainingPath);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin inline-block h-8 w-8 border-4 border-current border-t-transparent text-muted-foreground rounded-full mb-4" />
            <p className="text-muted-foreground">Loading schema...</p>
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="flex items-center justify-end">
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
                        invalidDropTarget={invalidDropTarget}
                        autoOpenEditId={autoOpenEditId}
                        setAutoOpenEditId={setAutoOpenEditId}
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
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                  {jsonError}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  <strong>Tip:</strong> You can edit the JSON schema directly here and import it, or export your current visual schema to JSON.
                </p>
                <p>
                  This follows the <a href="https://json-schema.org/specification" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">JSON Schema specification</a>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="flex gap-2 justify-end">
          <Button 
            onClick={handleSubmitChanges}
            disabled={!hasChanges || saveLoading}
            variant={hasChanges ? "default" : "secondary"}
          >
            {saveLoading ? 'Saving...' : 'Submit Changes'}
          </Button>
        </div>
        </>
      )}
      
      {/* Add Field Modal */}
      <Dialog open={isAddFieldModalOpen} onOpenChange={setIsAddFieldModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Field</DialogTitle>
            <DialogDescription>
              Configure the properties for your new field.
            </DialogDescription>
          </DialogHeader>
          <AddFieldForm 
            onSave={(fieldData) => createNewField(fieldData)}
            onCancel={() => setIsAddFieldModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
