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

use crate::run_blocking;
use crate::types as airborne_types;
use crate::utils::db::{models::WorkspaceName, schema::hyperotaserver::workspace_names, DbPool};
use diesel::prelude::*;

/// Get the workspace name for Superposition based on organization and application
/// This retrieves the workspace name that was created during application setup
/// which follows the format: {application_name}{generated_id}
pub async fn get_workspace_name_for_application(
    pool: DbPool,
    application: String,
    organisation: String,
) -> airborne_types::Result<String> {
    let workspace_result = run_blocking!({
        let mut conn = pool.get()?;
        let result = workspace_names::table
            .filter(workspace_names::organization_id.eq(organisation))
            .filter(workspace_names::application_id.eq(application))
            .order(workspace_names::id.desc())
            .select(WorkspaceName::as_select())
            .first(&mut conn)?;
        Ok(result)
    });

    match workspace_result {
        Ok(name) => {
            let span = tracing::Span::current();
            span.record(
                "superposition_workspace",
                tracing::field::display(&name.workspace_name),
            );
            Ok(name.workspace_name)
        }
        Err(e) => Err(e),
    }
}
