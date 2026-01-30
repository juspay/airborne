# Airborne API Documentation

This document provides comprehensive API specifications for the Airborne server endpoints. All endpoints return JSON responses and require proper authentication headers unless specified otherwise.

## Base URL
All API endpoints are relative to your server's base URL (e.g., `https://your-domain.com`)

## Authentication
Most endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

Additionally, some endpoints require organization and application context headers:
```
x-organisation: <organisation_name>
x-application: <application_name>
```

---

## 1. Authentication Endpoints

### 1.1 User Login
**Endpoint:** `POST /users/login`

**Description:** Authenticates a user and returns a JWT token along with user details.

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Username"
    },
    "password": {
      "type": "string",
      "description": "User password"
    }
  },
  "required": ["name", "password"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "description": "Unique user identifier"
    },
    "organisations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "applications": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "application": {
                  "type": "string"
                },
                "organisation": {
                  "type": "string"
                },
                "access": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          },
          "access": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    },
    "user_token": {
      "type": "object",
      "properties": {
        "access_token": {
          "type": "string"
        },
        "token_type": {
          "type": "string"
        },
        "expires_in": {
          "type": "integer"
        },
        "refresh_token": {
          "type": "string"
        },
        "refresh_expires_in": {
          "type": "integer"
        }
      }
    }
  }
}
```

### 1.2 User Registration
**Endpoint:** `POST /users/create`

**Description:** Creates a new user account.

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Username (must be unique)"
    },
    "password": {
      "type": "string",
      "description": "User password"
    }
  },
  "required": ["name", "password"]
}
```

**Response Schema:** Same as login response.

### 1.3 Get OAuth URL
**Endpoint:** `GET /users/oauth/url`

**Description:** Gets the OAuth URL for Google Sign-in (if enabled).

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "auth_url": {
      "type": "string",
      "description": "Google OAuth authorization URL"
    },
    "state": {
      "type": "string",
      "description": "OAuth state parameter"
    }
  }
}
```

### 1.4 OAuth Login
**Endpoint:** `POST /users/oauth/login`

**Description:** Completes OAuth login flow with authorization code.

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "OAuth authorization code"
    },
    "state": {
      "type": "string",
      "description": "OAuth state parameter (optional)"
    }
  },
  "required": ["code"]
}
```

**Response Schema:** Same as login response.

### 1.5 OAuth Signup
**Endpoint:** `POST /users/oauth/signup`

**Description:** Completes OAuth signup flow with authorization code.

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "OAuth authorization code"
    },
    "state": {
      "type": "string",
      "description": "OAuth state parameter (optional)"
    }
  },
  "required": ["code"]
}
```

**Response Schema:** Same as login response.

### 1.6 Get Current User
**Endpoint:** `GET /user`

**Description:** Retrieves details for the currently authenticated user.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>"
}
```

**Response Schema:** Same as login response (without user_token).

---

## 2. Organisation Management

### 2.1 Create Organisation
**Endpoint:** `POST /organisations/create`

**Description:** Creates a new organisation.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "maxLength": 50,
      "description": "Organisation name (must be unique)"
    }
  },
  "required": ["name"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "applications": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "access": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### 2.2 Request Organisation
**Endpoint:** `POST /organisations/request`

**Description:** Submits a request for organisation creation (when organisation creation is disabled).

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "organisation_name": {
      "type": "string",
      "description": "Requested organisation name"
    },
    "name": {
      "type": "string",
      "description": "Contact person name"
    },
    "email": {
      "type": "string",
      "description": "Contact email"
    },
    "phone": {
      "type": "string",
      "description": "Contact phone number (optional)"
    },
    "play_store_link": {
      "type": "string",
      "description": "Google Play Store link (optional)"
    },
    "app_store_link": {
      "type": "string",
      "description": "Apple App Store link (optional)"
    }
  },
  "required": ["organisation_name", "name", "email"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "organisation_name": {
      "type": "string"
    },
    "message": {
      "type": "string"
    }
  }
}
```

### 2.3 List Organisations
**Endpoint:** `GET /organisations`

**Description:** Lists all organisations that the authenticated user has access to.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>"
}
```

**Response Schema:**
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "applications": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "application": {
              "type": "string"
            },
            "organisation": {
              "type": "string"
            },
            "access": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        }
      },
      "access": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  }
}
```

### 2.4 Delete Organisation
**Endpoint:** `DELETE /organisations/{organisation_name}`

**Description:** Deletes an organisation (requires admin permissions).

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>"
}
```

