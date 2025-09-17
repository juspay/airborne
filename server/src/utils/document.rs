use std::collections::HashMap;

use aws_smithy_types::Document;
use serde_json::{json, Map, Value};

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

pub fn get_scheme<T>(v: T) -> Document
where
    Document: From<T>,
{
    let v = Document::from(v);
    Document::Object(match v {
        // Don't use JSON macro. It is too heavy
        // Change this to Value::Object + Map
        Document::String(_) => {
            let mut map = HashMap::new();
            map.insert("pattern".to_string(), Document::String(String::from(".*")));
            map.insert("type".to_string(), Document::String(String::from("string")));
            map
        }
        Document::Number(_) => {
            let mut map = HashMap::new();
            map.insert(
                "type".to_string(),
                Document::String(String::from("integer")),
            );
            map
        }
        Document::Array(_) => {
            let mut map = HashMap::new();
            map.insert("type".to_string(), Document::String(String::from("array")));
            let mut submap = HashMap::new();
            submap.insert("type".to_string(), Document::String(String::from("string")));
            map.insert("items".to_string(), Document::Object(submap));
            map
        }
        _ => {
            let mut map = HashMap::new();
            map.insert("type".to_string(), Document::String(String::from("object")));
            map
        }
    })
}