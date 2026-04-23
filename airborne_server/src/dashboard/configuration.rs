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

use crate::types as airborne_types;
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
    enabled_oidc_idps: Vec<String>,
    organisation_creation_disabled: bool,
    authn_provider: String,
    authz_provider: String,
    oidc_login_enabled: bool,
    password_login_enabled: bool,
    registration_enabled: bool,
}

#[get("")]
async fn get_global_configurations(
    _: HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Configuration>> {
    let config = Configuration {
        google_signin_enabled: state
            .env
            .enabled_oidc_idps
            .iter()
            .any(|idp| idp.eq_ignore_ascii_case("google")),
        enabled_oidc_idps: state.env.enabled_oidc_idps.clone(),
        organisation_creation_disabled: state.env.organisation_creation_disabled,
        authn_provider: state.authn_provider.kind().as_str().to_string(),
        authz_provider: state.authz_provider.kind().as_str().to_string(),
        oidc_login_enabled: state.authn_provider.is_oidc_login_enabled(state.get_ref()),
        password_login_enabled: state.authn_provider.supports_password_login(),
        registration_enabled: state.authn_provider.supports_signup(),
    };

    Ok(Json(config))
}
