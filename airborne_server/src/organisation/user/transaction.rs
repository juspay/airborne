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

use actix_web::web;
use keycloak::KeycloakAdmin;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};

use crate::{
    organisation::user::OrgError,
    types::AppState,
    utils::{
        keycloak::{find_org_group, find_role_subgroup},
        transaction_manager::{record_failed_cleanup, TransactionManager},
    },
};

use super::{OrgContext, UserContext};

/// Represents the operation being performed on a user in an organization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserOperation {
    Add,
    Update,
    Remove,
}

/// Add a user to an organization with transaction management
pub async fn add_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    target_user: &UserContext,
    role_name: &str,
    // state: &web::Data<AppState>,
) -> Result<(), OrgError> {
    // Create a new transaction manager for this operation
    let transaction = TransactionManager::new(&org_context.org_id, "organization_user");

    debug!(
        "Starting transaction to add user {} to org {} with role {}",
        target_user.username, org_context.org_id, role_name
    );

    let org_group = find_org_group(admin, realm, &org_context.org_id)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find organization group: {}", e)))?
        .ok_or_else(|| {
            OrgError::Internal(format!(
                "Organization group {} not found",
                org_context.org_id
            ))
        })?;

    let mut roles = get_additional_roles(role_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get additional roles: {}", e)))?;

    roles.push(role_name.to_string());

    for role_name in roles.clone() {
        add_user_to_group(
            admin,
            realm,
            &target_user.user_id,
            &org_context.group_id,
            &role_name,
            &transaction,
        )
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to add user to group: {}", e)))?;
    }

    if role_name == "admin" {
        info!("Let's update the subgroups");
        match admin
            .realm_groups_with_group_id_children_get(
                realm,
                &org_context.group_id,
                None,
                None,
                None,
                org_group.sub_group_count.map(|v| v as i32),
                None,
            )
            .await
        {
            Ok(groups) => {
                // Record the user groups in the transaction
                let child_roles = roles
                    .clone()
                    .iter()
                    .filter(|role| **role != "owner")
                    .cloned()
                    .collect::<Vec<_>>();
                // remove groups that are roles
                let groups: Vec<_> = groups
                    .into_iter()
                    .filter(|g| {
                        if let Some(name) = &g.name {
                            let roles = ["admin", "write", "read", "owner"];
                            !roles.contains(&name.as_str())
                        } else {
                            true
                        }
                    })
                    .collect();
                for group in groups {
                    for role_name in child_roles.iter() {
                        match group.id {
                            Some(ref group_id) => {
                                add_user_to_group(
                                    admin,
                                    realm,
                                    &target_user.user_id,
                                    group_id,
                                    role_name,
                                    &transaction,
                                )
                                .await
                                .map_err(|e| {
                                    OrgError::Internal(format!(
                                        "Failed to add user to group: {}",
                                        e
                                    ))
                                })?;
                            }
                            None => warn!("Group has no ID, skipping"),
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Failed to get user groups after adding user: {}. This may not be critical.",
                    e
                );
            }
        }
    }
    // Mark the transaction as complete since there are no database or Superposition resources involved
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to add user {} to org {} with role {}",
        target_user.username, org_context.org_id, role_name
    );

    Ok(())
}

/// Roles come with additional roles like Owner has Admin, Write, Read
/// This function retrieves those additional roles for a given role name
async fn get_additional_roles(role_name: &str) -> Result<Vec<String>, OrgError> {
    let additional_roles = match role_name {
        "owner" => vec!["admin".to_string(), "write".to_string(), "read".to_string()],
        "admin" => vec!["write".to_string(), "read".to_string()],
        "write" => vec!["read".to_string()],
        _ => vec![],
    };

    if additional_roles.is_empty() && role_name != "read" {
        return Err(OrgError::Internal(format!(
            "No additional roles found for role {}",
            role_name
        )));
    }

    Ok(additional_roles)
}

async fn add_user_to_group(
    admin: &KeycloakAdmin,
    realm: &str,
    user_id: &str,
    group_id: &str,
    role_name: &str,
    transaction: &TransactionManager,
) -> Result<(), OrgError> {
    // Find the role group
    let role_group = find_role_subgroup(admin, realm, group_id, role_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find role group: {}", e)))?
        .ok_or_else(|| OrgError::Internal(format!("Role group {} not found", role_name)))?;

    let role_group_id = role_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("Role group has no ID".to_string()))?
        .to_string();

    // Step 1: Add user to role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_put(realm, user_id, &role_group_id)
        .await
    {
        Ok(_) => {
            // Record this resource in the transaction
            transaction.add_keycloak_resource(
                "user_group_membership",
                &format!("{}:{}", user_id, role_group_id),
            );
            debug!("Added user {} to role group {}", user_id, role_name);
        }
        Err(e) => {
            // If this fails, there's nothing to roll back yet
            return Err(OrgError::Internal(format!(
                "Failed to add user to role group: {}",
                e
            )));
        }
    }
    Ok(())
}

async fn remove_user_from_group(
    admin: &KeycloakAdmin,
    realm: &str,
    user_id: &str,
    group_id: &str,
    role_name: &str,
    transaction: &TransactionManager,
) -> Result<(), OrgError> {
    // Find the role group
    let role_group = find_role_subgroup(admin, realm, group_id, role_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find role group: {}", e)))?
        .ok_or_else(|| OrgError::Internal(format!("Role group {} not found", role_name)))?;

    let role_group_id = role_group
        .id
        .as_ref()
        .ok_or_else(|| OrgError::Internal("Role group has no ID".to_string()))?
        .to_string();

    // Step 1: Remove user to role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_delete(realm, user_id, &role_group_id)
        .await
    {
        Ok(_) => {
            // Record this resource in the transaction
            transaction.add_keycloak_resource(
                "user_group_membership",
                &format!("{}:{}", user_id, role_group_id),
            );
        }
        Err(e) => {
            // If this fails, there's nothing to roll back yet
            return Err(OrgError::Internal(format!(
                "Failed to remove user from role group: {}",
                e
            )));
        }
    }
    Ok(())
}
/// Update a user's role in an organization with transaction management
pub async fn update_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    target_user: &UserContext,
    new_role_name: &str,
    current_role: &str,
    _state: &web::Data<AppState>,
) -> Result<(), OrgError> {
    let transaction = TransactionManager::new(&org_context.org_id, "organization_user_update");

    let mut new_roles = get_additional_roles(new_role_name)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get additional roles: {}", e)))?;
    new_roles.push(new_role_name.to_string());

    let mut current_roles = get_additional_roles(current_role)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get additional roles: {}", e)))?;
    current_roles.push(current_role.to_string());

    let to_add: Vec<_> = new_roles
        .iter()
        .filter(|r| !current_roles.contains(r))
        .cloned()
        .collect();

    let to_remove: Vec<_> = current_roles
        .iter()
        .filter(|r| !new_roles.contains(r))
        .cloned()
        .collect();

    for role_name in &to_add {
        add_user_to_group(
            admin,
            realm,
            &target_user.user_id,
            &org_context.group_id,
            role_name,
            &transaction,
        )
        .await
        .map_err(|e| {
            OrgError::Internal(format!(
                "Failed to add user to group '{}': {}",
                role_name, e
            ))
        })?;
    }

    for role_name in &to_remove {
        remove_user_from_group(
            admin,
            realm,
            &target_user.user_id,
            &org_context.group_id,
            role_name,
            &transaction,
        )
        .await
        .map_err(|e| {
            OrgError::Internal(format!(
                "Failed to remove user from group '{}': {}",
                role_name, e
            ))
        })?;
    }

    let org_group = find_org_group(admin, realm, &org_context.org_id)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to find organization group: {}", e)))?
        .ok_or_else(|| {
            OrgError::Internal(format!(
                "Organization group {} not found",
                org_context.org_id
            ))
        })?;

    if new_role_name == "admin" {
        match admin
            .realm_groups_with_group_id_children_get(
                realm,
                &org_context.group_id,
                None,
                None,
                None,
                org_group.sub_group_count.map(|v| v as i32),
                None,
            )
            .await
        {
            Ok(groups) => {
                // Record the user groups in the transaction
                let child_roles = new_roles
                    .clone()
                    .iter()
                    .filter(|role| **role != "owner")
                    .cloned()
                    .collect::<Vec<_>>();
                // remove groups that are roles
                let groups: Vec<_> = groups
                    .into_iter()
                    .filter(|g| {
                        if let Some(name) = &g.name {
                            let roles = ["admin", "write", "read", "owner"];
                            !roles.contains(&name.as_str())
                        } else {
                            true
                        }
                    })
                    .collect();
                for group in groups {
                    for role_name in child_roles.iter() {
                        match group.id {
                            Some(ref group_id) => {
                                add_user_to_group(
                                    admin,
                                    realm,
                                    &target_user.user_id,
                                    group_id,
                                    role_name,
                                    &transaction,
                                )
                                .await
                                .map_err(|e| {
                                    OrgError::Internal(format!(
                                        "Failed to add user to group: {}",
                                        e
                                    ))
                                })?;
                            }
                            None => warn!("Group has no ID, skipping"),
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Failed to get user groups after adding user: {}. This may not be critical.",
                    e
                );
            }
        }
    }

    transaction.set_database_inserted();

    Ok(())
}
/// Remove a user from an organization with transaction management
pub async fn remove_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    target_user: &UserContext,
    user_groups: &[keycloak::types::GroupRepresentation],
    state: &web::Data<AppState>,
) -> Result<(), OrgError> {
    // Create a new transaction manager
    let transaction = TransactionManager::new(&org_context.org_id, "organization_user_remove");

    debug!(
        "Starting transaction to remove user {} from org {}",
        target_user.username, org_context.org_id
    );

    // Filter groups that belong to this organization
    let org_path = format!("/{}/", org_context.org_id);
    let org_groups: Vec<_> = user_groups
        .iter()
        .filter(|g| g.path.as_ref().is_some_and(|p| p.contains(&org_path)))
        .collect();

    if org_groups.is_empty() {
        return Err(OrgError::Internal(format!(
            "User {} is not a member of any groups in organization {}",
            target_user.username, org_context.org_id
        )));
    }

    // Keep track of groups we've removed the user from (for potential rollback)
    let mut removed_groups = Vec::new();

    // Remove user from all organization groups
    for group in org_groups {
        if let (Some(path), Some(group_id)) = (&group.path, &group.id) {
            debug!(
                "Removing user {} from group: {}",
                target_user.username, path
            );

            match admin
                .realm_users_with_user_id_groups_with_group_id_delete(
                    realm,
                    &target_user.user_id,
                    group_id,
                )
                .await
            {
                Ok(_) => {
                    debug!("Successfully removed user from group: {}", path);
                    removed_groups.push(group.clone());
                    transaction.add_keycloak_resource(
                        "user_group_removal",
                        &format!("{}:{}", target_user.user_id, group_id),
                    );
                }
                Err(e) => {
                    warn!(
                        "Failed to remove user from group {}: {}. Attempting rollback...",
                        path, e
                    );

                    // Attempt to rollback by adding user back to removed groups
                    let mut rollback_failed = false;
                    for removed_group in &removed_groups {
                        if let Some(removed_id) = &removed_group.id {
                            if let Err(rollback_err) = admin
                                .realm_users_with_user_id_groups_with_group_id_put(
                                    realm,
                                    &target_user.user_id,
                                    removed_id,
                                )
                                .await
                            {
                                error!(
                                    "Rollback failed for group {}: {}",
                                    removed_group
                                        .path
                                        .as_ref()
                                        .unwrap_or(&"unknown".to_string()),
                                    rollback_err
                                );
                                rollback_failed = true;
                            }
                        }
                    }

                    // If rollback failed, record for future cleanup
                    if rollback_failed {
                        if let Err(record_err) =
                            record_failed_cleanup(state, &transaction.get_state()).await
                        {
                            error!("Failed to record cleanup job: {}", record_err);
                        }
                    }

                    return Err(OrgError::Internal(format!(
                        "Failed to remove user from group {}: {}",
                        path, e
                    )));
                }
            }
        }
    }

    // Mark transaction as complete
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to remove user {} from org {}",
        target_user.username, org_context.org_id
    );

    Ok(())
}

/// Get a user's current role in an organization
pub async fn get_user_current_role(
    admin: &KeycloakAdmin,
    realm: &str,
    org_context: &OrgContext,
    user_id: &str,
) -> Result<String, OrgError> {
    // Get user's groups
    let user_groups = admin
        .realm_users_with_user_id_groups_get(realm, user_id, None, None, None, None)
        .await
        .map_err(|e| OrgError::Internal(format!("Failed to get user groups: {}", e)))?;

    // Find role groups under this organization
    let org_path = format!("/{}/", org_context.org_id);
    let mut user_roles = Vec::new();
    // Find the role group the user is in
    for group in user_groups {
        if let Some(path) = group.path {
            if path.starts_with(&org_path) && path != org_path {
                // Extract role name from path
                if let Some(role) = path.split('/').next_back() {
                    if !role.is_empty() {
                        user_roles.push(role.to_string());
                    }
                }
            }
        }
    }
    let hierarchy = ["owner", "admin", "write", "read"];
    for &role in &hierarchy {
        if user_roles.contains(&role.to_string()) {
            return Ok(role.to_string());
        }
    }

    Err(OrgError::Internal(format!(
        "User is not a member of any role in organization {}",
        org_context.org_id
    )))
}
