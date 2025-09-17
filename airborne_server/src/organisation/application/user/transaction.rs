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

use crate::{
    types::AppState,
    utils::{keycloak::find_role_subgroup, transaction_manager::TransactionManager},
};
use actix_web::web;
use keycloak::KeycloakAdmin;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};

use super::{AppContext, AppError, UserContext};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserOperation {
    Add,
    Update,
    Remove,
}

/// Add a user to an application with transaction management
pub async fn add_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    app_context: &AppContext,
    target_user: &UserContext,
    role_name: &str,
) -> Result<(), AppError> {
    // Create a new transaction manager for this operation
    let transaction = TransactionManager::new(
        &format!("{}/{}", app_context.org_name, app_context.app_name),
        "application_user",
    );

    debug!(
        "Starting transaction to add user {} to app {}/{} with role {}",
        target_user.username, app_context.org_name, app_context.app_name, role_name
    );

    // Get additional roles based on the requested role
    let mut roles = get_additional_roles(role_name)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to get additional roles: {}", e)))?;

    roles.push(role_name.to_string());

    // Add user to each role group
    for role_name in roles {
        add_user_to_group(
            admin,
            realm,
            &target_user.user_id,
            &app_context.app_group_id,
            &role_name,
            &transaction,
        )
        .await
        .map_err(|e| AppError::Internal(format!("Failed to add user to group: {}", e)))?;
    }

    // Add user to the organisation group as well with READ role
    add_user_to_group(
        admin,
        realm,
        &target_user.user_id,
        &app_context.org_group_id,
        "read",
        &transaction,
    )
    .await
    .map_err(|e| AppError::Internal(format!("Failed to add user to organisation group: {}", e)))?;

    // Mark transaction as complete
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to add user {} to app {}/{}",
        target_user.username, app_context.org_name, app_context.app_name
    );

    Ok(())
}

/// Roles come with additional roles like Admin has Write, Read
/// This function retrieves those additional roles for a given role name
async fn get_additional_roles(role_name: &str) -> Result<Vec<String>, AppError> {
    let additional_roles = match role_name {
        "admin" => vec!["write".to_string(), "read".to_string()],
        "write" => vec!["read".to_string()],
        _ => vec![],
    };

    if additional_roles.is_empty() && role_name != "read" {
        return Err(AppError::Internal(format!(
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
) -> Result<(), AppError> {
    // Find the role group
    let role_group = find_role_subgroup(admin, realm, group_id, role_name)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to find role group: {}", e)))?
        .ok_or_else(|| AppError::Internal(format!("Role group {} not found", role_name)))?;

    let role_group_id = role_group
        .id
        .as_ref()
        .ok_or_else(|| AppError::Internal("Role group has no ID".to_string()))?
        .to_string();

    // Add user to role group
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
            return Err(AppError::Internal(format!(
                "Failed to add user to role group: {}",
                e
            )));
        }
    }
    Ok(())
}

/// Update a user's role in an application with transaction management
pub async fn update_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    app_context: &AppContext,
    target_user: &UserContext,
    new_role_name: &str,
    current_role: &str,
    state: &web::Data<AppState>,
) -> Result<(), AppError> {
    // Create a new transaction manager
    let transaction = TransactionManager::new(
        &format!("{}/{}", app_context.org_name, app_context.app_name),
        "application_user_update",
    );

    debug!(
        "Starting transaction to update user {} in app {}/{} from role {} to {}",
        target_user.username,
        app_context.org_name,
        app_context.app_name,
        current_role,
        new_role_name
    );

    // Find current role group
    let current_role_group =
        find_role_subgroup(admin, realm, &app_context.app_group_id, current_role)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to find current role group: {}", e)))?
            .ok_or_else(|| {
                AppError::Internal(format!("Current role group {} not found", current_role))
            })?;

    let current_role_id = current_role_group
        .id
        .as_ref()
        .ok_or_else(|| AppError::Internal("Current role group has no ID".to_string()))?
        .to_string();

    // Find new role group
    let new_role_group = find_role_subgroup(admin, realm, &app_context.app_group_id, new_role_name)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to find new role group: {}", e)))?
        .ok_or_else(|| AppError::Internal(format!("New role group {} not found", new_role_name)))?;

    let new_role_id = new_role_group
        .id
        .as_ref()
        .ok_or_else(|| AppError::Internal("New role group has no ID".to_string()))?
        .to_string();

    // Step 1: Add user to new role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_put(
            realm,
            &target_user.user_id,
            &new_role_id,
        )
        .await
    {
        Ok(_) => {
            // Record this action in the transaction
            transaction.add_keycloak_resource(
                "user_group_membership",
                &format!("{}:{}", target_user.user_id, new_role_id),
            );
            debug!(
                "Added user {} to new role group {}",
                target_user.username, new_role_name
            );
        }
        Err(e) => {
            // If this fails, nothing to roll back yet
            return Err(AppError::Internal(format!(
                "Failed to add user to new role group: {}",
                e
            )));
        }
    }

    // Step 2: Remove user from old role group
    match admin
        .realm_users_with_user_id_groups_with_group_id_delete(
            realm,
            &target_user.user_id,
            &current_role_id,
        )
        .await
    {
        Ok(_) => {
            debug!(
                "Removed user {} from old role group {}",
                target_user.username, current_role
            );
        }
        Err(e) => {
            warn!(
                "Failed to remove user from old role group: {}. Attempting rollback...",
                e
            );

            // Attempt to rollback by removing from new role group
            if let Err(rollback_err) = admin
                .realm_users_with_user_id_groups_with_group_id_delete(
                    realm,
                    &target_user.user_id,
                    &new_role_id,
                )
                .await
            {
                error!("Rollback failed: {}", rollback_err);
                // Record for future cleanup
                if let Err(record_err) =
                    record_failed_cleanup(state, &transaction.get_state()).await
                {
                    error!("Failed to record cleanup job: {}", record_err);
                }
            }

            return Err(AppError::Internal(format!(
                "Failed to remove user from old role group: {}",
                e
            )));
        }
    }

    // Mark transaction as complete
    transaction.set_database_inserted();

    info!(
        "Successfully completed transaction to update user {} in app {}/{} from role {} to {}",
        target_user.username,
        app_context.org_name,
        app_context.app_name,
        current_role,
        new_role_name
    );

    Ok(())
}

