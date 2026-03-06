use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::api::models::{CompetitionResponse, LeaderboardEntry};
use crate::api::state::AppState;
use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
  pub limit: Option<i64>,
  pub offset: Option<i64>,
}

const DEFAULT_LIMIT: i64 = 100;

/// GET /api/competitions — list all competitions with pagination.
pub async fn list_competitions(
  State(state): State<Arc<AppState>>,
  Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<CompetitionResponse>>, AppError> {
  let pool = state.pool.as_ref().ok_or_else(|| {
    AppError::ServiceUnavailable("Database not available".to_string())
  })?;

  let limit = params.limit.unwrap_or(DEFAULT_LIMIT);
  let offset = params.offset.unwrap_or(0);

  let rows = crate::db::competitions::list_competitions(pool, None, limit, offset).await?;
  let competitions: Vec<CompetitionResponse> = rows
    .into_iter()
    .map(|r| CompetitionResponse {
      id: r.id,
      on_chain_id: r.on_chain_id,
      name: r.name,
      format: r.format,
      status: r.status,
      entry_fee: r.entry_fee,
      prize_pool: r.prize_pool,
      max_agents: r.max_agents,
      registered_count: r.registered_count,
      start_time: r.start_time,
      end_time: r.end_time,
    })
    .collect();

  Ok(Json(competitions))
}

/// GET /api/competitions/:id — get a single competition by UUID.
pub async fn get_competition(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Json<CompetitionResponse>, AppError> {
  let uuid = Uuid::parse_str(&id)
    .map_err(|_| AppError::NotFound(format!("Invalid competition ID: {id}")))?;

  let pool = state.pool.as_ref().ok_or_else(|| {
    AppError::ServiceUnavailable("Database not available".to_string())
  })?;

  let row = crate::db::competitions::get_competition(pool, &uuid)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Competition {id} not found")))?;

  Ok(Json(CompetitionResponse {
    id: row.id,
    on_chain_id: row.on_chain_id,
    name: row.name,
    format: row.format,
    status: row.status,
    entry_fee: row.entry_fee,
    prize_pool: row.prize_pool,
    max_agents: row.max_agents,
    registered_count: row.registered_count,
    start_time: row.start_time,
    end_time: row.end_time,
  }))
}

/// GET /api/competitions/:id/leaderboard — get ranked agents for a competition.
pub async fn get_leaderboard(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
  Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<LeaderboardEntry>>, AppError> {
  let uuid = Uuid::parse_str(&id)
    .map_err(|_| AppError::NotFound(format!("Invalid competition ID: {id}")))?;

  let pool = state.pool.as_ref().ok_or_else(|| {
    AppError::ServiceUnavailable("Database not available".to_string())
  })?;

  let limit = params.limit.unwrap_or(DEFAULT_LIMIT);
  let offset = params.offset.unwrap_or(0);

  let rows = crate::db::competitions::get_leaderboard_entries(pool, &uuid, limit, offset).await?;

  let entries: Vec<LeaderboardEntry> = rows
    .into_iter()
    .enumerate()
    .map(|(i, r)| LeaderboardEntry {
      rank: (offset as i32) + (i as i32) + 1,
      agent_mint: r.agent_mint,
      agent_name: r.agent_name,
      score: r.total_pnl,
      pnl: r.total_pnl,
      trades: r.trade_count,
      win_rate: r.win_rate,
      max_drawdown: 0.0, // Drawdown requires equity curve computation — deferred to scoring engine
    })
    .collect();

  Ok(Json(entries))
}
