use crate::scoring::metrics::{
  calc_arena_score, calc_max_drawdown, calc_net_pnl, calc_sharpe_ratio, calc_win_rate, TradeData,
};

/// Aggregated scoring result for a single agent in a competition.
#[derive(Debug, Clone)]
pub struct ScoreResult {
  pub net_pnl: i64,
  pub max_drawdown: f64,
  pub sharpe_ratio: f64,
  pub win_rate: f64,
  pub arena_score: f64,
  pub trade_count: u32,
}

/// Compute a complete score for an agent given their trades and equity history.
///
/// - `trades` — all closed trades for the agent in this competition
/// - `equity_curve` — sequential equity snapshots in USD micro-units
/// - `returns` — periodic fractional returns (e.g., hourly or daily)
/// - `duration_hours` — how long the agent has been participating
pub fn compute_agent_score(
  trades: &[TradeData],
  equity_curve: &[i64],
  returns: &[f64],
  duration_hours: f64,
) -> ScoreResult {
  let net_pnl = calc_net_pnl(trades);
  let max_drawdown = calc_max_drawdown(equity_curve);
  let sharpe_ratio = calc_sharpe_ratio(returns, 0.0);
  let win_rate = calc_win_rate(trades);
  let trade_count = trades.len() as u32;
  let arena_score = calc_arena_score(net_pnl, max_drawdown, trade_count, duration_hours);

  ScoreResult {
    net_pnl,
    max_drawdown,
    sharpe_ratio,
    win_rate,
    arena_score,
    trade_count,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn make_trade(pnl: i64, size: i64) -> TradeData {
    TradeData {
      realized_pnl: pnl,
      size_usd: size,
    }
  }

  #[test]
  fn score_empty_data() {
    let result = compute_agent_score(&[], &[], &[], 0.0);
    assert_eq!(result.net_pnl, 0);
    assert_eq!(result.max_drawdown, 0.0);
    assert_eq!(result.sharpe_ratio, 0.0);
    assert_eq!(result.win_rate, 0.0);
    assert_eq!(result.arena_score, 0.0);
    assert_eq!(result.trade_count, 0);
  }

  #[test]
  fn score_profitable_agent() {
    let trades = vec![
      make_trade(500, 2000),
      make_trade(300, 1500),
      make_trade(-100, 1000),
      make_trade(200, 2500),
    ];
    let equity = vec![10000, 10500, 10800, 10700, 10900];
    let returns = vec![0.05, 0.028, -0.009, 0.018];
    let duration = 48.0;

    let result = compute_agent_score(&trades, &equity, &returns, duration);

    assert_eq!(result.net_pnl, 900);
    assert_eq!(result.trade_count, 4);
    assert!(result.win_rate > 0.7, "expected >70% win rate, got {}", result.win_rate);
    assert!(result.sharpe_ratio > 0.0, "expected positive sharpe");
    assert!(result.max_drawdown > 0.0, "expected some drawdown");
    assert!(result.arena_score > 0.0, "expected positive arena score");
  }

  #[test]
  fn score_losing_agent() {
    let trades = vec![
      make_trade(-200, 1000),
      make_trade(-300, 2000),
      make_trade(50, 500),
    ];
    let equity = vec![10000, 9800, 9500, 9550];
    let returns = vec![-0.02, -0.03, 0.005];
    let duration = 24.0;

    let result = compute_agent_score(&trades, &equity, &returns, duration);

    assert_eq!(result.net_pnl, -450);
    assert_eq!(result.trade_count, 3);
    assert!(result.win_rate < 0.5, "expected <50% win rate");
    assert!(result.sharpe_ratio < 0.0, "expected negative sharpe");
    assert!(result.max_drawdown > 0.0, "expected drawdown");
    assert!(result.arena_score < 0.0, "expected negative arena score");
  }

  #[test]
  fn score_single_trade() {
    let trades = vec![make_trade(1000, 5000)];
    let equity = vec![10000, 11000];
    let returns = vec![0.1];
    let duration = 12.0;

    let result = compute_agent_score(&trades, &equity, &returns, duration);

    assert_eq!(result.net_pnl, 1000);
    assert_eq!(result.trade_count, 1);
    assert!((result.win_rate - 1.0).abs() < f64::EPSILON);
    // Single return => sharpe is 0 (insufficient data)
    assert_eq!(result.sharpe_ratio, 0.0);
    assert_eq!(result.max_drawdown, 0.0);
  }

  #[test]
  fn score_high_activity_agent() {
    // 25 trades, all winners — activity multiplier should cap at 2.0
    let trades: Vec<TradeData> = (0..25).map(|i| make_trade(100 + i * 10, 1000)).collect();
    let equity: Vec<i64> = (0..26).map(|i| 10000 + i * 100).collect();
    let returns: Vec<f64> = (0..25).map(|_| 0.01).collect();
    let duration = 168.0;

    let result = compute_agent_score(&trades, &equity, &returns, duration);

    assert_eq!(result.trade_count, 25);
    assert!((result.win_rate - 1.0).abs() < f64::EPSILON);
    assert!(result.arena_score > 0.0);
  }

  #[test]
  fn score_breakeven_agent() {
    let trades = vec![
      make_trade(500, 2000),
      make_trade(-500, 2000),
    ];
    let equity = vec![10000, 10500, 10000];
    let returns = vec![0.05, -0.047];
    let duration = 36.0;

    let result = compute_agent_score(&trades, &equity, &returns, duration);

    assert_eq!(result.net_pnl, 0);
    assert_eq!(result.trade_count, 2);
    assert!((result.win_rate - 0.5).abs() < f64::EPSILON);
    // Arena score should be 0 since net PNL is 0
    assert_eq!(result.arena_score, 0.0);
  }

  #[test]
  fn score_consistency_with_metrics() {
    // Verify engine produces the same values as calling metrics directly
    let trades = vec![
      make_trade(300, 1500),
      make_trade(-100, 1000),
      make_trade(400, 2000),
    ];
    let equity = vec![10000, 10300, 10200, 10600];
    let returns = vec![0.03, -0.0097, 0.039];
    let duration = 72.0;

    let result = compute_agent_score(&trades, &equity, &returns, duration);

    assert_eq!(result.net_pnl, calc_net_pnl(&trades));
    assert_eq!(result.max_drawdown, calc_max_drawdown(&equity));
    assert_eq!(result.sharpe_ratio, calc_sharpe_ratio(&returns, 0.0));
    assert_eq!(result.win_rate, calc_win_rate(&trades));
    assert_eq!(
      result.arena_score,
      calc_arena_score(result.net_pnl, result.max_drawdown, result.trade_count, duration)
    );
  }
}
