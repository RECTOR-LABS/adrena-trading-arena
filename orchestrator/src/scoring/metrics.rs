use serde::{Deserialize, Serialize};

// ── Scoring constants ─────────────────────────────────────────────────────────

/// Denominator for activity multiplier: trades / scale.
const ACTIVITY_TRADE_SCALE: f64 = 10.0;
/// Maximum activity multiplier (caps spam incentive).
const ACTIVITY_MULTIPLIER_CAP: f64 = 2.0;
/// Duration window in hours for full duration bonus (1 week).
const DURATION_WINDOW_HOURS: f64 = 168.0;
/// Maximum additional duration bonus on top of 1.0 base.
const DURATION_BONUS_CAP: f64 = 0.5;
/// Minimum drawdown floor to prevent division discontinuity.
const MIN_DRAWDOWN_FLOOR: f64 = 0.01;

/// Minimal trade data needed for scoring calculations.
/// Decoupled from DB row to keep scoring functions pure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeData {
  pub realized_pnl: i64,
  pub size_usd: i64,
}

/// Sum of realized P&L across all trades (in USD micro-units).
pub fn calc_net_pnl(trades: &[TradeData]) -> i64 {
  trades.iter().map(|t| t.realized_pnl).sum()
}

/// Maximum drawdown as a fraction (0.0 to 1.0) from peak equity.
///
/// The equity curve represents sequential equity snapshots in USD micro-units.
/// Returns 0.0 if the curve is empty or never draws down.
pub fn calc_max_drawdown(equity_curve: &[i64]) -> f64 {
  if equity_curve.is_empty() {
    return 0.0;
  }

  let mut peak = equity_curve[0];
  let mut max_dd = 0.0_f64;

  for &equity in equity_curve {
    if equity > peak {
      peak = equity;
    }
    if peak > 0 {
      let dd = (peak - equity) as f64 / peak as f64;
      if dd > max_dd {
        max_dd = dd;
      }
    }
  }

  max_dd
}

/// Sharpe-like ratio (not annualized) given a series of periodic returns.
///
/// `returns` — fractional returns per period (e.g., daily returns as decimals).
/// `risk_free_rate` — risk-free rate per period (same frequency as returns).
///
/// Returns 0.0 if there are fewer than 2 data points or zero standard deviation.
pub fn calc_sharpe_ratio(returns: &[f64], risk_free_rate: f64) -> f64 {
  if returns.len() < 2 {
    return 0.0;
  }

  let n = returns.len() as f64;
  let excess: Vec<f64> = returns.iter().map(|r| r - risk_free_rate).collect();
  let mean = excess.iter().sum::<f64>() / n;
  let variance = excess.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / (n - 1.0);
  let std_dev = variance.sqrt();

  if std_dev < f64::EPSILON {
    return 0.0;
  }

  mean / std_dev
}

/// Win rate as a fraction (0.0 to 1.0).
/// A "win" is any trade with realized_pnl > 0.
/// Returns 0.0 if there are no trades.
pub fn calc_win_rate(trades: &[TradeData]) -> f64 {
  if trades.is_empty() {
    return 0.0;
  }

  let wins = trades.iter().filter(|t| t.realized_pnl > 0).count();
  wins as f64 / trades.len() as f64
}

/// Composite Arena Score that balances profitability, risk management, and engagement.
///
/// Formula: `(net_pnl / dd_floor) * activity_multiplier * duration_bonus`
///
/// - **Risk-adjusted return**: `net_pnl / max(max_drawdown, 0.01)` rewards agents that profit
///   without excessive drawdowns. A minimum 1% drawdown floor prevents discontinuity
///   when drawdown is zero.
/// - **Activity multiplier**: `min(trade_count / 10, 2.0)` — rewards active traders,
///   caps at 2x to prevent spam.
/// - **Duration bonus**: `1.0 + min(duration_hours / 168.0, 0.5)` — rewards longer
///   participation up to 1.5x (one full week).
///
/// Returns the score as an f64. Can be negative for losing agents.
pub fn calc_arena_score(
  net_pnl: i64,
  max_drawdown: f64,
  trade_count: u32,
  duration_hours: f64,
) -> f64 {
  // Risk-adjusted return with drawdown floor to prevent discontinuity
  let dd_floor = max_drawdown.max(MIN_DRAWDOWN_FLOOR);
  let risk_adjusted = net_pnl as f64 / dd_floor;

  // Activity multiplier: min(trades / scale, cap)
  let activity_multiplier = (trade_count as f64 / ACTIVITY_TRADE_SCALE).min(ACTIVITY_MULTIPLIER_CAP);

  // Duration bonus: 1.0 + min(hours / window, cap)
  let duration_bonus = 1.0 + (duration_hours / DURATION_WINDOW_HOURS).min(DURATION_BONUS_CAP);

  risk_adjusted * activity_multiplier * duration_bonus
}

