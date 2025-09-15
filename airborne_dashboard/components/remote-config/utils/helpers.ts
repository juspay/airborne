import { BackendSchemaNode, ConfigValue, SchemaField, ValidationError } from "@/types/remote-configs";
import Ajv from "ajv";

// Helper function to generate unique IDs
export function generateId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to generate default values based on schema type
export function generateDefaultValue(type: string, schema: any): any {
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
export function generateDescription(fieldName: string): string {
  // Convert camelCase or snake_case to readable format
  const readable = fieldName
    .replace(/([A-Z])/g, " $1") // Add space before uppercase letters
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();

  return readable;
}

// Schema validation function
export function validateValueAgainstSchema(value: any, schema: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (value === null || value === undefined) {
    return { isValid: true, errors: [] }; // Allow null/undefined values
  }

  // Type validation
  const actualType = Array.isArray(value) ? "array" : typeof value;
  if (schema.type && actualType !== schema.type) {
    errors.push(`Expected type ${schema.type}, but got ${actualType}`);
  }

  // String validations
  if (schema.type === "string" && typeof value === "string") {
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
      errors.push(`Value "${value}" is not in allowed enum values: ${schema.enum.join(", ")}`);
    }
  }

  // Number validations
  if (schema.type === "number" && typeof value === "number") {
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
export function generateJsonSchema(fields: SchemaField[]): any {
  const properties: any = {};
  const required: string[] = [];

  fields.forEach((field) => {
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
export function parseJsonSchema(schema: any): SchemaField[] {
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

export const convertBackendDataToFields = (properties: Record<string, BackendSchemaNode>): SchemaField[] => {
  const fieldMap = new Map<string, SchemaField>();
  const rootFields: SchemaField[] = [];

  // Sort keys to ensure proper hierarchy building
  const sortedKeys = Object.keys(properties).sort();

  sortedKeys.forEach((key) => {
    const node = properties[key];
    const cleanPath = key.split(".");

    const fieldName = cleanPath[cleanPath.length - 1];
    const fieldType = (node.schema.type || "string") as SchemaField["type"];

    // Generate default value if not provided
    const defaultValue =
      node.default_value !== null && node.default_value !== undefined
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
      let currentPath = "config.properties";
      let currentParent: SchemaField | null = null;

      for (let i = 0; i < cleanPath.length - 1; i++) {
        currentPath += "." + cleanPath[i];
        let parentField = fieldMap.get(currentPath);

        if (!parentField) {
          // Create parent field if it doesn't exist
          parentField = {
            id: generateId(),
            name: cleanPath[i],
            type: "object",
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

// Transform schema to dot notation format
export const transformSchemaToFlatFormat = (schema: any): Record<string, any> => {
  const result: Record<string, any> = {};

  const traverseSchema = (obj: any, path: string = "") => {
    if (obj.type === "object" && obj.properties) {
      const hasNonObjectProperties = Object.values(obj.properties).some(
        (prop: any) => prop.type !== "object" || !prop.properties
      );

      if (hasNonObjectProperties) {
        // If this object has non-object properties, add them with dot notation
        Object.entries(obj.properties).forEach(([key, prop]: [string, any]) => {
          const fullPath = path ? `${path}.${key}` : `${key}`;

          if (prop.type === "object" && prop.properties) {
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

  console.log("Transformed schema", result);

  return result;
};

// Convert dotted notation values to nested object structure
export function convertDottedToNestedObject(dottedValues: Record<string, any>): any {
  const result: any = {};

  Object.entries(dottedValues).forEach(([key, value]) => {
    const keys = key.split(".");
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      if (!current[currentKey]) {
        current[currentKey] = {};
      }
      current = current[currentKey];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  });

  return result;
}

// Validate all remote config values against their schema fields
export function validateAllRemoteConfigValues(
  remoteConfigValues: Record<string, any>,
  schemaFields: SchemaField[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Helper function to validate a field and its children
  const validateField = (field: SchemaField, path: string = ""): void => {
    const fieldPath = path ? `${path}.${field.name}` : field.name;
    const value = remoteConfigValues[fieldPath];

    // Check if required field is missing
    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`${fieldPath}: Required field is missing`);
      return;
    }

    // If value exists, validate it
    if (value !== undefined && value !== null && value !== "") {
      const schema = {
        type: field.type,
        minLength: field.minLength,
        maxLength: field.maxLength,
        minimum: field.minValue,
        maximum: field.maxValue,
        pattern: field.pattern,
        enum: field.enumValues,
      };

      const validation = validateValueAgainstSchema(value, schema);
      if (!validation.isValid) {
        validation.errors.forEach((error) => {
          errors.push(`${fieldPath}: ${error}`);
        });
      }
    }

    // Validate children if they exist
    if (field.children && field.children.length > 0) {
      field.children.forEach((childField) => {
        validateField(childField, fieldPath);
      });
    }
  };

  // Validate all fields
  schemaFields.forEach((field) => {
    validateField(field);
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateConfigValue(config: ConfigValue, schema: SchemaField[]): ValidationError[] {
  const jsonSchema = generateJsonSchema(schema);
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(jsonSchema);
  const valid = validate(config);

  if (valid) {
    return [];
  }

  return (validate.errors || []).map((error) => ({
    field: error.instancePath || "root",
    message: error.message || "Validation error",
  }));
}
