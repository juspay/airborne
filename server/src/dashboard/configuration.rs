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

use crate::types::AppState;
use actix_web::{
    get,
    web::{self, Json},
    HttpRequest, Scope,
};
use serde::{Deserialize, Serialize};

pub fn add_routes() -> Scope {
    Scope::new("").service(get_global_configurations)
}

#[derive(Serialize, Deserialize)]
struct Configuration {
    google_signin_enabled: bool,
    organisation_creation_disabled: bool,
}

#[get("/")]
async fn get_global_configurations(
    _: HttpRequest,
    state: web::Data<AppState>,
) -> actix_web::Result<Json<Configuration>> {
    let config = Configuration {
        google_signin_enabled: state.env.enable_google_signin,
        organisation_creation_disabled: state.env.organisation_creation_disabled,
    };

    Ok(Json(config))
}