#[cfg(test)]
mod tests {
  use super::*;

  // ── calc_net_pnl ──────────────────────────────────────────────────────

  #[test]
  fn net_pnl_empty_trades() {
    assert_eq!(calc_net_pnl(&[]), 0);
  }

  #[test]
  fn net_pnl_single_winning_trade() {
    let trades = vec![TradeData { realized_pnl: 1000, size_usd: 5000 }];
    assert_eq!(calc_net_pnl(&trades), 1000);
  }

  #[test]
  fn net_pnl_mixed_trades() {
    let trades = vec![
      TradeData { realized_pnl: 500, size_usd: 2000 },
      TradeData { realized_pnl: -200, size_usd: 1500 },
      TradeData { realized_pnl: 300, size_usd: 3000 },
    ];
    assert_eq!(calc_net_pnl(&trades), 600);
  }

  #[test]
  fn net_pnl_all_losses() {
    let trades = vec![
      TradeData { realized_pnl: -100, size_usd: 1000 },
      TradeData { realized_pnl: -250, size_usd: 2000 },
    ];
    assert_eq!(calc_net_pnl(&trades), -350);
  }

  // ── calc_max_drawdown ─────────────────────────────────────────────────

  #[test]
  fn max_drawdown_empty_curve() {
    assert_eq!(calc_max_drawdown(&[]), 0.0);
  }

  #[test]
  fn max_drawdown_monotonically_increasing() {
    let curve = vec![100, 200, 300, 400, 500];
    assert_eq!(calc_max_drawdown(&curve), 0.0);
  }

  #[test]
  fn max_drawdown_single_dip() {
    // Peak at 1000, dips to 800 -> 20% drawdown
    let curve = vec![1000, 900, 800, 950, 1100];
    let dd = calc_max_drawdown(&curve);
    assert!((dd - 0.2).abs() < 1e-10, "expected 0.2, got {dd}");
  }

  #[test]
  fn max_drawdown_multiple_dips() {
    // Peak 1000 -> 700 (30%), recovers to 1200 -> 900 (25%)
    let curve = vec![1000, 700, 900, 1200, 900];
    let dd = calc_max_drawdown(&curve);
    assert!((dd - 0.3).abs() < 1e-10, "expected 0.3, got {dd}");
  }

  #[test]
  fn max_drawdown_total_wipeout() {
    let curve = vec![1000, 500, 0];
    let dd = calc_max_drawdown(&curve);
    assert!((dd - 1.0).abs() < 1e-10, "expected 1.0, got {dd}");
  }

  // ── calc_sharpe_ratio ─────────────────────────────────────────────────

  #[test]
  fn sharpe_ratio_insufficient_data() {
    assert_eq!(calc_sharpe_ratio(&[], 0.0), 0.0);
    assert_eq!(calc_sharpe_ratio(&[0.01], 0.0), 0.0);
  }

  #[test]
  fn sharpe_ratio_constant_returns() {
    // Zero variance -> Sharpe is 0 (undefined, we return 0)
    let returns = vec![0.01, 0.01, 0.01, 0.01];
    assert_eq!(calc_sharpe_ratio(&returns, 0.0), 0.0);
  }

  #[test]
  fn sharpe_ratio_positive_returns() {
    let returns = vec![0.02, 0.03, 0.01, 0.04, 0.02];
    let sharpe = calc_sharpe_ratio(&returns, 0.0);
    assert!(sharpe > 0.0, "expected positive Sharpe, got {sharpe}");
  }

  #[test]
  fn sharpe_ratio_negative_returns() {
    let returns = vec![-0.02, -0.03, -0.01, -0.04, -0.02];
    let sharpe = calc_sharpe_ratio(&returns, 0.0);
    assert!(sharpe < 0.0, "expected negative Sharpe, got {sharpe}");
  }

  #[test]
  fn sharpe_ratio_with_risk_free() {
    let returns = vec![0.02, 0.03, 0.01, 0.04, 0.02];
    let sharpe_no_rf = calc_sharpe_ratio(&returns, 0.0);
    let sharpe_with_rf = calc_sharpe_ratio(&returns, 0.01);
    // Higher risk-free rate reduces excess returns, lowering Sharpe
    assert!(
      sharpe_with_rf < sharpe_no_rf,
      "Sharpe with risk-free ({sharpe_with_rf}) should be less than without ({sharpe_no_rf})"
    );
  }

  // ── calc_win_rate ─────────────────────────────────────────────────────

  #[test]
  fn win_rate_empty() {
    assert_eq!(calc_win_rate(&[]), 0.0);
  }