**Path Parameters:**
- `organisation_name`: Name of the organisation to delete

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "Success": {
      "type": "string",
      "description": "Success message"
    }
  }
}
```

---

## 3. Application Management

### 3.1 Create Application
**Endpoint:** `POST /organisations/applications/create`

**Description:** Creates a new application within an organisation.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "application": {
      "type": "string",
      "description": "Application name"
    }
  },
  "required": ["application"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "application": {
      "type": "string"
    },
    "organisation": {
      "type": "string"
    },
    "access": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

---

## 4. User Management

### 4.1 Create Organisation User
**Endpoint:** `POST /organisation/user/create`

**Description:** Adds a user to an organisation with specified access level.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "user": {
      "type": "string",
      "description": "Username to add"
    },
    "access": {
      "type": "string",
      "enum": ["owner", "admin", "write", "read"],
      "description": "Access level for the user"
    }
  },
  "required": ["user", "access"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "message": {
      "type": "string"
    }
  }
}
```

### 4.2 Update Organisation User
**Endpoint:** `POST /organisation/user/update`

**Description:** Updates a user's access level in an organisation.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "user": {
      "type": "string",
      "description": "Username to update"
    },
    "access": {
      "type": "string",
      "enum": ["owner", "admin", "write", "read"],
      "description": "New access level for the user"
    }
  },
  "required": ["user", "access"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "message": {
      "type": "string"
    }
  }
}
```

### 4.3 Remove Organisation User
**Endpoint:** `POST /organisation/user/remove`

**Description:** Removes a user from an organisation.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "user": {
      "type": "string",
      "description": "Username to remove"
    }
  },
  "required": ["user"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "message": {
      "type": "string"
    }
  }
}
```

### 4.4 List Organisation Users
**Endpoint:** `GET /organisation/user`

**Description:** Lists all users in an organisation with their access levels.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>"
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "users": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "user": {
            "type": "string"
          },
          "access": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

---

## 5. File Management

### 5.1 Create File
**Endpoint:** `POST /file`

**Description:** Creates a new file entry by providing a URL.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description": "File path identifier"
    },
    "url": {
      "type": "string",
      "description": "URL where the file can be downloaded"
    },
    "tag": {
      "type": "string",
      "description": "Tag for the file (e.g., 'latest', 'stable')"
    },
    "metadata": {
      "type": "object",
      "description": "Additional metadata for the file (optional)"
    }
  },
  "required": ["file_path", "url", "tag"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "File identifier in format 'file_path@version:version_number'"
    },
    "file_path": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "version": {
      "type": "integer"
    },
    "tag": {
      "type": "string"
    },
    "size": {
      "type": "integer"
    },
    "checksum": {
      "type": "string"
    },
    "metadata": {
      "type": "object"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "ready"]
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### 5.2 Bulk Create Files
**Endpoint:** `POST /file/bulk`

**Description:** Creates multiple file entries at once.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "tag": {
            "type": "string"
          },
          "metadata": {
            "type": "object"
          }
        },
        "required": ["file_path", "url", "tag"]
      }
    },
    "skip_duplicates": {
      "type": "boolean",
      "description": "Whether to skip files that already exist"
    }
  },
  "required": ["files", "skip_duplicates"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "created_files": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/FileResponse"
      }
    },
    "skipped_files": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "total_created": {
      "type": "integer"
    },
    "total_skipped": {
      "type": "integer"
    }
  }
}
```

### 5.3 Get File
**Endpoint:** `GET /file`

**Description:** Gets details of a specific file.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Query Parameters:**
- `file_key`: File identifier in format `file_path@version:version_number` or `file_path@tag:tag_name`

**Response Schema:** Same as file creation response.

### 5.4 List Files
**Endpoint:** `GET /file/list`

**Description:** Lists all files for an application with pagination and search.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `count` (optional): Items per page default: 10
- `search` (optional): Search term to filter files

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "files": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/FileResponse"
      }
    },
    "total_items": {
      "type": "integer",
      "description": "Total number of files"
    },
    "total_pages": {
      "type": "integer",
       "description": "Total number of pages"
    }
  }
}
```

### 5.5 Update File Tag
**Endpoint:** `PATCH /file/{file_key}`

