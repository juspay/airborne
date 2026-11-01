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

use super::*;
use serde_json::json;
use superposition_sdk::types::ExperimentResponse;
type Result<T> = airborne_types::Result<T>;

pub async fn experiments(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> Result<(String, Vec<ExperimentResponse>)> {
    // Read-only even on a cold cache: the overview must not populate Redis.
    let workspace = tokio::time::timeout(
        std::time::Duration::from_secs(3),
        crate::utils::workspace::get_workspace_name_for_application_db(
            state.db_pool.clone(),
            app.into(),
            org.into(),
        ),
    )
    .await
    .map_err(|_| ABError::InternalServerError("Workspace lookup deadline".into()))??;
    // Fetch all before filtering: pagination occurs upstream of the name filter.
    let all = state
        .superposition_client
        .list_experiment()
        .org_id(state.env.superposition_org_id.clone())
        .workspace_id(&workspace)
        .all(true)
        .send()
        .await
        .map_err(|_| ABError::InternalServerError("Failed to list releases".into()))?;
    let name = format!("{app}-{org}-release-exp");
    Ok((
        workspace,
        all.data.into_iter().filter(|e| e.name == name).collect(),
    ))
}
pub(super) fn context(exp: &ExperimentResponse) -> Value {
    json!(exp
        .context
        .iter()
        .map(|(k, v)| (
            k.clone(),
            utils::document_to_value(v).unwrap_or(Value::Null)
        ))
        .collect::<std::collections::BTreeMap<_, _>>())
}
pub(super) fn experimental(exp: &ExperimentResponse) -> Option<&superposition_sdk::types::Variant> {
    exp.variants.iter().find(|v| v.variant_type == Experimental)
}
pub(super) fn live(exp: &ExperimentResponse) -> bool {
    exp.status == ExperimentStatusType::Concluded
        && experimental(exp).is_some_and(|v| Some(&v.id) == exp.chosen_variant.as_ref())
}
fn latest_live(exps: &[ExperimentResponse]) -> Vec<&ExperimentResponse> {
    let mut selected = std::collections::BTreeMap::new();
    for exp in exps.iter().filter(|e| live(e)) {
        let key = context(exp).to_string();
        let old = selected.entry(key).or_insert(exp);
        if (exp.last_modified, &exp.id) > (old.last_modified, &old.id) {
            *old = exp;
        }
    }
    selected.into_values().collect()
}
pub(super) fn version(exp: &ExperimentResponse) -> i64 {
    utils::extract_integer_from_experiment::<i64>(&experimental(exp), "package.version")
}
pub async fn app_status(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Value> {
    let exps = match tokio::time::timeout(
        std::time::Duration::from_millis(1500),
        experiments(state, org, app),
    )
    .await
    {
        Ok(Ok((_, exps))) => exps,
        _ => {
            return Ok(
                json!({"application":app,"platform":null,"live":[],"active":[],"last_activity_at":null,"error":"Release lookup failed or timed out"}),
            )
        }
    };
    let live=latest_live(&exps).into_iter().map(|e|json!({"release_id":e.id,"package_version":version(e),"config_version":utils::extract_string_from_experiment(&experimental(e),"config.version"),"dimensions":context(e),"concluded_at":utils::dt(&e.last_modified)})).collect::<Vec<_>>();
    let active=exps.iter().filter(|e|matches!(e.status,ExperimentStatusType::Created|ExperimentStatusType::Inprogress)).map(|e|json!({"release_id":e.id,"package_version":version(e),"status":e.status.as_str(),"traffic_percentage":e.traffic_percentage,"experimental_variant":experimental(e).map(|v|v.id.clone()).unwrap_or_default(),"dimensions":context(e),"created_at":utils::dt(&e.created_at),"created_by":e.created_by})).collect::<Vec<_>>();
    Ok(
        json!({"application":app,"platform":null,"live":live,"active":active,"last_activity_at":exps.iter().max_by_key(|e|e.last_modified).map(|e|utils::dt(&e.last_modified)),"error":null}),
    )
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use superposition_sdk::types::ExperimentType;
    pub(crate) fn make(id: &str, time: i64, dim: &str) -> ExperimentResponse {
        let variant = VariantBuilder::default()
            .id("exp")
            .set_overrides(Some(HashMap::new()))
            .variant_type(Experimental)
            .build()
            .unwrap();

        ExperimentResponse::builder()
            .id(id)
            .name("release")
            .set_override_keys(Some(Vec::new()))
            .created_at(aws_smithy_types::DateTime::from_secs(time))
            .created_by("test")
            .last_modified(aws_smithy_types::DateTime::from_secs(time))
            .last_modified_by("test")
            .status(ExperimentStatusType::Concluded)
            .traffic_percentage(50)
            .experiment_type(ExperimentType::Default)
            .description("")
            .change_reason("")
            .variants(variant.clone())
            .chosen_variant("exp")
            .context("platform", Document::String(dim.into()))
            .build()
            .unwrap()
    }
    #[test]
    fn live_selection() {
        let mut exps = vec![
            make("old", 1, "ios"),
            make("new", 2, "ios"),
            make("android", 1, "android"),
            make("control", 3, "ios"),
        ];
        exps[3].chosen_variant = Some("control".into());
        let ids = latest_live(&exps)
            .iter()
            .map(|e| e.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"new"));
        assert!(ids.contains(&"android"));
    }
}
