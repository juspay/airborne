use std::fmt::{Display, Formatter};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Default, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum DimensionSchema {
    #[default]
    String,
}

impl Display for DimensionSchema {
    fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
        match self {
            DimensionSchema::String => write!(f, "string"),
        }
    }
}

impl DimensionSchema {
    // Method that returns the JSON representation
    pub fn to_json(&self) -> Value {
        match self {
            Self::String => serde_json::json!({ "type": "string" }),
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DimensionType {
    Cohort,
    #[default]
    Standard,
}

#[derive(Deserialize)]
pub struct CreateDimensionRequest {
    pub dimension: String,
    #[serde(default)]
    pub schema: DimensionSchema,
    pub description: String,
    #[serde(default)]
    pub dimension_type: DimensionType,
    pub depends_on: Option<String>,
    // function_name: Option<String>,
    // mandatory: Option<bool>,
}

#[derive(Deserialize)]
pub struct ListDimensionsQuery {
    pub page: Option<i32>,
    pub count: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateDimensionRequest {
    pub position: Option<i32>,
    pub change_reason: String,
}

#[derive(Deserialize)]
pub struct CreateReleaseViewRequest {
    pub name: String,
    pub dimensions: Value,
}

#[derive(Deserialize)]
pub struct ListReleaseViewsQuery {
    pub page: Option<i32>,
    pub count: Option<i32>,
}

#[derive(Serialize)]
pub struct ReleaseView {
    pub id: Uuid,
    pub name: String,
    pub dimensions: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ListReleaseViewsResponse {
    pub data: Vec<ReleaseView>,
    pub total_items: Option<i64>,
    pub total_pages: Option<i64>,
}

#[derive(Deserialize)]
pub struct UpdateReleaseViewRequest {
    pub dimensions: Value,
    pub name: String,
}

#[derive(Serialize)]
pub struct DeleteReleaseViewResponse {
    pub success: bool,
}

#[derive(Serialize)]
pub struct ListDimensionsResponse {
    pub total_pages: Option<i32>,
    pub total_items: Option<i32>,
    pub data: Vec<Dimension>,
}

#[derive(Serialize)]
pub struct Dimension {
    pub dimension: String,
    pub position: i32,
    pub schema: Value,
    pub description: String,
    pub change_reason: String,
    pub mandatory: Option<bool>,
    pub dimension_type: DimensionType,
    pub depends_on: Option<String>,
}
