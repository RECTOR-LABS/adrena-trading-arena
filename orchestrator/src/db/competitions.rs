use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

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
  fn from_row(row: &tokio_postgres::Row) -> Self {
    Self {
      id: row.get("id"),
      on_chain_id: row.get("on_chain_id"),
      arena_address: row.get("arena_address"),
      name: row.get("name"),
      format: row.get("format"),
      status: row.get("status"),
      entry_fee: row.get("entry_fee"),
      prize_pool: row.get("prize_pool"),
      max_agents: row.get("max_agents"),
      registered_count: row.get("registered_count"),
      start_time: row.get("start_time"),
      end_time: row.get("end_time"),
      prize_mint: row.get("prize_mint"),
      created_at: row.get("created_at"),
      updated_at: row.get("updated_at"),
    }
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
      "INSERT INTO competitions
       (on_chain_id, arena_address, name, format, status, entry_fee, prize_pool,
        max_agents, registered_count, start_time, end_time, prize_mint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *",
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

  Ok(CompetitionRow::from_row(&row))
}

/// Get a competition by its UUID.
pub async fn get_competition(
  pool: &Pool,
  id: &Uuid,
) -> Result<Option<CompetitionRow>, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_opt("SELECT * FROM competitions WHERE id = $1", &[id])
    .await?;

  Ok(row.as_ref().map(CompetitionRow::from_row))
}

/// List competitions, optionally filtering by status.
pub async fn list_competitions(
  pool: &Pool,
  status: Option<&str>,
) -> Result<Vec<CompetitionRow>, AppError> {
  let client = pool.get().await?;
  let rows = match status {
    Some(s) => {
      client
        .query(
          "SELECT * FROM competitions WHERE status = $1 ORDER BY start_time DESC",
          &[&s],
        )
        .await?
    }
    None => {
      client
        .query("SELECT * FROM competitions ORDER BY start_time DESC", &[])
        .await?
    }
  };

  Ok(rows.iter().map(CompetitionRow::from_row).collect())
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
