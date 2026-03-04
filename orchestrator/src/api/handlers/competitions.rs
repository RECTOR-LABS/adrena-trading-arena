use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use chrono::Utc;
use uuid::Uuid;

use crate::api::models::{CompetitionResponse, LeaderboardEntry};
use crate::api::state::AppState;
use crate::error::AppError;

/// GET /api/competitions — list all competitions.
/// Returns mock data when no DB is connected.
pub async fn list_competitions(
  State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CompetitionResponse>>, AppError> {
  if let Some(pool) = &state.pool {
    let rows = crate::db::competitions::list_competitions(pool, None).await?;
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
    return Ok(Json(competitions));
  }

  // Mock data for skeleton mode
  let now = Utc::now();
  Ok(Json(vec![CompetitionResponse {
    id: Uuid::nil(),
    on_chain_id: 1,
    name: "Arena Alpha #1".to_string(),
    format: "free_for_all".to_string(),
    status: "active".to_string(),
    entry_fee: 1_000_000,
    prize_pool: 10_000_000,
    max_agents: 16,
    registered_count: 8,
    start_time: now,
    end_time: now + chrono::Duration::hours(168),
  }]))
}

/// GET /api/competitions/:id — get a single competition by UUID.
/// Returns mock data when no DB is connected.
pub async fn get_competition(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Json<CompetitionResponse>, AppError> {
  let uuid = Uuid::parse_str(&id)
    .map_err(|_| AppError::NotFound(format!("Invalid competition ID: {id}")))?;

  if let Some(pool) = &state.pool {
    let row = crate::db::competitions::get_competition(pool, &uuid)
      .await?
      .ok_or_else(|| AppError::NotFound(format!("Competition {id} not found")))?;

    return Ok(Json(CompetitionResponse {
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
    }));
  }

  // Mock data for skeleton mode
  let now = Utc::now();
  Ok(Json(CompetitionResponse {
    id: uuid,
    on_chain_id: 1,
    name: "Arena Alpha #1".to_string(),
    format: "free_for_all".to_string(),
    status: "active".to_string(),
    entry_fee: 1_000_000,
    prize_pool: 10_000_000,
    max_agents: 16,
    registered_count: 8,
    start_time: now,
    end_time: now + chrono::Duration::hours(168),
  }))
}

/// GET /api/competitions/:id/leaderboard — get ranked agents for a competition.
/// Returns mock data when no DB is connected.
pub async fn get_leaderboard(
  State(_state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Json<Vec<LeaderboardEntry>>, AppError> {
  let _uuid = Uuid::parse_str(&id)
    .map_err(|_| AppError::NotFound(format!("Invalid competition ID: {id}")))?;

  // Leaderboard requires a scoring query across agents — for now return mock data.
  // Production implementation will join competition_entries with computed scores.
  Ok(Json(vec![
    LeaderboardEntry {
      rank: 1,
      agent_mint: "Agent1Mint11111111111111111111111111111111111".to_string(),
      agent_name: "AlphaBot".to_string(),
      score: 7500,
      pnl: 1_500_000,
      trades: 42,
      win_rate: 0.71,
      max_drawdown: 0.08,
    },
    LeaderboardEntry {
      rank: 2,
      agent_mint: "Agent2Mint22222222222222222222222222222222222".to_string(),
      agent_name: "DeltaHedge".to_string(),
      score: 5200,
      pnl: 800_000,
      trades: 28,
      win_rate: 0.64,
      max_drawdown: 0.12,
    },
    LeaderboardEntry {
      rank: 3,
      agent_mint: "Agent3Mint33333333333333333333333333333333333".to_string(),
      agent_name: "MomentumRider".to_string(),
      score: 3100,
      pnl: 350_000,
      trades: 55,
      win_rate: 0.58,
      max_drawdown: 0.15,
    },
  ]))
}
