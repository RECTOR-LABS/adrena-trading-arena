use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

const TRADE_COLUMNS: &str = "id, agent_mint, competition_id, side, action, size_usd, price, realized_pnl, tx_signature, traded_at";

const MAX_LIMIT: i64 = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeRow {
  pub id: Uuid,
  pub agent_mint: String,
  pub competition_id: Uuid,
  pub side: String,
  pub action: String,
  pub size_usd: i64,
  pub price: i64,
  pub realized_pnl: i64,
  pub tx_signature: Option<String>,
  pub traded_at: DateTime<Utc>,
}

impl TradeRow {
  fn from_row(row: &tokio_postgres::Row) -> Result<Self, AppError> {
    Ok(Self {
      id: row.try_get("id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      agent_mint: row.try_get("agent_mint").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      competition_id: row.try_get("competition_id").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      side: row.try_get("side").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      action: row.try_get("action").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      size_usd: row.try_get("size_usd").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      price: row.try_get("price").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      realized_pnl: row.try_get("realized_pnl").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      tx_signature: row.try_get("tx_signature").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
      traded_at: row.try_get("traded_at").map_err(|e| AppError::Internal(format!("DB field error: {e}")))?,
    })
  }
}

/// Insert a new trade record.
pub async fn insert_trade(pool: &Pool, trade: &TradeRow) -> Result<(), AppError> {
  let client = pool.get().await?;
  client
    .execute(
      "INSERT INTO trades
       (agent_mint, competition_id, side, action, size_usd, price,
        realized_pnl, tx_signature, traded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      &[
        &trade.agent_mint,
        &trade.competition_id,
        &trade.side,
        &trade.action,
        &trade.size_usd,
        &trade.price,
        &trade.realized_pnl,
        &trade.tx_signature,
        &trade.traded_at,
      ],
    )
    .await?;

  Ok(())
}

/// Get trades for an agent in a specific competition with pagination.
pub async fn get_trades(
  pool: &Pool,
  agent_mint: &str,
  competition_id: &Uuid,
  limit: i64,
  offset: i64,
) -> Result<Vec<TradeRow>, AppError> {
  let limit = limit.min(MAX_LIMIT);
  let client = pool.get().await?;
  let rows = client
    .query(
      &format!(
        "SELECT {TRADE_COLUMNS} FROM trades
         WHERE agent_mint = $1 AND competition_id = $2
         ORDER BY traded_at ASC
         LIMIT $3 OFFSET $4"
      ),
      &[&agent_mint, competition_id, &limit, &offset],
    )
    .await?;

  rows.iter().map(TradeRow::from_row).collect()
}

/// Count total trades for an agent in a specific competition.
pub async fn count_trades(
  pool: &Pool,
  agent_mint: &str,
  competition_id: &Uuid,
) -> Result<i64, AppError> {
  let client = pool.get().await?;
  let row = client
    .query_one(
      "SELECT COUNT(*) AS cnt FROM trades
       WHERE agent_mint = $1 AND competition_id = $2",
      &[&agent_mint, competition_id],
    )
    .await?;

  row.try_get::<_, i64>("cnt")
    .map_err(|e| AppError::Internal(format!("DB field error: {e}")))
}