  #[test]
  fn win_rate_all_winners() {
    let trades = vec![
      TradeData { realized_pnl: 100, size_usd: 1000 },
      TradeData { realized_pnl: 200, size_usd: 2000 },
    ];
    assert!((calc_win_rate(&trades) - 1.0).abs() < f64::EPSILON);
  }

  #[test]
  fn win_rate_all_losers() {
    let trades = vec![
      TradeData { realized_pnl: -100, size_usd: 1000 },
      TradeData { realized_pnl: -200, size_usd: 2000 },
    ];
    assert!((calc_win_rate(&trades) - 0.0).abs() < f64::EPSILON);
  }

  #[test]
  fn win_rate_mixed() {
    let trades = vec![
      TradeData { realized_pnl: 100, size_usd: 1000 },
      TradeData { realized_pnl: -50, size_usd: 500 },
      TradeData { realized_pnl: 200, size_usd: 2000 },
      TradeData { realized_pnl: 0, size_usd: 1000 }, // breakeven is NOT a win
    ];
    let wr = calc_win_rate(&trades);
    assert!((wr - 0.5).abs() < f64::EPSILON, "expected 0.5, got {wr}");
  }

  // ── calc_arena_score ──────────────────────────────────────────────────

  #[test]
  fn arena_score_zero_everything() {
    let score = calc_arena_score(0, 0.0, 0, 0.0);
    assert_eq!(score, 0.0);
  }

  #[test]
  fn arena_score_profitable_no_drawdown() {
    // No drawdown -> dd_floor = 0.01, risk_adjusted = 1000 / 0.01 = 100_000
    // 20 trades -> activity = min(20/10, 2.0) = 2.0
    // 168 hours -> duration = 1.0 + min(168/168, 0.5) = 1.5
    // Score = 100_000 * 2.0 * 1.5 = 300_000
    let score = calc_arena_score(1000, 0.0, 20, 168.0);
    assert!((score - 300_000.0).abs() < 1e-10, "expected 300_000.0, got {score}");
  }

  #[test]
  fn arena_score_with_drawdown() {
    // net_pnl=1000, drawdown=0.2 -> risk_adjusted = 5000
    // 10 trades -> activity = min(10/10, 2.0) = 1.0
    // 84 hours -> duration = 1.0 + min(84/168, 0.5) = 1.0 + 0.5 = 1.5
    // Score = 5000 * 1.0 * 1.5 = 7500
    let score = calc_arena_score(1000, 0.2, 10, 84.0);
    assert!((score - 7500.0).abs() < 1e-10, "expected 7500.0, got {score}");
  }

  #[test]
  fn arena_score_activity_cap() {
    // 100 trades -> activity = min(100/10, 2.0) = 2.0 (capped)
    // dd_floor = max(0.0, 0.01) = 0.01, risk_adjusted = 100 / 0.01 = 10_000
    let score = calc_arena_score(100, 0.0, 100, 0.0);
    // risk_adjusted = 10_000, activity = 2.0, duration = 1.0
    assert!((score - 20_000.0).abs() < 1e-10, "expected 20_000.0, got {score}");
  }

  #[test]
  fn arena_score_duration_cap() {
    // 500 hours -> duration = 1.0 + min(500/168, 0.5) = 1.5 (capped)
    // dd_floor = 0.01, risk_adjusted = 100 / 0.01 = 10_000
    let score = calc_arena_score(100, 0.0, 10, 500.0);
    // risk_adjusted = 10_000, activity = 1.0, duration = 1.5
    assert!((score - 15_000.0).abs() < 1e-10, "expected 15_000.0, got {score}");
  }

  #[test]
  fn arena_score_negative_pnl() {
    // Losing agent should get negative score
    let score = calc_arena_score(-500, 0.3, 15, 100.0);
    assert!(score < 0.0, "expected negative score, got {score}");
  }

  #[test]
  fn arena_score_few_trades_penalty() {
    // Only 3 trades -> activity = 0.3, effectively a penalty
    let score_few = calc_arena_score(1000, 0.1, 3, 100.0);
    let score_many = calc_arena_score(1000, 0.1, 20, 100.0);
    assert!(
      score_few < score_many,
      "fewer trades ({score_few}) should score lower than more trades ({score_many})"
    );
  }

  #[test]
  fn arena_score_drawdown_floor_prevents_discontinuity() {
    // With drawdown = 0.0 and drawdown = 0.005 (below floor), scores should be identical
    let score_zero_dd = calc_arena_score(1000, 0.0, 10, 100.0);
    let score_tiny_dd = calc_arena_score(1000, 0.005, 10, 100.0);
    assert!(
      (score_zero_dd - score_tiny_dd).abs() < f64::EPSILON,
      "zero dd ({score_zero_dd}) and tiny dd ({score_tiny_dd}) should produce same score due to floor"
    );
  }
}
