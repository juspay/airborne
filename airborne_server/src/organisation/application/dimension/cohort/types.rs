use std::collections::HashMap;

use aws_smithy_types::Document;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::{
    organisation::application::dimension::{cohort::utils, types::DimensionSchema},
    types::ABError,
    utils::document::value_to_document,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Comparator {
    SemverGt,
    SemverGe,
    StrGt,
    StrGe,
}

impl From<Comparator> for JsonLogicKey {
    fn from(cmp: Comparator) -> Self {
        match cmp {
            Comparator::SemverGe => JsonLogicKey::SemVerGe,
            Comparator::SemverGt => JsonLogicKey::SemVerGt,
            Comparator::StrGe => JsonLogicKey::StrGe,
            Comparator::StrGt => JsonLogicKey::StrGt,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateCohortDimensionCheckpointInput {
    pub name: String,
    pub value: String,
    pub comparator: Comparator,
}

pub type CreateCohortDimensionCheckpointOutput = CreateCohortDimensionCheckpointInput;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateCohortGroupInput {
    pub name: String,
    pub members: Vec<String>,
}

pub type CreateCohortGroupOutput = CreateCohortGroupInput;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdatePriorityInput {
    pub priority_map: HashMap<String, i32>,
}

pub type UpdatePriorityOutput = UpdatePriorityInput;

pub type GetPriorityOutput = UpdatePriorityOutput;

pub type DefinitionMap = HashMap<JsonLogicKey, DefinitionValue>;

#[derive(Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum DefinitionValue {
    Node(DefinitionMap),
    Leaf(Value),
}

impl DefinitionValue {
    pub fn to_json(&self) -> Value {
        match self {
            DefinitionValue::Leaf(v) => v.clone(),
            DefinitionValue::Node(map) => {
                let mut obj = Map::new();
                for (k, v) in map {
                    obj.insert(k.into(), v.to_json());
                }
                Value::Object(obj)
            }
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct CohortDimensionSchema {
    pub r#type: DimensionSchema,
    pub r#enum: Vec<String>,
    pub definitions: HashMap<CohortName, DefinitionMap>,
}

pub type CohortName = String;

#[derive(Serialize, Eq, Hash, PartialEq, Debug, Clone)]
pub enum JsonLogicKey {
    #[serde(rename = "==")]
    Eq, // Used for default
    #[serde(rename = "and")]
    And, // Used for mid checkpoints having both lower and upper bounds
    #[serde(rename = "in")]
    In, // Used for Grouping
    #[serde(rename = "jp_ver_ge")]
    SemVerGe,
    #[serde(rename = "jp_ver_gt")]
    SemVerGt,
    #[serde(rename = "jp_ver_le")]
    SemVerLe,
    #[serde(rename = "jp_ver_lt")]
    SemVerLt,
    #[serde(rename = "str_ge")]
    StrGe,
    #[serde(rename = "str_gt")]
    StrGt,
    #[serde(rename = "str_le")]
    StrLe,
    #[serde(rename = "str_lt")]
    StrLt,
}

impl From<&JsonLogicKey> for String {
    fn from(key: &JsonLogicKey) -> Self {
        match key {
            JsonLogicKey::Eq => "==".to_string(),
            JsonLogicKey::And => "and".to_string(),
            JsonLogicKey::In => "in".to_string(),
            JsonLogicKey::SemVerGe => "jp_ver_ge".to_string(),
            JsonLogicKey::SemVerGt => "jp_ver_gt".to_string(),
            JsonLogicKey::SemVerLe => "jp_ver_le".to_string(),
            JsonLogicKey::SemVerLt => "jp_ver_lt".to_string(),
            JsonLogicKey::StrGe => "str_ge".to_string(),
            JsonLogicKey::StrGt => "str_gt".to_string(),
            JsonLogicKey::StrLe => "str_le".to_string(),
            JsonLogicKey::StrLt => "str_lt".to_string(),
        }
    }
}

impl TryFrom<HashMap<String, Document>> for CohortDimensionSchema {
    type Error = ABError;

    fn try_from(map: HashMap<String, Document>) -> Result<Self, Self::Error> {
        let r#type = match map.get("type") {
            Some(Document::String(s)) if s == "string" => DimensionSchema::String,
            _ => DimensionSchema::String,
        };

        let r#enum: Vec<String> = match map.get("enum") {
            Some(Document::Array(arr)) => arr
                .iter()
                .filter_map(|item| {
                    if let Document::String(s) = item {
                        Some(s.clone())
                    } else {
                        None
                    }
                })
                .collect(),
            _ => Vec::new(),
        };

        let definitions: HashMap<CohortName, DefinitionMap> = match map.get("definitions") {
            Some(Document::Object(def_map)) => {
                let mut out: HashMap<CohortName, DefinitionMap> = HashMap::new();

                for (cohort_name, inner_doc) in def_map {
                    let Document::Object(inner_obj) = inner_doc else {
                        return Err(ABError::BadRequest(format!(
                            "definitions.{cohort_name} must be an object"
                        )));
                    };
                    let parsed = utils::parse_definition_map_object(inner_obj)?;
                    out.insert(cohort_name.clone(), parsed);
                }

                out
            }
            None | Some(_) => HashMap::new(),
        };

        Ok(Self {
            r#type,
            r#enum,
            definitions,
        })
    }
}

impl CohortDimensionSchema {
    fn default_key() -> String {
        "hjfeufdwu23eyft38427fgu4y3gfy43ftg834gfy34fg834ft348fyg4u3yfg634fguyegvf".to_string()
        // Random string to avoid conflicts
    }

    pub fn to_kv_str_doc(&self) -> HashMap<String, Document> {
        let mut schema: HashMap<String, Document> = HashMap::new();
        schema.insert(
            "type".to_string(),
            Document::String(self.r#type.to_string()),
        );
        schema.insert(
            "enum".to_string(),
            Document::Array(
                self.r#enum
                    .iter()
                    .map(|e| Document::String(e.clone()))
                    .collect(),
            ),
        );

        let mut outer_map = HashMap::new();

        for (cohort, inner) in &self.definitions {
            let mut inner_map = HashMap::new();

            for (key, val) in inner {
                let key_str: String = key.into();

                let doc_val = value_to_document(&val.to_json());
                inner_map.insert(key_str, doc_val);
            }

            outer_map.insert(cohort.to_string(), Document::Object(inner_map));
        }

        schema.insert("definitions".to_string(), Document::Object(outer_map));
        schema
    }

    pub fn default(depends_on: String) -> Self {
        let mut default_cohort_definition = HashMap::new();
        default_cohort_definition.insert(
            JsonLogicKey::Eq,
            DefinitionValue::Leaf(serde_json::json!([{ "var": depends_on }, Self::default_key()])),
        );
        Self {
            r#type: DimensionSchema::String,
            r#enum: vec![Self::default_key(), "otherwise".to_string()],
            definitions: HashMap::from([(Self::default_key(), default_cohort_definition)]),
        }
    }

    /// Checks if the enum contains the default synthetic cohort
    pub fn check_has_default(&self) -> bool {
        self.r#enum.iter().any(|val| *val == Self::default_key())
    }

    /// Removes the default from the enum and definitions (if present)
    pub fn remove_default(&mut self) {
        let default_key = Self::default_key();
        self.r#enum.retain(|val| *val != default_key);
        self.definitions.remove(&default_key);
    }
}
