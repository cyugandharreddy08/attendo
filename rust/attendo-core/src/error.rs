use thiserror::Error;

#[derive(Debug, Error)]
pub enum AttendoError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("not found: {entity} ({id})")]
    NotFound { entity: &'static str, id: String },

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("network error: {0}")]
    Network(String),

    #[error("engine not initialized")]
    NotInitialized,
}

pub type AttendoResult<T> = Result<T, AttendoError>;
