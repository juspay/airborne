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

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SchemaNode {
    pub description: String,
    pub default_value: Value,
    pub schema: Value,
}

#[derive(Deserialize)]
pub struct PutPropertiesSchemaRequest {
    pub properties: BTreeMap<String, SchemaNode>,
}

#[derive(Serialize)]
pub struct PutPropertiesSchemaResponse {
    pub properties: BTreeMap<String, SchemaNode>,
}

pub type GetPropertiesSchemaResponse = PutPropertiesSchemaResponse;

#[derive(Clone, Debug)]
pub struct PutPropertiesSchemaTaskMetadata {
    pub key: String,
    pub schema_new: Option<SchemaNode>,
    pub schema_old: Option<SchemaNode>,
    pub action: PutPropertiesSchemaTaskAction,
    pub org_id: String,
    pub workspace_id: String,
}

#[derive(Clone, Debug)]
pub enum PutPropertiesSchemaTaskAction {
    Create,
    Update,
    Delete,
}

#[derive(Serialize, Default)]
pub struct ConfigProperty {
    pub dimensions: BTreeMap<String, Value>,
    pub experiment_id: String,
    pub status: String,
    pub properties: Value,
}

#[derive(Serialize)]
pub struct ListPropertiesResponse {
    pub properties: Vec<ConfigProperty>,
}
