use std::collections::HashMap;

use aws_smithy_types::Document;
use log::info;
use serde_json::{json, Map, Value};

use crate::types::ABError;

pub fn document_to_json_value(doc: &Document) -> Value {
    match doc {
        Document::Null => Value::Null,

        Document::Bool(b) => Value::Bool(*b),

        Document::Number(n) => match n {
            aws_smithy_types::Number::PosInt(a) => json!(a),
            aws_smithy_types::Number::NegInt(a) => json!(a),
            aws_smithy_types::Number::Float(a) => json!(a),
        },

        Document::String(s) => Value::String(s.clone()),

        Document::Array(arr) => {
            let vec = arr.iter().map(document_to_json_value).collect();
            Value::Array(vec)
        }

        Document::Object(obj) => {
            let map = obj
                .iter()
                .map(|(k, v)| (k.clone(), document_to_json_value(v)))
                .collect::<Map<_, _>>();
            Value::Object(map)
        }
    }
}

pub fn value_to_document(doc: &Value) -> Document {
    match doc {
        Value::Null => Document::Null,

        Value::Bool(b) => Document::Bool(*b),

        // Unwrap is safe as long as if checks are present
        Value::Number(n) => {
            if serde_json::Number::is_u64(n) {
                //PosInt
                Document::from(n.as_u64().unwrap())
            } else if serde_json::Number::is_i64(n) {
                //NegInt
                Document::from(n.as_i64().unwrap())
            } else if serde_json::Number::is_f64(n) {
                //Float
                Document::from(n.as_f64().unwrap())
            } else {
                // Handle other number types if necessary
                Document::Null
            }
        }

        Value::String(s) => Document::String(s.clone()),

        Value::Array(arr) => {
            let vec = arr.iter().map(value_to_document).collect();
            Document::Array(vec)
        }

        Value::Object(obj) => {
            let map = obj
                .iter()
                .map(|(k, v)| (k.clone(), value_to_document(v)))
                .collect::<HashMap<_, _>>();
            Document::Object(map)
        }
    }
}

pub fn dotted_docs_to_nested<T>(input: T) -> Result<Value, ABError>
where
    T: IntoIterator<Item = (String, Document)>,
{
    let mut root = Value::Object(Map::new());

    for (key, doc) in input {
        // Convert Smithy Document -> serde_json::Value once.
        let val = document_to_json_value(&doc);

        // Iterative descent through dotted path.
        let mut cursor = &mut root;
        let mut it = key.split('.');
        let mut prefix = String::new();

        // We need the last segment to insert into.
        let Some(last) = it.next_back() else { continue };

        for seg in it {
            if !prefix.is_empty() {
                prefix.push('.');
            }
            prefix.push_str(seg);

            if !cursor.is_object() {
                info!(
                    "Path conflict at {}: found {}",
                    prefix.clone(),
                    type_name(cursor)
                );
                return Err(ABError::InternalServerError(format!(
                    "Path conflict at {}: found {}",
                    prefix.clone(),
                    type_name(cursor)
                )));
            }

            let obj = cursor.as_object_mut().unwrap();
            cursor = obj
                .entry(seg.to_string())
                .or_insert_with(|| Value::Object(Map::new()));
        }

        // Insert the value at the parent object
        if !cursor.is_object() {
            info!(
                "Path conflict at {}: found {}",
                prefix.clone(),
                type_name(cursor)
            );
            return Err(ABError::InternalServerError(format!(
                "Path conflict at {}: found {}",
                prefix.clone(),
                type_name(cursor)
            )));
        }
        cursor
            .as_object_mut()
            .unwrap()
            .insert(last.to_string(), val);
    }

    Ok(root)
}

fn type_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
pub fn schema_doc_to_hashmap(doc: &Document) -> HashMap<String, Document> {
    match doc {
        Document::Object(map) => map.clone(),
        _ => HashMap::new(),
    }
}

pub fn hashmap_to_json_value(hashmap: &HashMap<String, Document>) -> Value {
    let val_map = hashmap
        .iter()
        .map(|(k, v)| (k.clone(), document_to_json_value(v)))
        .collect::<Map<_, _>>();
    Value::Object(val_map)
}
