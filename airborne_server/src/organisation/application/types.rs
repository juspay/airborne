use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Application {
    pub application: String,
    pub organisation: String,
    pub access: Vec<String>,
}
