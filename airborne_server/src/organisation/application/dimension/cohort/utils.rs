use crate::{
    organisation::application::dimension::cohort::types::{
        DefinitionMap, DefinitionValue, JsonLogicKey,
    },
    types as airborne_types,
    types::ABError,
    utils::document::document_to_json_value,
};
use aws_smithy_types::Document;
use std::collections::HashMap;

fn key_str_to_enum(s: &str) -> Option<JsonLogicKey> {
    Some(match s {
        "==" => JsonLogicKey::Eq,
        "and" => JsonLogicKey::And,
        "in" => JsonLogicKey::In,
        "jp_ver_ge" => JsonLogicKey::SemVerGe,
        "jp_ver_gt" => JsonLogicKey::SemVerGt,
        "jp_ver_le" => JsonLogicKey::SemVerLe,
        "jp_ver_lt" => JsonLogicKey::SemVerLt,
        "str_ge" => JsonLogicKey::StrGe,
        "str_gt" => JsonLogicKey::StrGt,
        "str_le" => JsonLogicKey::StrLe,
        "str_lt" => JsonLogicKey::StrLt,
        _ => return None,
    })
}

/// Parse a Document::Object into DefinitionMap, enforcing the And/Leaf rule.
pub fn parse_definition_map_object(
    obj: &HashMap<String, Document>,
) -> airborne_types::Result<DefinitionMap> {
    let mut out: DefinitionMap = HashMap::new();

    for (k, v) in obj {
        let Some(k_enum) = key_str_to_enum(k.as_str()) else {
            return Err(ABError::BadRequest(format!("Unknown comparator key: {k}")));
        };

        match k_enum {
            JsonLogicKey::And => {
                let Document::Object(nested) = v else {
                    return Err(ABError::BadRequest(
                        "Key 'and' must map to an object of nested comparators".into(),
                    ));
                };
                let nested_map = parse_definition_map_object(nested)?;
                out.insert(JsonLogicKey::And, DefinitionValue::Node(nested_map));
            }
            _ => {
                if let Document::Object(_) = v {
                    return Err(ABError::BadRequest(format!(
                        "{k_enum:?} must be a leaf value, not an object"
                    )));
                }
                out.insert(k_enum, DefinitionValue::Leaf(document_to_json_value(v)));
            }
        }
    }

    Ok(out)
}
