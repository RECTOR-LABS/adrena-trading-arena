use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use crate::error::AppError;

impl IntoResponse for AppError {
  fn into_response(self) -> Response {
    let (status, message) = match &self {
      AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
      AppError::Config(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
      AppError::Database(_) | AppError::Pool(_) => (
        StatusCode::SERVICE_UNAVAILABLE,
        "Database temporarily unavailable".to_string(),
      ),
      AppError::Solana(msg) => (StatusCode::BAD_GATEWAY, msg.clone()),
      AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
    };

    tracing::error!(status = %status, error = %message, "API error response");

    (status, Json(json!({ "error": message }))).into_response()
  }
}
