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

use serde::{Deserialize, Serialize};
use superposition_rust_sdk::Client;
use google_sheets4::{hyper_rustls, hyper_util, Sheets};

use crate::utils::db;

#[derive(Clone)]
pub struct AppState {
    pub env: Environment,
    pub db_pool: db::DbPool,
    pub s3_client: aws_sdk_s3::Client,
    pub superposition_client: Client,
    pub sheets_hub: Option<Sheets<hyper_rustls::HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>>>
}

#[derive(Clone, Debug)]
pub struct Environment {
    pub public_url: String,
    pub keycloak_url: String,
    pub keycloak_external_url: String,
    pub keycloak_public_key: String,
    pub client_id: String,
    pub secret: String,
    pub realm: String,
    pub bucket_name: String,
    pub superposition_org_id: String,
    pub enable_google_signin: bool,
    pub organisation_creation_disabled: bool,
    pub google_spreadsheet_id: String,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct Resource {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub url: String,
}

#[derive(Serialize, Debug)]
pub struct ReleaseConfig {
    pub version: String,
    pub config: Config,
    pub package: Package,
    pub resources: Vec<Resource>,
}

#[derive(Serialize, Debug)]
pub struct Config {
    pub version: String,
    pub release_config_timeout: u32,
    pub boot_timeout: u32,
    pub properties: ConfigProperties,
}

#[derive(Serialize, Debug)]
pub struct ConfigProperties {
    pub tenant_info: serde_json::Value,
}

#[derive(Debug)]
pub struct PackageMeta {
    pub package: InnerPackage,
}

#[derive(Deserialize, Debug)]
pub struct InnerPackage {
    pub version: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Package {
    pub name: String,
    pub version: String,
    pub properties: serde_json::Value,
    pub index: Resource,
    pub important: Vec<Resource>,
    pub lazy: Vec<Resource>,
}