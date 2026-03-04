use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionSnapshotRow {
  pub id: Uuid,
  pub agent_mint: String,
  pub competition_id: Uuid,
  pub custody: String,
  pub side: String,
  pub size_usd: i64,
  pub collateral_usd: i64,
  pub entry_price: i64,
  pub mark_price: i64,
  pub unrealized_pnl: i64,
  pub leverage: i16,
  pub snapshot_at: DateTime<Utc>,
}

impl PositionSnapshotRow {
  fn from_row(row: &tokio_postgres::Row) -> Self {
    Self {
      id: row.get("id"),
      agent_mint: row.get("agent_mint"),
      competition_id: row.get("competition_id"),
      custody: row.get("custody"),
      side: row.get("side"),
      size_usd: row.get("size_usd"),
      collateral_usd: row.get("collateral_usd"),
      entry_price: row.get("entry_price"),
      mark_price: row.get("mark_price"),
      unrealized_pnl: row.get("unrealized_pnl"),
      leverage: row.get("leverage"),
      snapshot_at: row.get("snapshot_at"),
    }
  }
}

/// Insert a new position snapshot record.
pub async fn insert_position_snapshot(
  pool: &Pool,
  snap: &PositionSnapshotRow,
) -> Result<(), AppError> {
  let client = pool.get().await?;
  client
    .execute(
      "INSERT INTO position_snapshots
       (agent_mint, competition_id, custody, side, size_usd, collateral_usd,
        entry_price, mark_price, unrealized_pnl, leverage, snapshot_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      &[
        &snap.agent_mint,
        &snap.competition_id,
        &snap.custody,
        &snap.side,
        &snap.size_usd,
        &snap.collateral_usd,
        &snap.entry_price,
        &snap.mark_price,
        &snap.unrealized_pnl,
        &snap.leverage,
        &snap.snapshot_at,
      ],
    )
    .await?;

  Ok(())
}

/// Get the most recent position snapshots for an agent in a competition.
/// Returns snapshots from the latest snapshot timestamp.
pub async fn get_latest_positions(
  pool: &Pool,
  agent_mint: &str,
  competition_id: &Uuid,
) -> Result<Vec<PositionSnapshotRow>, AppError> {
  let client = pool.get().await?;
  let rows = client
    .query(
      "SELECT * FROM position_snapshots
       WHERE agent_mint = $1 AND competition_id = $2
         AND snapshot_at = (
           SELECT MAX(snapshot_at) FROM position_snapshots
           WHERE agent_mint = $1 AND competition_id = $2
         )
       ORDER BY custody",
      &[&agent_mint, competition_id],
    )
    .await?;

  Ok(rows.iter().map(PositionSnapshotRow::from_row).collect())
}
