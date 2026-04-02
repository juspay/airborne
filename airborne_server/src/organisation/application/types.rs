use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Application {
    pub application: String,
    pub organisation: String,
    pub access: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ApplicationCreateRequest {
    pub application: String,
}
