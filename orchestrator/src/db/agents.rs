use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

const AGENT_COLUMNS: &str = "id, mint, owner, name, strategy_hash, elo_rating, wins, losses, total_pnl, total_trades, status, created_at, updated_at";

#[allow(dead_code)]
const MAX_LIMIT: i64 = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRow {
  pub id: Uuid,
  pub mint: String,
  pub owner: String,
  pub name: String,
  pub strategy_hash: String,
  pub elo_rating: i32,
  pub wins: i32,
  pub losses: i32,
  pub total_pnl: i64,
  pub total_trades: i32,
  pub status: String,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

impl AgentRow {
  fn from_row(row: &tokio_postgres::Row) -> Result<Self, AppError> {
    Ok(Self {
      id: row.try_get("id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      mint: row.try_get("mint").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      owner: row.try_get("owner").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      name: row.try_get("name").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      strategy_hash: row.try_get("strategy_hash").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      elo_rating: row.try_get("elo_rating").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      wins: row.try_get("wins").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      losses: row.try_get("losses").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      total_pnl: row.try_get("total_pnl").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      total_trades: row.try_get("total_trades").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      status: row.try_get("status").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      created_at: row.try_get("created_at").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      updated_at: row.try_get("updated_at").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
    })
  }
}

/// Insert a new agent record. Returns the inserted row with generated ID and timestamps.
#[allow(dead_code)]
pub async fn insert_agent(pool: &Pool, agent: &AgentRow) -> Result<AgentRow, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_one(
      &format!(
        "INSERT INTO agents (mint, owner, name, strategy_hash, elo_rating, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING {AGENT_COLUMNS}"
      ),
      &[
        &agent.mint,
        &agent.owner,
        &agent.name,
        &agent.strategy_hash,
        &agent.elo_rating,
        &agent.status,
      ],
    )
    .await?;

  AgentRow::from_row(&row)
}

/// Look up an agent by its on-chain mint address.
pub async fn get_agent_by_mint(
  pool: &Pool,
  mint: &str,
) -> Result<Option<AgentRow>, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_opt(
      &format!("SELECT {AGENT_COLUMNS} FROM agents WHERE mint = $1"),
      &[&mint],
    )
    .await?;

  row.as_ref().map(AgentRow::from_row).transpose()
}

/// Update an agent's ELO rating.
#[allow(dead_code)]
pub async fn update_agent_elo(
  pool: &Pool,
  mint: &str,
  new_elo: i32,
) -> Result<(), AppError> {
  let client = pool.get().await?;
  let modified = client
    .execute(
      "UPDATE agents SET elo_rating = $1, updated_at = NOW() WHERE mint = $2",
      &[&new_elo, &mint],
    )
    .await?;

  if modified == 0 {
    return Err(AppError::NotFound(format!("Agent with mint {mint} not found")));
  }
  Ok(())
}

/// List agents with pagination, optionally filtering by status.
#[allow(dead_code)]
pub async fn list_agents(
  pool: &Pool,
  status: Option<&str>,
  limit: i64,
  offset: i64,
) -> Result<Vec<AgentRow>, AppError> {
  let limit = limit.min(MAX_LIMIT);
  let client = pool.get().await?;
  let rows = match status {
    Some(s) => {
      client
        .query(
          &format!("SELECT {AGENT_COLUMNS} FROM agents WHERE status = $1 ORDER BY elo_rating DESC LIMIT $2 OFFSET $3"),
          &[&s, &limit, &offset],
        )
        .await?
    }
    None => {
      client
        .query(
          &format!("SELECT {AGENT_COLUMNS} FROM agents ORDER BY elo_rating DESC LIMIT $1 OFFSET $2"),
          &[&limit, &offset],
        )
        .await?
    }
  };

  rows.iter().map(AgentRow::from_row).collect()
}
