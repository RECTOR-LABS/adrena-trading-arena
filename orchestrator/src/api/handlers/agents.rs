use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;

use crate::api::models::AgentResponse;
use crate::api::state::AppState;
use crate::error::AppError;

/// GET /api/agents/:mint — get an agent's profile by mint address.
pub async fn get_agent(
  State(state): State<Arc<AppState>>,
  Path(mint): Path<String>,
) -> Result<Json<AgentResponse>, AppError> {
  let pool = state.pool.as_ref().ok_or_else(|| {
    AppError::ServiceUnavailable("Database not available".to_string())
  })?;

  let row = crate::db::agents::get_agent_by_mint(pool, &mint)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Agent {mint} not found")))?;

  Ok(Json(AgentResponse {
    mint: row.mint,
    owner: row.owner,
    name: row.name,
    elo_rating: row.elo_rating,
    wins: row.wins,
    losses: row.losses,
    total_pnl: row.total_pnl,
    total_trades: row.total_trades,
    status: row.status,
  }))
}
