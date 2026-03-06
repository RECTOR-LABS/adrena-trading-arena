import { ArenaStrategy, Signal, RiskParams, MarketState } from '../types';

export interface BreakoutConfig {
  lookbackPeriod: number;
  riskParams: RiskParams;
}

const DEFAULT_CONFIG: BreakoutConfig = {
  lookbackPeriod: 20,
  riskParams: {
    maxLeverage: 4,
    maxPositionPct: 20,
    stopLossPct: 4,
    takeProfitPct: 8,
  },
};

export function createBreakoutStrategy(config: Partial<BreakoutConfig> = {}): ArenaStrategy {
  const cfg = { ...DEFAULT_CONFIG, ...config, riskParams: { ...DEFAULT_CONFIG.riskParams, ...config.riskParams } };

  return {
    name: 'Breakout',
    riskParams: cfg.riskParams,
    evaluate(market: MarketState): Signal {
      const { prices } = market;
      if (prices.length < cfg.lookbackPeriod + 1) return 'HOLD';

      const lookback = prices.slice(-cfg.lookbackPeriod - 1, -1); // exclude current
      const high = Math.max(...lookback);
      const low = Math.min(...lookback);
      const current = prices[prices.length - 1];

      if (current > high) return 'LONG';
      if (current < low) return 'SHORT';
      return 'HOLD';
    },
  };
}
