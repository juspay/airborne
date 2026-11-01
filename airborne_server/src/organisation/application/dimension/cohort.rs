use std::collections::HashMap;

use actix_web::{
    get, post, put,
    web::{self, Json, Path, ReqData},
    Scope,
};
use airborne_authz_macros::authz;
use log::info;

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
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
        .service(create_range)
        .service(create_cohort_group_api)
        .service(get_cohort_priority_api)
        .service(update_cohort_priority_api)
}

#[authz(
    resource = "cohort",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("")]
async fn list_cohorts_api(
    cohort_dimension: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<CohortDimensionSchema>> {
    let cohort_dimension_id = cohort_dimension.into_inner();

    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await?;

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

#[authz(
    resource = "cohort",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/checkpoint")]
async fn create_cohort_checkpoint_api(
    cohort_dimension: Path<String>,
    req: Json<types::CreateCohortDimensionCheckpointInput>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::CreateCohortDimensionCheckpointOutput>> {
    let cohort_dimension_id = cohort_dimension.into_inner();
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    crate::release::maker_checker::auxiliary_write(&state, &organisation, &application, async {
        crate::release::maker_checker::auxiliary(&state, &organisation, &application).await?;

        // Get workspace name for this application
        let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;

        let superposition_org_id = state.env.superposition_org_id.clone();

        let dimension_output = state
            .superposition_client
            .get_dimension()
            .org_id(superposition_org_id.clone())
            .workspace_id(workspace_name.clone())
            .dimension(cohort_dimension_id.clone())
            .send()
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to fetch dimension: {}", e))
            })?;

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

                    if is_closed_range(definitions) {
                        return (last_in, first);
                    }
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
            let mut and_conditions: Vec<types::DefinitionValue> = Vec::new();

            // Retain existing definition
            if let Some(existing) = cohort_dimension.definitions.get(&last_checkpoint) {
                // put first key of existing into and_conditions as a Node
                if let Some((key, val)) = existing.iter().next() {
                    let mut inner_map = HashMap::new();
                    inner_map.insert(key.clone(), val.clone());
                    and_conditions.push(types::DefinitionValue::Node(inner_map));
                }
            }

            // Add upper bound as a Leaf
            let mut upper_bound_map = HashMap::new();
            upper_bound_map.insert(
                comparator,
                types::DefinitionValue::Leaf(serde_json::json!([{ "var": depends_on }, req.value])),
            );
            and_conditions.push(types::DefinitionValue::Node(upper_bound_map));

            logic_hashmap.insert(
                types::JsonLogicKey::And,
                types::DefinitionValue::Array(and_conditions),
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
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to update dimension: {}", e))
            })?;

        Ok(Json(types::CreateCohortDimensionCheckpointOutput {
            name: req.name.clone(),
            value: req.value.clone(),
            comparator: req.comparator.clone(),
        }))
    })
    .await
}

#[authz(
    resource = "cohort_group",
    action = "create",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[post("/group")]
async fn create_cohort_group_api(
    cohort_dimension: Path<String>,
    req: Json<types::CreateCohortGroupInput>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::CreateCohortGroupOutput>> {
    let cohort_dimension_id = cohort_dimension.into_inner();

    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    crate::release::maker_checker::auxiliary_write(&state, &organisation, &application, async {
        crate::release::maker_checker::auxiliary(&state, &organisation, &application).await?;

        // Get workspace name for this application
        let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;

        let superposition_org_id = state.env.superposition_org_id.clone();

        let dimension_output = state
            .superposition_client
            .get_dimension()
            .org_id(superposition_org_id.clone())
            .workspace_id(workspace_name.clone())
            .dimension(cohort_dimension_id.clone())
            .send()
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to fetch dimension: {}", e))
            })?;

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
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to update dimension: {}", e))
            })?;

        Ok(Json(types::CreateCohortGroupOutput {
            name: req.name.clone(),
            members: req.members.clone(),
        }))
    })
    .await
}

