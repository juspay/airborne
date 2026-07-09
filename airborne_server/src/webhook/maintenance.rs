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

use diesel::prelude::*;

use crate::run_blocking;
use crate::types::Result;
use crate::utils::db::schema::hyperotaserver::webhook_deliveries;
use crate::utils::db::DbPool;

/// Delete deliveries older than `retention_days` days. `webhook_attempts` rows are
/// removed by the ON DELETE CASCADE foreign key. Returns the number of deliveries removed.
pub async fn delete_old_deliveries(pool: &DbPool, retention_days: i32) -> Result<usize> {
    let pool = pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days.max(0) as i64);
        let n = diesel::delete(
            webhook_deliveries::table.filter(webhook_deliveries::created_at.lt(cutoff)),
        )
        .execute(&mut conn)?;
        Ok(n)
    })
}
