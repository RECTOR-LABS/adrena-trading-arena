import { ArenaStrategy, Signal, RiskParams, MarketState } from '../types';
import { rsi } from '../indicators';

export interface ScalperConfig {
  rsiPeriod: number;
  overbought: number;
  oversold: number;
  riskParams: RiskParams;
}

const DEFAULT_CONFIG: ScalperConfig = {
  rsiPeriod: 14,
  overbought: 70,
  oversold: 30,
  riskParams: {
    maxLeverage: 3,
    maxPositionPct: 10,
    stopLossPct: 2,
    takeProfitPct: 3,
  },
};

export function createScalperStrategy(config: Partial<ScalperConfig> = {}): ArenaStrategy {
  const cfg = { ...DEFAULT_CONFIG, ...config, riskParams: { ...DEFAULT_CONFIG.riskParams, ...config.riskParams } };

  return {
    name: 'Scalper',
    riskParams: cfg.riskParams,
    evaluate(market: MarketState): Signal {
      const rsiVal = rsi(market.prices, cfg.rsiPeriod);
      if (rsiVal === null) return 'HOLD';

      if (rsiVal <= cfg.oversold) return 'LONG';
      if (rsiVal >= cfg.overbought) return 'SHORT';

      // Close when RSI returns to neutral zone (45-55)
      if (rsiVal >= 45 && rsiVal <= 55) return 'CLOSE';

      return 'HOLD';
    },
  };
}
