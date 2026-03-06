use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

const COMPETITION_COLUMNS: &str = "id, on_chain_id, arena_address, name, format, status, entry_fee, prize_pool, max_agents, registered_count, start_time, end_time, prize_mint, created_at, updated_at";

const MAX_LIMIT: i64 = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionRow {
  pub id: Uuid,
  pub on_chain_id: i64,
  pub arena_address: String,
  pub name: String,
  pub format: String,
  pub status: String,
  pub entry_fee: i64,
  pub prize_pool: i64,
  pub max_agents: i32,
  pub registered_count: i32,
  pub start_time: DateTime<Utc>,
  pub end_time: DateTime<Utc>,
  pub prize_mint: String,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

impl CompetitionRow {
  fn from_row(row: &tokio_postgres::Row) -> Result<Self, AppError> {
    Ok(Self {
      id: row.try_get("id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      on_chain_id: row.try_get("on_chain_id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      arena_address: row.try_get("arena_address").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      name: row.try_get("name").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      format: row.try_get("format").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      status: row.try_get("status").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      entry_fee: row.try_get("entry_fee").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      prize_pool: row.try_get("prize_pool").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      max_agents: row.try_get("max_agents").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      registered_count: row.try_get("registered_count").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      start_time: row.try_get("start_time").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      end_time: row.try_get("end_time").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      prize_mint: row.try_get("prize_mint").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      created_at: row.try_get("created_at").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      updated_at: row.try_get("updated_at").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
    })
  }
}

/// Insert a new competition. Returns the inserted row with generated ID.
pub async fn insert_competition(
  pool: &Pool,
  comp: &CompetitionRow,
) -> Result<CompetitionRow, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_one(
      &format!(
        "INSERT INTO competitions
         (on_chain_id, arena_address, name, format, status, entry_fee, prize_pool,
          max_agents, registered_count, start_time, end_time, prize_mint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING {COMPETITION_COLUMNS}"
      ),
      &[
        &comp.on_chain_id,
        &comp.arena_address,
        &comp.name,
        &comp.format,
        &comp.status,
        &comp.entry_fee,
        &comp.prize_pool,
        &comp.max_agents,
        &comp.registered_count,
        &comp.start_time,
        &comp.end_time,
        &comp.prize_mint,
      ],
    )
    .await?;

  CompetitionRow::from_row(&row)
}

/// Get a competition by its UUID.
pub async fn get_competition(
  pool: &Pool,
  id: &Uuid,
) -> Result<Option<CompetitionRow>, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_opt(
      &format!("SELECT {COMPETITION_COLUMNS} FROM competitions WHERE id = $1"),
      &[id],
    )
    .await?;

  row.as_ref().map(CompetitionRow::from_row).transpose()
}

/// List competitions with pagination, optionally filtering by status.
pub async fn list_competitions(
  pool: &Pool,
  status: Option<&str>,
  limit: i64,
  offset: i64,
) -> Result<Vec<CompetitionRow>, AppError> {
  let limit = limit.min(MAX_LIMIT);
  let client = pool.get().await?;
  let rows = match status {
    Some(s) => {
      client
        .query(
          &format!("SELECT {COMPETITION_COLUMNS} FROM competitions WHERE status = $1 ORDER BY start_time DESC LIMIT $2 OFFSET $3"),
          &[&s, &limit, &offset],
        )
        .await?
    }
    None => {
      client
        .query(
          &format!("SELECT {COMPETITION_COLUMNS} FROM competitions ORDER BY start_time DESC LIMIT $1 OFFSET $2"),
          &[&limit, &offset],
        )
        .await?
    }
  };

  rows.iter().map(CompetitionRow::from_row).collect()
}

/// Update a competition's status (e.g. Pending -> Active -> Settled).
pub async fn update_competition_status(
  pool: &Pool,
  id: &Uuid,
  status: &str,
) -> Result<(), AppError> {
  let client = pool.get().await?;
  let modified = client
    .execute(
      "UPDATE competitions SET status = $1, updated_at = NOW() WHERE id = $2",
      &[&status, id],
    )
    .await?;

  if modified == 0 {
    return Err(AppError::NotFound(format!("Competition {id} not found")));
  }
  Ok(())
}

/// Get leaderboard data: agents with their scores for a specific competition.
/// Joins competition_entries with agents and trades to compute leaderboard entries.
pub async fn get_leaderboard_entries(
  pool: &Pool,
  competition_id: &Uuid,
  limit: i64,
  offset: i64,
) -> Result<Vec<LeaderboardRow>, AppError> {
  let limit = limit.min(MAX_LIMIT);
  let client = pool.get().await?;
  let rows = client
    .query(
      "SELECT
         a.mint AS agent_mint,
         a.name AS agent_name,
         COALESCE(SUM(t.realized_pnl), 0) AS total_pnl,
         COUNT(t.id)::int AS trade_count,
         CASE WHEN COUNT(t.id) = 0 THEN 0.0
              ELSE COUNT(t.id) FILTER (WHERE t.realized_pnl > 0)::float / COUNT(t.id)::float
         END AS win_rate
       FROM agents a
       INNER JOIN competition_entries ce ON ce.agent_mint = a.mint
       LEFT JOIN trades t ON t.agent_mint = a.mint AND t.competition_id = ce.competition_id
       WHERE ce.competition_id = $1
       GROUP BY a.mint, a.name
       ORDER BY total_pnl DESC
       LIMIT $2 OFFSET $3",
      &[competition_id, &limit, &offset],
    )
    .await?;

  rows.iter().map(LeaderboardRow::from_row).collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardRow {
  pub agent_mint: String,
  pub agent_name: String,
  pub total_pnl: i64,
  pub trade_count: i32,
  pub win_rate: f64,
}

impl LeaderboardRow {
  fn from_row(row: &tokio_postgres::Row) -> Result<Self, AppError> {
    Ok(Self {
      agent_mint: row.try_get("agent_mint").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      agent_name: row.try_get("agent_name").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      total_pnl: row.try_get("total_pnl").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      trade_count: row.try_get("trade_count").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      win_rate: row.try_get("win_rate").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
    })
  }
}
