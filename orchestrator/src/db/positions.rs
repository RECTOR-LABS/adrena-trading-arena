use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

const POSITION_COLUMNS: &str = "id, agent_mint, competition_id, custody, side, size_usd, collateral_usd, entry_price, mark_price, unrealized_pnl, leverage, snapshot_at";

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
  fn from_row(row: &tokio_postgres::Row) -> Result<Self, AppError> {
    Ok(Self {
      id: row.try_get("id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      agent_mint: row.try_get("agent_mint").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      competition_id: row.try_get("competition_id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      custody: row.try_get("custody").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      side: row.try_get("side").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      size_usd: row.try_get("size_usd").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      collateral_usd: row.try_get("collateral_usd").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      entry_price: row.try_get("entry_price").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      mark_price: row.try_get("mark_price").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      unrealized_pnl: row.try_get("unrealized_pnl").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      leverage: row.try_get("leverage").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      snapshot_at: row.try_get("snapshot_at").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
    })
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
      &format!(
        "SELECT {POSITION_COLUMNS} FROM position_snapshots
         WHERE agent_mint = $1 AND competition_id = $2
           AND snapshot_at = (
             SELECT MAX(snapshot_at) FROM position_snapshots
             WHERE agent_mint = $1 AND competition_id = $2
           )
         ORDER BY custody"
      ),
      &[&agent_mint, competition_id],
    )
    .await?;

  rows.iter().map(PositionSnapshotRow::from_row).collect()
}