**Description:** Updates the tag of an existing file.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `file_key`: File identifier in format `file_path@version:version_number` or `file_path@tag:tag_name`

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "tag": {
      "type": "string",
      "description": "New tag for the file"
    }
  },
  "required": ["tag"]
}
```

**Response Schema:** Same as file creation response.

---

## 6. Package Management

### 6.1 Create Package
**Endpoint:** `POST /packages`

**Description:** Creates a new package containing multiple files.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "index": {
      "type": "string",
      "description": "Package index file path"
    },
    "tag": {
      "type": "string",
      "description": "Package tag"
    },
    "files": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Array of file identifiers (file_path@version:X or file_path@tag:X)"
    }
  },
  "required": ["index", "tag", "files"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "index": {
      "type": "string"
    },
    "tag": {
      "type": "string"
    },
    "version": {
      "type": "integer"
    },
    "files": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### 6.2 List Packages
**Endpoint:** `GET /packages/list`

**Description:** Lists packages for an application with pagination.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Query Parameters:**
- `pages` (optional): Number of page (default: 1)
- `count` (optional): Number of items per page (default: 50)
- `search` (optional): Search index file name to filter packages
- `all` (optional): If true, fetches all packages without pagination

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "data": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Package"
      }
    },
    "total_items": {
      "type": "integer",
      "example": 125
    },
    "total_pages": {
      "type": "integer",
      "example": 13
    }
  }
}
```

### 6.3 Get Individual Package
**Endpoint:** `GET /packages`

**Description:** Gets details of a specific package.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Query Parameters:**
- `package_key`: Package identifier in format `tag:tag_name` or `version:version_number`

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "index": {
      "type": "string"
    },
    "tag": {
      "type": "string"
    },
    "version": {
      "type": "integer"
    },
    "files": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

---

## 7. Dimension Management

### 7.1 Create Dimension
**Endpoint:** `POST /organisations/applications/dimension/create`

**Description:** Creates a new dimension for application configuration. Supports both standard dimensions and cohort dimensions.

- **Standard dimensions**: Regular dimensions with custom schemas for feature flags, configuration values, etc.
- **Cohort dimensions**: Special dimensions for user segmentation based on version ranges or group memberships. When created, they automatically generate a default schema and can be managed through the cohort-specific endpoints.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "dimension": {
      "type": "string",
      "description": "Dimension name"
    },
    "schema": {
      "type": "object",
      "description": "JSON schema for dimension validation (optional for cohort dimensions)"
    },
    "description": {
      "type": "string",
      "description": "Description of the dimension"
    },
    "dimension_type": {
      "type": "string",
      "enum": ["standard", "cohort"],
      "description": "Type of dimension to create (default: 'standard')"
    },
    "depends_on": {
      "type": "string",
      "description": "Required for cohort dimensions - the dimension this cohort depends on"
    }
  },
  "required": ["dimension", "description"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "dimension": {
      "type": "string"
    },
    "position": {
      "type": "integer"
    },
    "schema": {
      "type": "object"
    },
    "description": {
      "type": "string"
    },
    "change_reason": {
      "type": "string"
    }
  }
}
```

**Examples:**

1. **Creating a standard dimension:**
   ```json
   {
     "dimension": "feature_flags",
     "schema": {
       "type": "object",
       "properties": {
         "enabled": {"type": "boolean"}
       }
     },
     "description": "Feature flag configuration"
   }
   ```

2. **Creating a cohort dimension:**
   ```json
   {
     "dimension": "user_version_cohort",
     "dimension_type": "cohort",
     "depends_on": "app_version",
     "description": "User segmentation based on app version"
   }
   ```

### 7.2 List Dimensions
**Endpoint:** `GET /organisations/applications/dimension/list`

**Description:** Lists all dimensions for an application.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Query Parameters:**
- `page` (optional): Page number
- `count` (optional): Items per page

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "total_pages": {
      "type": "integer"
    },
    "total_items": {
      "type": "integer"
    },
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "dimension": {
            "type": "string"
          },
          "position": {
            "type": "integer"
          },
          "schema": {
            "type": "object"
          },
          "description": {
            "type": "string"
          },
          "change_reason": {
            "type": "string"
          },
          "mandatory": {
            "type": "boolean"
          }
        }
      }
    }
  }
}
```

### 7.3 Update Dimension
**Endpoint:** `PUT /organisations/applications/dimension/{dimension_name}`

