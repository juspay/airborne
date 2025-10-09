use std::collections::HashMap;

use actix_web::{
    get, post, put,
    web::{self, Json, Path, ReqData},
    Scope,
};
use log::info;

use crate::{
    middleware::auth::{validate_user, AuthResponse, ADMIN, READ, WRITE},
    organisation::application::dimension::cohort::types::CohortDimensionSchema,
    types as airborne_types,
    types::{ABError, AppState},
};

pub mod types;
mod utils;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(list_cohorts_api)
        .service(create_cohort_checkpoint_api)
        .service(create_cohort_group_api)
        .service(get_cohort_priority_api)
        .service(update_cohort_priority_api)
}

#[get("")]
async fn list_cohorts_api(
    cohort_dimension: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CohortDimensionSchema>> {
    let cohort_dimension_id = cohort_dimension.into_inner();

    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id = state.env.superposition_org_id.clone();

    let dimension_output = state
        .superposition_client
        .get_dimension()
        .org_id(superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(cohort_dimension_id.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to fetch dimension: {}", e)))?;

    info!("Fetched dimension: {:?}", dimension_output);
    let mut cohort_dimension: CohortDimensionSchema = dimension_output
        .schema
        .try_into()
        .map_err(|e| ABError::InternalServerError(format!("Schema parse error: {}", e)))?;

    cohort_dimension.remove_default();

    Ok(Json(cohort_dimension))
}

#[post("/checkpoint")]
async fn create_cohort_checkpoint_api(
    cohort_dimension: Path<String>,
    req: Json<types::CreateCohortDimensionCheckpointInput>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::CreateCohortDimensionCheckpointOutput>> {
    let cohort_dimension_id = cohort_dimension.into_inner();
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Unauthorized("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id = state.env.superposition_org_id.clone();

    let dimension_output = state
        .superposition_client
        .get_dimension()
        .org_id(superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(cohort_dimension_id.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to fetch dimension: {}", e)))?;

    let depends_on = match &dimension_output.dimension_type {
        superposition_sdk::types::DimensionType::LocalCohort(depends_on) => depends_on,
        _ => {
            return Err(ABError::BadRequest(format!(
                "Dimension '{}' is not a cohort dimension",
                cohort_dimension_id
            )));
        }
    };

    info!("Fetched dimension: {:?}", dimension_output);
    let mut cohort_dimension: CohortDimensionSchema = dimension_output
        .schema
        .try_into()
        .map_err(|e| ABError::InternalServerError(format!("Schema parse error: {}", e)))?;

    if cohort_dimension.check_has_default() {
        // First checkpoint
        cohort_dimension.remove_default();
    }

    if cohort_dimension.r#enum.contains(&req.name) {
        return Err(ABError::BadRequest(format!(
            "Cohort '{}' already exists",
            req.name
        )));
    }

    let (last_index_of_group, last_checkpoint): (Option<usize>, Option<types::CohortName>) =
        cohort_dimension.r#enum.iter().enumerate().fold(
            (None, None),
            |(last_in, first), (idx, cohort_name)| {
                let Some(definitions) = cohort_dimension.definitions.get(cohort_name) else {
                    return (last_in, first);
                };

                match definitions.keys().next() {
                    // track the last index where the key is `In`
                    Some(key) if *key == types::JsonLogicKey::In => (Some(idx), first),

                    // on the first non-`In`, capture the *cohort name*
                    Some(_key) if first.is_none() => (last_in, Some(cohort_name.clone())),

                    _ => (last_in, first),
                }
            },
        );

    let mut logic_hashmap = HashMap::new();
    logic_hashmap.insert(
        req.comparator.clone().into(),
        types::DefinitionValue::Leaf(serde_json::json!([{ "var": depends_on }, req.value])),
    );

    cohort_dimension
        .definitions
        .insert(req.name.clone(), logic_hashmap);

    // put the req.name in enums after last_index_of_group if it exists, else at the start and edit last_checkpoint if it exists and add an upper bound there with AND
    match last_index_of_group {
        Some(idx) => {
            cohort_dimension.r#enum.insert(idx + 1, req.name.clone());
        }
        None => {
            cohort_dimension.r#enum.insert(0, req.name.clone());
        }
    }

    // Update the last checkpoint to have an upper bound if it exists
    if let Some(last_checkpoint) = last_checkpoint {
        let comparator = match req.comparator {
            types::Comparator::SemverGt => types::JsonLogicKey::SemVerLe,
            types::Comparator::StrGt => types::JsonLogicKey::StrLe,
            types::Comparator::SemverGe => types::JsonLogicKey::SemVerLt,
            types::Comparator::StrGe => types::JsonLogicKey::StrLt,
        };

        let mut logic_hashmap = HashMap::new();
        logic_hashmap.insert(
            types::JsonLogicKey::And,
            types::DefinitionValue::Node({
                let mut inner_map = HashMap::new();

                // Retain existing definition
                if let Some(existing) = cohort_dimension.definitions.get(&last_checkpoint) {
                    // put first key of existing into inner_map
                    if let Some((key, val)) = existing.iter().next() {
                        inner_map.insert(key.clone(), val.clone());
                    }
                }

                // Add upper bound
                inner_map.insert(
                    comparator,
                    types::DefinitionValue::Leaf(
                        serde_json::json!([{ "var": depends_on }, req.value]),
                    ),
                );

                inner_map
            }),
        );

        if cohort_dimension
            .definitions
            .remove(&last_checkpoint)
            .is_some()
        {
            cohort_dimension
                .definitions
                .insert(last_checkpoint.to_string(), logic_hashmap);
        }
    }

    let _ = state
        .superposition_client
        .update_dimension()
        .org_id(superposition_org_id)
        .workspace_id(workspace_name)
        .dimension(cohort_dimension_id.clone())
        .set_schema(Some(cohort_dimension.to_kv_str_doc()))
        .change_reason("Added cohort checkpoint via API".to_string())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to update dimension: {}", e)))?;

    Ok(Json(types::CreateCohortDimensionCheckpointOutput {
        name: req.name.clone(),
        value: req.value.clone(),
        comparator: req.comparator.clone(),
    }))
}

#[post("/group")]
async fn create_cohort_group_api(
    cohort_dimension: Path<String>,
    req: Json<types::CreateCohortGroupInput>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::CreateCohortGroupOutput>> {
    let cohort_dimension_id = cohort_dimension.into_inner();

    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id = state.env.superposition_org_id.clone();

    let dimension_output = state
        .superposition_client
        .get_dimension()
        .org_id(superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(cohort_dimension_id.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to fetch dimension: {}", e)))?;

    let depends_on = match &dimension_output.dimension_type {
        superposition_sdk::types::DimensionType::LocalCohort(depends_on) => depends_on,
        _ => {
            return Err(ABError::BadRequest(format!(
                "Dimension '{}' is not a cohort dimension",
                cohort_dimension_id
            )));
        }
    };

    info!("Fetched dimension: {:?}", dimension_output);
    let mut cohort_dimension: CohortDimensionSchema = dimension_output
        .schema
        .try_into()
        .map_err(|e| ABError::InternalServerError(format!("Schema parse error: {}", e)))?;

    if cohort_dimension.check_has_default() {
        // First group
        cohort_dimension.remove_default();
    }

    if cohort_dimension.r#enum.contains(&req.name) {
        return Err(ABError::BadRequest(format!(
            "Cohort '{}' already exists",
            req.name
        )));
    }

    let mut logic_hashmap = HashMap::new();
    logic_hashmap.insert(
        types::JsonLogicKey::In,
        types::DefinitionValue::Leaf(serde_json::json!([{ "var": depends_on }, req.members])),
    );

    cohort_dimension
        .definitions
        .insert(req.name.clone(), logic_hashmap);

    cohort_dimension.r#enum.insert(0, req.name.clone());

    let _ = state
        .superposition_client
        .update_dimension()
        .org_id(superposition_org_id)
        .workspace_id(workspace_name)
        .dimension(cohort_dimension_id.clone())
        .set_schema(Some(cohort_dimension.to_kv_str_doc()))
        .change_reason("Added cohort checkpoint via API".to_string())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to update dimension: {}", e)))?;

    Ok(Json(types::CreateCohortGroupOutput {
        name: req.name.clone(),
        members: req.members.clone(),
    }))
}

#[get("/group/priority")]
async fn get_cohort_priority_api(
    cohort_dimension: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::GetPriorityOutput>> {
    let cohort_dimension = cohort_dimension.into_inner();
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), READ)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id = state.env.superposition_org_id.clone();

    let dimension_output = state
        .superposition_client
        .get_dimension()
        .org_id(superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(cohort_dimension.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to fetch dimension: {}", e)))?;

    info!("Fetched dimension: {:?}", dimension_output);
    let cohort_dimension: CohortDimensionSchema = dimension_output
        .schema
        .try_into()
        .map_err(|e| ABError::InternalServerError(format!("Schema parse error: {}", e)))?;

    let in_keys: Vec<String> = cohort_dimension
        .definitions
        .iter()
        .filter_map(|(cohort_name, definition)| {
            if definition.contains_key(&types::JsonLogicKey::In) {
                Some(cohort_name.clone())
            } else {
                None
            }
        })
        .collect();

    let mut priority_map: HashMap<String, i32> = HashMap::new();
    for cohort_name in in_keys {
        if let Some(idx) = cohort_dimension
            .r#enum
            .iter()
            .position(|c| c == &cohort_name)
        {
            priority_map.insert(cohort_name, idx as i32);
        }
    }

    Ok(Json(types::GetPriorityOutput { priority_map }))
}

#[put("/group/priority")]
async fn update_cohort_priority_api(
    cohort_dimension: Path<String>,
    req: Json<types::UpdatePriorityInput>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::UpdatePriorityOutput>> {
    let cohort_dimension_id = cohort_dimension.into_inner();

    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), WRITE)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        application.clone(),
        organisation.clone(),
    )
    .await
    .map_err(|e| ABError::InternalServerError(format!("Workspace error: {}", e)))?;

    let superposition_org_id = state.env.superposition_org_id.clone();

    let dimension_output = state
        .superposition_client
        .get_dimension()
        .org_id(superposition_org_id.clone())
        .workspace_id(workspace_name.clone())
        .dimension(cohort_dimension_id.clone())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to fetch dimension: {}", e)))?;

    info!("Fetched dimension: {:?}", dimension_output);
    let mut cohort_dimension: CohortDimensionSchema = dimension_output
        .schema
        .try_into()
        .map_err(|e| ABError::InternalServerError(format!("Schema parse error: {}", e)))?;

    let in_keys: Vec<String> = cohort_dimension
        .definitions
        .iter()
        .filter_map(|(cohort_name, definition)| {
            if definition.contains_key(&types::JsonLogicKey::In) {
                Some(cohort_name.clone())
            } else {
                None
            }
        })
        .collect();

    let mut priority_map: HashMap<String, i32> = HashMap::new();
    for cohort_name in in_keys {
        if let Some(idx) = cohort_dimension
            .r#enum
            .iter()
            .position(|c| c == &cohort_name)
        {
            priority_map.insert(cohort_name, idx as i32);
        }
    }

    // Let's reorder the enums based on req.priority_map
    for (cohort_name, new_priority) in &req.priority_map {
        if *new_priority > priority_map.len() as i32 - 1 || *new_priority < 0 {
            return Err(ABError::BadRequest(format!(
                "Invalid priority {} for cohort '{}'. Must be between 0 and {}",
                new_priority,
                cohort_name,
                priority_map.len() - 1
            )));
        }
        if let Some(current_idx) = cohort_dimension
            .r#enum
            .iter()
            .position(|c| c == cohort_name)
        {
            // Remove from current position
            cohort_dimension.r#enum.remove(current_idx);
            // Insert at new position
            let insert_idx = (*new_priority as usize).min(cohort_dimension.r#enum.len());
            cohort_dimension
                .r#enum
                .insert(insert_idx, cohort_name.clone());
        }
    }

    let _ = state
        .superposition_client
        .update_dimension()
        .org_id(superposition_org_id)
        .workspace_id(workspace_name)
        .dimension(cohort_dimension_id.clone())
        .set_schema(Some(cohort_dimension.to_kv_str_doc()))
        .change_reason("Updated cohort priority via API".to_string())
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(format!("Failed to update dimension: {}", e)))?;

    Ok(Json(types::UpdatePriorityOutput {
        priority_map: req.priority_map.clone(),
    }))
}
