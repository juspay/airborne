"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
import {
  BackendPropertiesResponse,
  BackendSchemaNode,
  ConfigSchemaBuilderProps,
  SchemaField,
} from "@/types/remote-configs";
import {
  convertBackendDataToFields,
  generateDefaultValue,
  generateDescription,
  generateJsonSchema,
  parseJsonSchema,
  transformSchemaToFlatFormat,
  validateValueAgainstSchema,
} from "./utils/helpers";
import { AddFieldForm, FieldEditor } from "./components/add-field-form";
import { NestedDropZone, RootDropZone } from "./components/drop-zones";

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

function SortableField({
  field,
  onUpdate,
  onDelete,
  onAddChild,
  onMoveToRoot,
  depth = 0,
  isDragOverlay = false,
  isDragging = false,
  globalDragState = false,
  invalidDropTarget = null,
  autoOpenEditId = null,
  setAutoOpenEditId,
}: SortableFieldProps) {
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
  } = useSortable({
    id: field.id,
    data: {
      type: "field",
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
      <Card
        className={`mb-3 transition-all duration-200 ${
          isDragOverlay
            ? "shadow-2xl border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800"
            : isCurrentlyDragging
              ? "opacity-50"
              : "hover:shadow-md border-transparent hover:border-gray-200 dark:hover:border-gray-600"
        }`}
      >
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
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                  <Badge variant="secondary" className="text-xs">
                    {field.type}
                  </Badge>
                  {field.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {field.arrayItemType && (
                    <Badge variant="outline" className="text-xs">
                      Array of {field.arrayItemType}
                    </Badge>
                  )}
                </div>
                {field.description && <p className="text-sm text-muted-foreground mt-1">{field.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {canHaveChildren && (
                <Button size="sm" variant="outline" onClick={() => onAddChild(field.id)} className="h-8 px-2">
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
                            const updatedChildren =
                              field.children?.map((c) => (c.id === child.id ? updatedChild : c)) || [];
                            onUpdate({ ...field, children: updatedChildren });
                          }}
                          onDelete={() => {
                            const updatedChildren = field.children?.filter((c) => c.id !== child.id) || [];
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
        { method: "GET" },
        { token, org, app }
      );

      console.log("Backend schema data:", data);

      if (data && data.properties && Object.keys(data.properties).length > 0) {
        const convertedFields = convertBackendDataToFields(data.properties);
        console.log("Converted fields:", convertedFields);
        setFields(convertedFields);
        if (onSave) {
          onSave(convertedFields);
        }
        setInitialFields([...convertedFields]);
      } else {
        console.log("No schema data found, starting with empty fields");
        setFields([]);
        setInitialFields([]);
      }
    } catch (error) {
      console.error("Error fetching schema:", error);
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
          method: "PUT",
          body: { properties: transformedSchema },
        },
        { token, org, app }
      );

      // Reset the initial state to current state
      setInitialFields([...fields]);
      setHasChanges(false);
      if (onSave) {
        onSave(fields);
      }
    } catch (error) {
      console.error("Error saving schema:", error);
    } finally {
      setSaveLoading(false);
    }
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
    const dropZoneIntersections = pointerIntersections.filter(
      (intersection: any) =>
        String(intersection.id).startsWith("drop-zone-") || String(intersection.id) === "root-drop-zone"
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
      if (field.children?.some((child) => child.id === targetId)) {
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
    if (ancestor.children.some((child) => child.id === potentialDescendantId)) {
      return true;
    }

    // Check if potentialDescendantId is a descendant of any child
    return ancestor.children.some((child) => isAncestorOf(child.id, potentialDescendantId));
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
      defaultValue:
        fieldData.defaultValue ||
        generateDefaultValue(fieldData.type || "string", { type: fieldData.type || "string" }),
      required: fieldData.required || false,
      ...fieldData,
    };

    if (newFieldParentId) {
      const updateFields = (fieldsList: SchemaField[]): SchemaField[] => {
        return fieldsList.map((field) => {
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
      return fieldsList.map((field) => {
        if (field.id === fieldId) {
          // Ensure default value and description are set when updating
          const finalField = { ...updatedField };

          // Set default value if not provided
          if (
            finalField.defaultValue === null ||
            finalField.defaultValue === undefined ||
            finalField.defaultValue === ""
          ) {
            finalField.defaultValue = generateDefaultValue(finalField.type, {
              type: finalField.type,
              enum: finalField.enumValues,
              minimum: finalField.minValue,
              maximum: finalField.maxValue,
            });
          }

          // Set description if not provided
          if (!finalField.description || finalField.description.trim() === "") {
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
        .filter((field) => field.id !== fieldId)
        .map((field) => ({
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
        .filter((field) => {
          if (field.id === fieldId) {
            fieldToMove = field;
            return false;
          }
          return true;
        })
        .map((field) => ({
          ...field,
          children: field.children ? removeAndCapture(field.children) : undefined,
        }));
    };

    let updatedFields = removeAndCapture(fields);

    if (fieldToMove) {
      if (newParentId) {
        // Add to new parent
        const addToParent = (fieldsList: SchemaField[]): SchemaField[] => {
          return fieldsList.map((field) => {
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
    const isOverDZ = String(over.id).startsWith("drop-zone-") || String(over.id) === "root-drop-zone";
    setIsOverDropZone(isOverDZ);

    const activeField = findFieldById(fields, String(active.id));
    const overField = findFieldById(fields, String(over.id));

    if (!activeField) return;

    // If we're over a drop zone, check for circular dependency
    if (String(over.id).startsWith("drop-zone-")) {
      const parentId = String(over.id).replace("drop-zone-", "");

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
    const canDropInto =
      overField.type === "object" || (overField.type === "array" && overField.arrayItemType === "object");

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
    if (String(over.id).startsWith("drop-zone-")) {
      const parentId = String(over.id).replace("drop-zone-", "");

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
    if (String(over.id) === "root-drop-zone") {
      moveFieldToParent(String(active.id), null);
      return;
    }

    const overField = findFieldById(fields, String(over.id));
    if (!overField) return;

    // Check if we're dropping on a field
    const canDropInto =
      overField.type === "object" || (overField.type === "array" && overField.arrayItemType === "object");

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
          const oldIndex = parentFields.findIndex((field) => field.id === String(active.id));
          const newIndex = parentFields.findIndex((field) => field.id === String(over.id));

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
      console.log("Failed to import JSON schema", error);
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

  const handleSubmitChanges = async () => {
    const schema = generateCurrentSchema();
    const transformedSchema = transformSchemaToFlatFormat(schema);

    // Convert to backend format with validation and defaults
    const backendSchema: Record<string, BackendSchemaNode> = {};
    const validationErrors: string[] = [];

    Object.entries(transformedSchema).forEach(([key, schemaData]) => {
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
          validationErrors.push(`Field "${field.name}": ${validation.errors.join(", ")}`);
          // Use generated default if validation fails
          defaultValue = generateDefaultValue(field.type, schemaData);
        }

        // Ensure description is provided
        const description = field.description || generateDescription(field.name);

        backendSchema[key] = {
          description: description,
          default_value: defaultValue,
          schema: schemaData,
        };
      } else {
        // Fallback for fields not found (shouldn't happen but safety)
        const fieldName = key.split(".").pop() || key;
        backendSchema[key] = {
          description: generateDescription(fieldName),
          default_value: generateDefaultValue(schemaData.type || "string", schemaData),
          schema: schemaData,
        };
      }
    });

    // Show validation errors if any (optional - you might want to show these as warnings)
    if (validationErrors.length > 0) {
      console.warn("Schema validation warnings:", validationErrors);
    }

    await saveSchema(backendSchema);
  };

  const findFieldByPath = (fieldsList: SchemaField[], path: string): SchemaField | null => {
    const pathParts = path.split(".").filter((part) => part !== "properties");

    for (const field of fieldsList) {
      if (pathParts.length === 1 && field.name === pathParts[0]) {
        return field;
      } else if (pathParts.length > 1 && field.name === pathParts[0] && field.children) {
        const remainingPath = pathParts.slice(1).join(".");
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
                      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
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
                      <Button variant="outline" onClick={exportJsonSchema} disabled={fields.length === 0}>
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
                      <strong>Tip:</strong> You can edit the JSON schema directly here and import it, or export your
                      current visual schema to JSON.
                    </p>
                    <p>
                      This follows the{" "}
                      <a
                        href="https://json-schema.org/specification"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        JSON Schema specification
                      </a>
                      .
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
              {saveLoading ? "Saving..." : "Submit Changes"}
            </Button>
          </div>
        </>
      )}

      {/* Add Field Modal */}
      <Dialog open={isAddFieldModalOpen} onOpenChange={setIsAddFieldModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Field</DialogTitle>
            <DialogDescription>Configure the properties for your new field.</DialogDescription>
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
