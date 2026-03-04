use axum::Json;

use crate::api::models::HealthResponse;

/// GET /health — returns service status and version.
pub async fn health() -> Json<HealthResponse> {
  Json(HealthResponse {
    status: "ok".to_string(),
    version: env!("CARGO_PKG_VERSION").to_string(),
  })
}