**Description:** Updates a dimension's properties.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `dimension_name`: Name of the dimension to update

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "position": {
      "type": "integer",
      "description": "New position for the dimension (optional)"
    },
    "change_reason": {
      "type": "string",
      "description": "Reason for the change"
    }
  },
  "required": ["change_reason"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "dimension": {
      "type": "string"
    },
    "position": {
      "type": "integer"
    },
    "schema": {
      "type": "object"
    },
    "description": {
      "type": "string"
    },
    "change_reason": {
      "type": "string"
    },
    "mandatory": {
      "type": "boolean"
    }
  }
}
```

### 7.4 Delete Dimension
**Endpoint:** `DELETE /organisations/applications/dimension/{dimension_name}`

**Description:** Deletes a dimension from the application.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `dimension_name`: Name of the dimension to delete

**Response Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

---

## 8. Cohort Dimension Management

Cohort dimensions allow you to segment users based on version ranges or group memberships. They support both checkpoint-based segmentation (using version comparisons) and group-based segmentation (using explicit member lists).

### 8.1 List Cohort Schema
**Endpoint:** `GET /organisations/applications/dimension/{cohort_dimension_name}/cohort`

**Description:** Retrieves the schema and configuration of a cohort dimension.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `cohort_dimension_name`: Name of the cohort dimension

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "description": "Schema type (typically 'string')"
    },
    "enum": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Array of cohort names in priority order"
    },
    "definitions": {
      "type": "object",
      "description": "Map of cohort names to their JSON Logic definitions",
      "additionalProperties": {
        "type": "object",
        "description": "JSON Logic rules defining cohort membership"
      }
    }
  }
}
```

### 8.2 Create Cohort Checkpoint
**Endpoint:** `POST /organisations/applications/dimension/{cohort_dimension_name}/cohort/checkpoint`

**Description:** Creates a checkpoint cohort that segments users based on version comparisons (e.g., users with app version >= 2.1.0).

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `cohort_dimension_name`: Name of the cohort dimension

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Name of the cohort checkpoint"
    },
    "value": {
      "type": "string",
      "description": "Version or string value to compare against"
    },
    "comparator": {
      "type": "string",
      "enum": ["semver_gt", "semver_ge", "str_gt", "str_ge"],
      "description": "Comparison operator: semver_gt (>), semver_ge (>=), str_gt (>), str_ge (>=)"
    }
  },
  "required": ["name", "value", "comparator"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "value": {
      "type": "string"
    },
    "comparator": {
      "type": "string"
    }
  }
}
```

### 8.3 Create Cohort Group  
**Endpoint:** `POST /organisations/applications/dimension/{cohort_dimension_name}/cohort/group`

**Description:** Creates a group cohort that segments users based on explicit membership lists (e.g., beta testers, VIP users).

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `cohort_dimension_name`: Name of the cohort dimension

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Name of the cohort group"
    },
    "members": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of user identifiers that belong to this cohort"
    }
  },
  "required": ["name", "members"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "members": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### 8.4 Get Cohort Group Priority
**Endpoint:** `GET /organisations/applications/dimension/{cohort_dimension_name}/cohort/group/priority`

**Description:** Retrieves the priority ordering of cohort groups. Groups with lower priority values are evaluated first.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `cohort_dimension_name`: Name of the cohort dimension

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "priority_map": {
      "type": "object",
      "description": "Map of cohort group names to their priority values (0 = highest priority)",
      "additionalProperties": {
        "type": "integer"
      }
    }
  }
}
```

### 8.5 Update Cohort Group Priority
**Endpoint:** `PUT /organisations/applications/dimension/{cohort_dimension_name}/cohort/group/priority`

