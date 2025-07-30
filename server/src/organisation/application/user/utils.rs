// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use crate::middleware::auth::{ADMIN, READ, WRITE};

use super::AppError;

/// Get user's highest access level within an application group
pub fn get_user_highest_level(
    groups: &[keycloak::types::GroupRepresentation],
    app_group_id: &str,
) -> Option<u8> {
    let mut highest = 0;

    for group in groups {
        if let Some(parent_id) = &group.parent_id {
            if parent_id != app_group_id {
                continue;
            }

            // Get the role name from the group name instead of path
            if let Some(role) = &group.name {
                if let Some(level) = match role.as_str() {
                    "read" => Some(READ.access),
                    "write" => Some(WRITE.access),
                    "admin" => Some(ADMIN.access),
                    _ => None,
                } {
                    highest = highest.max(level);
                }
            }
        }
    }

    if highest > 0 {
        Some(highest)
    } else {
        None
    }
}

/// Check role hierarchy to ensure requester can modify target user
pub async fn check_role_hierarchy(
    admin: &keycloak::KeycloakAdmin,
    realm: &str,
    app_group_id: &str,
    requester_id: &str,
    target_user_id: &str,
) -> Result<(), AppError> {
    if requester_id == target_user_id {
        return Ok(());
    }

    let (requester_groups_result, target_groups_result) = tokio::join!(
        admin.realm_users_with_user_id_groups_get(realm, requester_id, None, None, None, None),
        admin.realm_users_with_user_id_groups_get(realm, target_user_id, None, None, None, None)
    );

    let requester_groups = requester_groups_result
        .map_err(|e| AppError::Internal(format!("Failed to get requester groups: {}", e)))?;

    let target_groups = target_groups_result
        .map_err(|e| AppError::Internal(format!("Failed to get target user groups: {}", e)))?;

    let requester_level =
        get_user_highest_level(&requester_groups, app_group_id).ok_or_else(|| {
            AppError::Internal("Failed to determine requester's access level".to_string())
        })?;

    let target_level = get_user_highest_level(&target_groups, app_group_id).unwrap_or(0);

    if target_level > requester_level {
        return Err(AppError::PermissionDenied(
            "Cannot modify users with higher access levels".into(),
        ));
    }

    Ok(())
}

/// Validate access level string for applications (only admin, write, read)
pub fn validate_access_level(access: &str) -> Result<(String, u8), AppError> {
    match access.to_lowercase().as_str() {
        "read" => Ok(("read".to_string(), READ.access)),
        "write" => Ok(("write".to_string(), WRITE.access)),
        "admin" => Ok(("admin".to_string(), ADMIN.access)),
        _ => Err(AppError::InvalidAccessLevel(format!(
            "Invalid access level '{}'. Applications only support: read, write, admin", 
            access
        ))),
    }
}
