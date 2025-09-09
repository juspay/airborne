use http::StatusCode;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    impl_response_error,
    types::{ABErrorCodes, AppError, HasLabel},
};

/// Errors that can occur during application operations
#[derive(Error, Debug)]
pub enum OrgAppError {
    #[error("User not found: {0}")]
    UserNotFound(String),

    #[error("Organisation not found: {0}")]
    OrgNotFound(String),

    #[error("Application not found: {0}")]
    AppNotFound(String),

    #[error("Invalid access level: {0}")]
    InvalidAccessLevel(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

impl AppError for OrgAppError {
    fn code(&self) -> &'static str {
        match self {
            OrgAppError::UserNotFound(_) => ABErrorCodes::NotFound.label(),
            OrgAppError::OrgNotFound(_) => ABErrorCodes::NotFound.label(),
            OrgAppError::AppNotFound(_) => ABErrorCodes::NotFound.label(),
            OrgAppError::InvalidAccessLevel(_) => ABErrorCodes::Unauthorized.label(),
            OrgAppError::PermissionDenied(_) => ABErrorCodes::Unauthorized.label(),
        }
    }
    fn status_code(&self) -> StatusCode {
        match self {
            OrgAppError::UserNotFound(_) => StatusCode::NOT_FOUND,
            OrgAppError::OrgNotFound(_) => StatusCode::NOT_FOUND,
            OrgAppError::AppNotFound(_) => StatusCode::NOT_FOUND,
            OrgAppError::InvalidAccessLevel(_) => StatusCode::BAD_REQUEST,
            OrgAppError::PermissionDenied(_) => StatusCode::FORBIDDEN,
        }
    }
}
impl_response_error!(OrgAppError);

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
