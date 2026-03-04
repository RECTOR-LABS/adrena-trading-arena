use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

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
  fn from_row(row: &tokio_postgres::Row) -> Self {
    Self {
      id: row.get("id"),
      agent_mint: row.get("agent_mint"),
      competition_id: row.get("competition_id"),
      side: row.get("side"),
      action: row.get("action"),
      size_usd: row.get("size_usd"),
      price: row.get("price"),
      realized_pnl: row.get("realized_pnl"),
      tx_signature: row.get("tx_signature"),
      traded_at: row.get("traded_at"),
    }
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

/// Get all trades for an agent in a specific competition.
pub async fn get_trades(
  pool: &Pool,
  agent_mint: &str,
  competition_id: &Uuid,
) -> Result<Vec<TradeRow>, AppError> {
  let client = pool.get().await?;
  let rows = client
    .query(
      "SELECT * FROM trades
       WHERE agent_mint = $1 AND competition_id = $2
       ORDER BY traded_at ASC",
      &[&agent_mint, competition_id],
    )
    .await?;

  Ok(rows.iter().map(TradeRow::from_row).collect())
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

  Ok(row.get::<_, i64>("cnt"))
}