**Description:** Updates the priority ordering of cohort groups. This affects the order in which groups are evaluated for user segmentation.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `cohort_dimension_name`: Name of the cohort dimension

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "priority_map": {
      "type": "object",
      "description": "Map of cohort group names to their new priority values (0 = highest priority)",
      "additionalProperties": {
        "type": "integer",
        "minimum": 0
      }
    }
  },
  "required": ["priority_map"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "priority_map": {
      "type": "object",
      "additionalProperties": {
        "type": "integer"
      }
    }
  }
}
```

**Example Usage:**

1. **Creating a version-based cohort:**
   ```bash
   # Create a checkpoint for users with version >= 2.1.0
   POST /organisations/applications/dimension/app_version/checkpoint
   {
     "name": "v2_1_users",
     "value": "2.1.0", 
     "comparator": "semver_ge"
   }
   ```

2. **Creating a user group cohort:**
   ```bash
   # Create a cohort for beta testers
   POST /organisations/applications/dimension/user_segment/group
   {
     "name": "beta_testers",
     "members": ["user1", "user2", "user3"]
   }
   ```

3. **Updating group priorities:**
   ```bash
   # Set beta_testers as highest priority (0) and vip_users as second (1)
   PUT /organisations/applications/dimension/user_segment/group/priority
   {
     "priority_map": {
       "beta_testers": 0,
       "vip_users": 1
     }
   }
   ```

---

## 9. Release Management

### 9.1 Create Release
**Endpoint:** `POST /releases`

**Description:** Creates a new release with configuration and package details.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "config": {
      "type": "object",
      "description": "Release configuration (optional)"
    },
    "package_id": {
      "type": "string",
      "description": "Package identifier (optional)"
    },
    "package": {
      "type": "object",
      "properties": {
        "properties": {
          "type": "object",
          "description": "Package properties (optional)"
        },
        "important": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Important files list (optional)"
        },
        "lazy": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Lazy-loaded files list (optional)"
        }
      }
    },
    "dimensions": {
      "type": "object",
      "description": "Dimension context for the release (optional)"
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Resource files list (optional)"
    }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Release identifier"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "config": {
      "type": "object",
      "properties": {
        "boot_timeout": {
          "type": "integer"
        },
        "package_timeout": {
          "type": "integer"
        }
      }
    },
    "package": {
      "type": "object",
      "properties": {
        "version": {
          "type": "integer"
        },
        "index": {
          "type": "object",
          "properties": {
            "file_path": {
              "type": "string"
            },
            "url": {
              "type": "string"
            },
            "checksum": {
              "type": "string"
            }
          }
        },
        "properties": {
          "type": "object"
        },
        "important": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "file_path": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "checksum": {
                "type": "string"
              }
            }
          }
        },
        "lazy": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "file_path": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "checksum": {
                "type": "string"
              }
            }
          }
        }
      }
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "checksum": {
            "type": "string"
          }
        }
      }
    },
    "experiment": {
      "type": "object",
      "properties": {
        "experiment_id": {
          "type": "string"
        },
        "package_version": {
          "type": "integer"
        },
        "config_version": {
          "type": "string"
        },
        "created_at": {
          "type": "string"
        },
        "traffic_percentage": {
          "type": "integer"
        },
        "status": {
          "type": "string"
        }
      }
    }
  }
}
```

### 9.2 List Releases
**Endpoint:** `GET /releases/list`

**Description:** Lists all releases for an application.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Query Parameters:**
- `pages` (optional): Number of page (default: 1)
- `count` (optional): Number of items per page (default: 50)
- `status` (optional): Filter by status of release
- `all` (optional): If true, fetches all packages without pagination


**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "data": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/CreateReleaseResponse"
      }
    },
    "total_items": {
      "type": "integer",
      "example": 125
    },
    "total_pages": {
      "type": "integer",
      "example": 13
    }
  }
}
```

### 9.3 Get Individual Release
**Endpoint:** `GET /releases/{release_id}`

**Description:** Gets details of a specific release.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `release_id`: Release identifier

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "experiment_id": {
      "type": "string"
    },
    "org_id": {
      "type": "string"
    },
    "app_id": {
      "type": "string"
    },
    "package_version": {
      "type": "integer"
    },
    "config_version": {
      "type": "string"
    },
    "created_at": {
      "type": "string"
    },
    "traffic_percentage": {
      "type": "integer"
    },
    "status": {
      "type": "string",
      "enum": ["CREATED", "INPROGRESS", "CONCLUDED", "DISCARDED"]
    },
    "variants": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "variant_type": {
            "type": "string",
            "enum": ["control", "experimental"]
          }
        }
      }
    },
    "configuration": {
      "type": "object",
      "properties": {
        "package": {
          "type": "object",
          "properties": {
            "properties": {
              "type": "object"
            },
            "important": {
              "type": "array"
            },
            "lazy": {
              "type": "array"
            }
          }
        },
        "resources": {
          "type": "array"
        }
      }
    }
  }
}
```

### 9.4 Ramp Release
**Endpoint:** `POST /releases/{release_id}/ramp`