#[authz(
    resource = "cohort_group",
    action = "read",
    org_roles = ["owner", "admin", "write", "read"],
    app_roles = ["admin", "write", "read"]
)]
#[get("/group/priority")]
async fn get_cohort_priority_api(
    cohort_dimension: Path<String>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::GetPriorityOutput>> {
    let cohort_dimension = cohort_dimension.into_inner();
    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;

    // Get workspace name for this application
    let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
        state.db_pool.clone(),
        &state.redis_cache,
        application.clone(),
        organisation.clone(),
    )
    .await?;

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

#[authz(
    resource = "cohort_group",
    action = "update",
    org_roles = ["owner", "admin", "write"],
    app_roles = ["admin", "write"]
)]
#[put("/group/priority")]
async fn update_cohort_priority_api(
    cohort_dimension: Path<String>,
    req: Json<types::UpdatePriorityInput>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<types::UpdatePriorityOutput>> {
    let cohort_dimension_id = cohort_dimension.into_inner();

    let auth_response = auth_response.into_inner();
    let (organisation, application) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    crate::release::maker_checker::auxiliary_write(&state, &organisation, &application, async {
        crate::release::maker_checker::auxiliary(&state, &organisation, &application).await?;

        // Get workspace name for this application
        let workspace_name = crate::utils::workspace::get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            application.clone(),
            organisation.clone(),
        )
        .await?;

        let superposition_org_id = state.env.superposition_org_id.clone();

        let dimension_output = state
            .superposition_client
            .get_dimension()
            .org_id(superposition_org_id.clone())
            .workspace_id(workspace_name.clone())
            .dimension(cohort_dimension_id.clone())
            .send()
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to fetch dimension: {}", e))
            })?;

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
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to update dimension: {}", e))
            })?;

        Ok(Json(types::UpdatePriorityOutput {
            priority_map: req.priority_map.clone(),
        }))
    })
    .await
}