/// Remove a user from an application with transaction management
pub async fn remove_user_with_transaction(
    admin: &KeycloakAdmin,
    realm: &str,
    app_context: &AppContext,
    target_user: &UserContext,
    user_groups: &[keycloak::types::GroupRepresentation],
    state: &web::Data<AppState>,
) -> Result<(), AppError> {
    // Create a new transaction manager
    let transaction = TransactionManager::new(
        &format!("{}/{}", app_context.org_name, app_context.app_name),
        "application_user_remove",
    );

    debug!(
        "Starting transaction to remove user {} from app {}/{}",
        target_user.username, app_context.org_name, app_context.app_name
    );

    // Filter groups that belong to this application
    let app_path = format!("/{}/{}/", app_context.org_name, app_context.app_name);
    let app_groups: Vec<_> = user_groups
        .iter()
        .filter(|g| g.path.as_ref().is_some_and(|p| p.contains(&app_path)))
        .collect();

    if app_groups.is_empty() {
        return Err(AppError::Internal(format!(
            "User {} is not a member of any groups in application {}/{}",
            target_user.username, app_context.org_name, app_context.app_name
        )));
    }

    // Keep track of groups we've removed the user from (for potential rollback)
    let mut removed_groups = Vec::new();

    // Remove user from all application groups
    for group in app_groups {
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

                    return Err(AppError::Internal(format!(
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
        "Successfully completed transaction to remove user {} from app {}/{}",
        target_user.username, app_context.org_name, app_context.app_name
    );

    Ok(())
}

/// Get a user's current role in an application
pub async fn get_user_current_role(
    admin: &KeycloakAdmin,
    realm: &str,
    app_context: &AppContext,
    user_id: &str,
) -> Result<String, AppError> {
    // Get user's groups
    let user_groups = admin
        .realm_users_with_user_id_groups_get(realm, user_id, None, None, None, None)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to get user groups: {}", e)))?;

    // Find role groups under this application
    let app_path = format!("/{}/{}/", app_context.org_name, app_context.app_name);

    // Find the role group the user is in
    for group in user_groups {
        if let Some(path) = group.path {
            if path.starts_with(&app_path) && path != app_path {
                // Extract role name from path
                if let Some(role) = path.split('/').next_back() {
                    if !role.is_empty() {
                        return Ok(role.to_string());
                    }
                }
            }
        }
    }

    Err(AppError::Internal(format!(
        "User has no role in application {}/{}",
        app_context.org_name, app_context.app_name
    )))
}

/// Record failed cleanup for future processing
async fn record_failed_cleanup(
    _state: &web::Data<AppState>,
    _transaction_state: &crate::utils::transaction_manager::TransactionState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // This would normally insert a record into a cleanup table
    // For now, we'll just log the failure
    warn!("Recording failed cleanup for future processing");
    Ok(())
}