**Description:** Updates the traffic percentage for a release experiment.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `release_id`: Release identifier

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "traffic_percentage": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100,
      "description": "Percentage of traffic to route to the experimental variant"
    },
    "change_reason": {
      "type": "string",
      "description": "Reason for ramping the release (optional)"
    }
  },
  "required": ["traffic_percentage"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "message": {
      "type": "string"
    },
    "experiment_id": {
      "type": "string"
    },
    "traffic_percentage": {
      "type": "integer"
    }
  }
}
```

### 9.5 Conclude Release
**Endpoint:** `POST /releases/{release_id}/conclude`

**Description:** Concludes a release experiment by choosing a winning variant.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Path Parameters:**
- `release_id`: Release identifier

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "chosen_variant": {
      "type": "string",
      "description": "ID of the variant to make the winner"
    },
    "change_reason": {
      "type": "string",
      "description": "Reason for concluding the release (optional)"
    }
  },
  "required": ["chosen_variant"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "message": {
      "type": "string"
    }
  }
}
```

### 9.6 Serve Release Configuration (Public)
**Endpoint:** `GET /release/{organisation}/{application}`

**Description:** Public endpoint that serves the live release configuration for client SDKs. No authentication required.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-dimensions": "<json_string_of_dimension_context>"
}
```

**Path Parameters:**
- `organisation`: Organisation name
- `application`: Application name

**Required Headers:**
- `x-dimensions`: JSON string containing dimension context (e.g., `{"version": "1.0", "platform": "android"}`)

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "version": {
      "type": "string"
    },
    "config": {
      "type": "object",
      "properties": {
        "version": {
          "type": "integer"
        },
        "boot_timeout": {
          "type": "integer"
        },
        "package_timeout": {
          "type": "integer"
        },
        "properties": {
          "type": "object"
        }
      }
    },
    "package": {
      "type": "object",
      "properties": {
        "version": {
          "type": "integer"
        },
        "index": {
          "type": "string"
        },
        "properties": {
          "type": "object"
        },
        "important": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string"
              },
              "file_path": {
                "type": "string"
              }
            }
          }
        },
        "lazy": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string"
              },
              "file_path": {
                "type": "string"
              }
            }
          }
        }
      }
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string"
          },
          "file_path": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

---

## 10. Configuration Management

### 10.1 Create Configuration
**Endpoint:** `POST /organisations/applications/config/create`

**Description:** Creates application configuration.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>",
  "x-organisation": "<organisation_name>",
  "x-application": "<application_name>"
}
```

**Request Body Schema:**
```json
{
  "type": "object",
  "properties": {
    "config": {
      "type": "object",
      "properties": {
        "version": {
          "type": "string"
        }
      },
      "required": ["version"]
    },
    "tenant_info": {
      "type": "object",
      "description": "Tenant information (optional)"
    },
    "properties": {
      "type": "object",
      "description": "Configuration properties (optional)"
    }
  },
  "required": ["config"]
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "config_id": {
      "type": "string"
    }
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "Error": "Descriptive error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized message"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "Resource already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

---

## Notes

1. **Authentication**: Most endpoints require a valid JWT token obtained from the login endpoints.

2. **Organization/Application Context**: Many endpoints require `x-organisation` and `x-application` headers to specify the context.

3. **File Keys**: File identifiers use the format `file_path@version:version_number` or `file_path@tag:tag_name`.

4. **Package Keys**: Package identifiers use the format `tag:tag_name` or `version:version_number`.

5. **Pagination**: List endpoints support pagination with `page`, `per_page`, `offset`, and `limit` parameters.

6. **Search**: File listing supports search functionality via the `search` query parameter.

7. **OAuth**: Google OAuth endpoints are only available when `ENABLE_GOOGLE_SIGNIN` is set to `true`.

8. **Organization Creation**: The `/organisations/request` endpoint is used when `ORGANISATION_CREATION_DISABLED` is `true`.

9. **Cohort Dimensions**: Cohort dimensions support two types of segmentation:
    - **Checkpoints**: Version-based segmentation using comparators (semver_gt, semver_ge, str_gt, str_ge)
    - **Groups**: Explicit member-based segmentation using user ID lists
    
10. **Cohort Priority**: Group cohorts are evaluated in priority order (0 = highest priority). Users are assigned to the first matching group in priority order.
