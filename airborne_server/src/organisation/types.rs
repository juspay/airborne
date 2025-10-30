use http::StatusCode;
use thiserror::Error;

use crate::{
    impl_response_error,
    types::{ABErrorCodes, AppError, HasLabel},
};

/// Errors that can occur during organization operations
#[derive(Error, Debug)]
pub enum OrgError {
    #[error("User not found: {0}")]
    UserNotFound(String),

    #[error("Organisation not found: {0}")]
    OrgNotFound(String),

    #[error("Invalid access level: {0}")]
    InvalidAccessLevel(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Last owner cannot be modified: {0}")]
    LastOwner(String),
}

impl AppError for OrgError {
    fn code(&self) -> &'static str {
        match self {
            OrgError::UserNotFound(_) => ABErrorCodes::NotFound.label(),
            OrgError::OrgNotFound(_) => ABErrorCodes::NotFound.label(),
            OrgError::InvalidAccessLevel(_) => ABErrorCodes::Unauthorized.label(),
            OrgError::PermissionDenied(_) => ABErrorCodes::Unauthorized.label(),
            OrgError::LastOwner(_) => ABErrorCodes::Unauthorized.label(),
        }
    }
    fn status_code(&self) -> StatusCode {
        match self {
            OrgError::UserNotFound(_) => StatusCode::NOT_FOUND,
            OrgError::OrgNotFound(_) => StatusCode::NOT_FOUND,
            OrgError::InvalidAccessLevel(_) | OrgError::LastOwner(_) => StatusCode::BAD_REQUEST,
            OrgError::PermissionDenied(_) => StatusCode::FORBIDDEN,
        }
    }
}
impl_response_error!(OrgError);
