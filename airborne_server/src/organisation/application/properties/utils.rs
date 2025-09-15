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

use std::collections::HashSet;

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
