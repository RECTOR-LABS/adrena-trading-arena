use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;

use crate::api::models::AgentResponse;
use crate::api::state::AppState;
use crate::error::AppError;

/// GET /api/agents/:mint — get an agent's profile by mint address.
/// Returns mock data when no DB is connected.
pub async fn get_agent(
  State(state): State<Arc<AppState>>,
  Path(mint): Path<String>,
) -> Result<Json<AgentResponse>, AppError> {
  if let Some(pool) = &state.pool {
    let row = crate::db::agents::get_agent_by_mint(pool, &mint)
      .await?
      .ok_or_else(|| AppError::NotFound(format!("Agent {mint} not found")))?;

    return Ok(Json(AgentResponse {
      mint: row.mint,
      owner: row.owner,
      name: row.name,
      elo_rating: row.elo_rating,
      wins: row.wins,
      losses: row.losses,
      total_pnl: row.total_pnl,
      total_trades: row.total_trades,
      status: row.status,
    }));
  }

  // Mock data for skeleton mode
  Ok(Json(AgentResponse {
    mint: mint.clone(),
    owner: "OwnerWallet111111111111111111111111111111111".to_string(),
    name: "MockAgent".to_string(),
    elo_rating: 1200,
    wins: 5,
    losses: 3,
    total_pnl: 500_000,
    total_trades: 8,
    status: "active".to_string(),
  }))
}
