use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

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
  fn from_row(row: &tokio_postgres::Row) -> Self {
    Self {
      id: row.get("id"),
      mint: row.get("mint"),
      owner: row.get("owner"),
      name: row.get("name"),
      strategy_hash: row.get("strategy_hash"),
      elo_rating: row.get("elo_rating"),
      wins: row.get("wins"),
      losses: row.get("losses"),
      total_pnl: row.get("total_pnl"),
      total_trades: row.get("total_trades"),
      status: row.get("status"),
      created_at: row.get("created_at"),
      updated_at: row.get("updated_at"),
    }
  }
}

/// Insert a new agent record. Returns the inserted row with generated ID and timestamps.
pub async fn insert_agent(pool: &Pool, agent: &AgentRow) -> Result<AgentRow, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_one(
      "INSERT INTO agents (mint, owner, name, strategy_hash, elo_rating, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *",
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

  Ok(AgentRow::from_row(&row))
}

/// Look up an agent by its on-chain mint address.
pub async fn get_agent_by_mint(
  pool: &Pool,
  mint: &str,
) -> Result<Option<AgentRow>, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_opt("SELECT * FROM agents WHERE mint = $1", &[&mint])
    .await?;

  Ok(row.as_ref().map(AgentRow::from_row))
}

/// Update an agent's ELO rating.
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

/// List agents, optionally filtering by status.
pub async fn list_agents(
  pool: &Pool,
  status: Option<&str>,
) -> Result<Vec<AgentRow>, AppError> {
  let client = pool.get().await?;
  let rows = match status {
    Some(s) => {
      client
        .query("SELECT * FROM agents WHERE status = $1 ORDER BY elo_rating DESC", &[&s])
        .await?
    }
    None => {
      client
        .query("SELECT * FROM agents ORDER BY elo_rating DESC", &[])
        .await?
    }
  };

  Ok(rows.iter().map(AgentRow::from_row).collect())
}
