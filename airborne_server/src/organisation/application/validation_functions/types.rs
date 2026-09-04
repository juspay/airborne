use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct ValidationFunctionResponse {
    pub function_code: String,
}

#[derive(Deserialize)]
pub struct UpdateValidationFunctionRequest {
    pub function_code: String,
}

#[derive(Deserialize)]
pub struct TestValidationFunctionRequest {
    pub function_code: String,
    pub test_args: serde_json::Value,
}

#[derive(Serialize)]
pub struct TestValidationFunctionResponse {
    pub valid: bool,
    pub result: Option<bool>,
    pub error: Option<String>,
}
