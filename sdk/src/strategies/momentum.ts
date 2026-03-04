import { ArenaStrategy, Signal, RiskParams, MarketState } from '../types';
import { ema } from '../indicators';

export interface MomentumConfig {
  fastPeriod: number;
  slowPeriod: number;
  riskParams: RiskParams;
}

const DEFAULT_CONFIG: MomentumConfig = {
  fastPeriod: 9,
  slowPeriod: 21,
  riskParams: {
    maxLeverage: 5,
    maxPositionPct: 20,
    stopLossPct: 5,
    takeProfitPct: 10,
  },
};

export function createMomentumStrategy(config: Partial<MomentumConfig> = {}): ArenaStrategy {
  const cfg = { ...DEFAULT_CONFIG, ...config, riskParams: { ...DEFAULT_CONFIG.riskParams, ...config.riskParams } };

  return {
    name: 'Momentum',
    riskParams: cfg.riskParams,
    evaluate(market: MarketState): Signal {
      const { prices } = market;
      const fastEma = ema(prices, cfg.fastPeriod);
      const slowEma = ema(prices, cfg.slowPeriod);

      if (fastEma === null || slowEma === null) return 'HOLD';

      // Get previous EMAs for crossover detection
      const prevPrices = prices.slice(0, -1);
      const prevFast = ema(prevPrices, cfg.fastPeriod);
      const prevSlow = ema(prevPrices, cfg.slowPeriod);

      if (prevFast === null || prevSlow === null) return 'HOLD';

      // Bullish crossover: fast crosses above slow
      if (prevFast <= prevSlow && fastEma > slowEma) return 'LONG';
      // Bearish crossover: fast crosses below slow
      if (prevFast >= prevSlow && fastEma < slowEma) return 'SHORT';

      return 'HOLD';
    },
  };
}
