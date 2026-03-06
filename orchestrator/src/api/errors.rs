use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use crate::error::AppError;

impl IntoResponse for AppError {
  fn into_response(self) -> Response {
    let (status, client_message) = match &self {
      AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
      AppError::Config(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
      AppError::Database(_) | AppError::Pool(_) => (
        StatusCode::SERVICE_UNAVAILABLE,
        "Database temporarily unavailable".to_string(),
      ),
      AppError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg.clone()),
      AppError::Solana(_msg) => (StatusCode::BAD_GATEWAY, "Upstream service error".to_string()),
      AppError::Internal(_msg) => (
        StatusCode::INTERNAL_SERVER_ERROR,
        "Internal server error".to_string(),
      ),
    };

    // Log the full error details server-side but don't expose to clients
    tracing::error!(status = %status, error = %self, "API error response");

    (status, Json(json!({ "error": client_message }))).into_response()
  }
}
