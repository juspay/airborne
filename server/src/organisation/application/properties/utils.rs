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

use std::collections::{HashMap, HashSet};

use aws_smithy_types::{Number as SmithyNumber, Document};
use serde_json::{Value};

fn value_to_doc(v: &Value) -> Document {
    match v {
        Value::String(s) => Document::String(s.clone()),
        Value::Bool(b) => Document::Bool(*b),
        Value::Number(n) => {
            if serde_json::Number::is_u64(n) {
                Document::from(n.as_u64().unwrap())
            } else if serde_json::Number::is_i64(n) {
                Document::from(n.as_i64().unwrap())
            } else if serde_json::Number::is_f64(n) {
                Document::from(n.as_f64().unwrap())
            } else {
                Document::Null
            }
        }
        Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(value_to_doc(item));
            }
            Document::Array(out)
        }
        Value::Null => Document::Null,
        Value::Object(obj) => {
            let mut out: HashMap<String, Document> = HashMap::with_capacity(obj.len());
            for (k, v) in obj {
                out.insert(k.clone(), value_to_doc(v));
            }
            Document::Object(out)
        },
    }
}

/// Items in `existing` but NOT in `new`
pub fn to_be_deleted(existing: &[String], new: &[String]) -> Vec<String> {
    let new_set: HashSet<&str> = new.iter().map(|s| s.as_str()).collect();
    existing
        .iter()
        .filter(|s| !new_set.contains(s.as_str()))
        .cloned()
        .collect()
}

/// Items present in BOTH `existing` and `new`
pub fn to_be_updated(existing: &[String], new: &[String]) -> Vec<String> {
    let new_set: HashSet<&str> = new.iter().map(|s| s.as_str()).collect();
    existing
        .iter()
        .filter(|s| new_set.contains(s.as_str()))
        .cloned()
        .collect()
}

/// Items in `new` but NOT in `existing`
pub fn to_be_created(existing: &[String], new: &[String]) -> Vec<String> {
    let existing_set: HashSet<&str> = existing.iter().map(|s| s.as_str()).collect();
    new.iter()
        .filter(|s| !existing_set.contains(s.as_str()))
        .cloned()
        .collect()
}