// Closed ranges are independent of the checkpoint chain. Their inclusive pair
// cannot be produced by checkpoints (which use complementary strict bounds).
fn is_closed_range(definition: &types::DefinitionMap) -> bool {
    if let Some(types::DefinitionValue::Array(conditions)) =
        definition.get(&types::JsonLogicKey::And)
    {
        return conditions.len()==2 && conditions.iter().any(|v| matches!(v,types::DefinitionValue::Node(m) if m.contains_key(&types::JsonLogicKey::SemVerGe))) && conditions.iter().any(|v| matches!(v,types::DefinitionValue::Node(m) if m.contains_key(&types::JsonLogicKey::SemVerLe)));
    }
    false
}
#[derive(serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct ClosedRange {
    name: String,
    lower: String,
    upper: String,
    priority: usize,
}
fn insert_range(
    schema: &mut CohortDimensionSchema,
    depends_on: &str,
    req: &ClosedRange,
) -> airborne_types::Result<()> {
    let lower = semver::Version::parse(&req.lower)
        .map_err(|_| ABError::BadRequest("lower must be a semantic version".into()))?;
    let upper = semver::Version::parse(&req.upper)
        .map_err(|_| ABError::BadRequest("upper must be a semantic version".into()))?;
    // Superposition jp_ver_* currently does not implement SemVer prerelease
    // precedence. Refuse unsupported bounds rather than silently mis-targeting.
    if !lower.pre.is_empty()
        || !upper.pre.is_empty()
        || !lower.build.is_empty()
        || !upper.build.is_empty()
    {
        return Err(ABError::BadRequest("Ranges require stable major.minor.patch versions; upstream comparators do not support prerelease/build metadata".into()));
    }
    if lower.cmp_precedence(&upper).is_gt() {
        return Err(ABError::BadRequest("lower must not exceed upper".into()));
    }
    if req.name.trim().is_empty() || req.name == "otherwise" || schema.r#enum.contains(&req.name) {
        return Err(ABError::BadRequest(
            "Invalid or duplicate cohort name".into(),
        ));
    }
    schema.remove_default();
    let end = schema
        .r#enum
        .iter()
        .position(|v| v == "otherwise")
        .unwrap_or(schema.r#enum.len());
    if req.priority > end {
        return Err(ABError::BadRequest(format!(
            "priority must be between 0 and {end}"
        )));
    }
    let conditions = [
        (types::JsonLogicKey::SemVerGe, &req.lower),
        (types::JsonLogicKey::SemVerLe, &req.upper),
    ]
    .into_iter()
    .map(|(key, value)| {
        types::DefinitionValue::Node(HashMap::from([(
            key,
            types::DefinitionValue::Leaf(serde_json::json!([{"var":depends_on},value])),
        )]))
    })
    .collect();
    schema.definitions.insert(
        req.name.clone(),
        HashMap::from([(
            types::JsonLogicKey::And,
            types::DefinitionValue::Array(conditions),
        )]),
    );
    schema.r#enum.insert(req.priority, req.name.clone());
    Ok(())
}
#[authz(resource="cohort", action="update", org_roles=["owner","admin","write"], app_roles=["admin","write"])]
#[post("/range")]
async fn create_range(
    cohort_dimension: Path<String>,
    req: Json<ClosedRange>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ClosedRange>> {
    let (o, a) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    crate::release::maker_checker::auxiliary_write(&state, &o, &a, async {
        crate::release::maker_checker::auxiliary(&state, &o, &a).await?;
        let workspace = crate::utils::workspace::get_workspace_name_for_application(
            state.db_pool.clone(),
            &state.redis_cache,
            a.clone(),
            o.clone(),
        )
        .await?;
        let dimension = state
            .superposition_client
            .get_dimension()
            .org_id(state.env.superposition_org_id.clone())
            .workspace_id(workspace.clone())
            .dimension(cohort_dimension.as_str())
            .send()
            .await
            .map_err(|e| ABError::InternalServerError(format!("Failed to fetch dimension: {e}")))?;
        let depends = match dimension.dimension_type {
            superposition_sdk::types::DimensionType::LocalCohort(d) => d,
            _ => {
                return Err(ABError::BadRequest(
                    "Expected local cohort dimension".into(),
                ))
            }
        };
        let mut schema: CohortDimensionSchema = dimension.schema.try_into()?;
        insert_range(&mut schema, &depends, &req)?;
        state
            .superposition_client
            .update_dimension()
            .org_id(state.env.superposition_org_id.clone())
            .workspace_id(workspace)
            .dimension(cohort_dimension.as_str())
            .set_schema(Some(schema.to_kv_str_doc()))
            .change_reason("Added independent closed semantic version range".to_owned())
            .send()
            .await
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to update dimension: {e}"))
            })?;
        Ok(Json(req.into_inner()))
    })
    .await
}
#[cfg(test)]
mod range_tests {
    use super::*;
    #[test]
    fn closed_range_preserves_previous_definitions_and_priority() {
        let mut schema = CohortDimensionSchema::default("app_version".into());
        let req = |name: &str, lower: &str, upper: &str, priority| ClosedRange {
            name: name.into(),
            lower: lower.into(),
            upper: upper.into(),
            priority,
        };
        insert_range(&mut schema, "app_version", &req("old", "1.0.0", "1.9.9", 0)).unwrap();
        let before = serde_json::to_vec(&schema.definitions["old"]).unwrap();
        insert_range(&mut schema, "app_version", &req("new", "1.5.0", "2.0.0", 0)).unwrap();
        assert_eq!(
            before,
            serde_json::to_vec(&schema.definitions["old"]).unwrap()
        );
        assert_eq!(schema.r#enum, vec!["new", "old", "otherwise"]);
        assert!(is_closed_range(&schema.definitions["new"]));
        let definition = schema.definitions["new"].values().next().unwrap().to_json();
        assert_eq!(
            definition,
            serde_json::json!([{"jp_ver_ge":[{"var":"app_version"},"1.5.0"]},{"jp_ver_le":[{"var":"app_version"},"2.0.0"]}])
        );
        for (lo, hi) in [
            ("bad", "2.0.0"),
            ("1.0.0-alpha", "2.0.0"),
            ("1.0.0+build", "2.0.0"),
            ("2.0.0", "1.0.0"),
            ("1.0", "2.0.0"),
        ] {
            assert!(insert_range(&mut schema, "app_version", &req("invalid", lo, hi, 0)).is_err());
        }
        insert_range(
            &mut schema,
            "app_version",
            &req("single", "2.0.0", "2.0.0", 0),
        )
        .unwrap();
    }
}
