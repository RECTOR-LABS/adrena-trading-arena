use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct HealthResponse {
  pub status: String,
  pub version: String,
}

#[derive(Serialize)]
pub struct CompetitionResponse {
  pub id: Uuid,
  pub on_chain_id: i64,
  pub name: String,
  pub format: String,
  pub status: String,
  pub entry_fee: i64,
  pub prize_pool: i64,
  pub max_agents: i32,
  pub registered_count: i32,
  pub start_time: DateTime<Utc>,
  pub end_time: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct AgentResponse {
  pub mint: String,
  pub owner: String,
  pub name: String,
  pub elo_rating: i32,
  pub wins: i32,
  pub losses: i32,
  pub total_pnl: i64,
  pub total_trades: i32,
  pub status: String,
}

#[derive(Serialize)]
pub struct LeaderboardEntry {
  pub rank: i32,
  pub agent_mint: String,
  pub agent_name: String,
  pub score: i64,
  pub pnl: i64,
  pub trades: i32,
  pub win_rate: f64,
  pub max_drawdown: f64,
}

#[allow(dead_code)]
#[derive(Serialize)]
pub struct LiveUpdate {
  pub agent_mint: String,
  pub event_type: String,
  pub data: serde_json::Value,
  pub timestamp: DateTime<Utc>,
}
