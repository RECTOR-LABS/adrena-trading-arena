import { ArenaStrategy, Signal, RiskParams, MarketState } from '../types';
import { bollinger } from '../indicators';

export interface MeanReversionConfig {
  period: number;
  multiplier: number;
  riskParams: RiskParams;
}

const DEFAULT_CONFIG: MeanReversionConfig = {
  period: 20,
  multiplier: 2,
  riskParams: {
    maxLeverage: 3,
    maxPositionPct: 15,
    stopLossPct: 3,
    takeProfitPct: 5,
  },
};

export function createMeanReversionStrategy(config: Partial<MeanReversionConfig> = {}): ArenaStrategy {
  const cfg = { ...DEFAULT_CONFIG, ...config, riskParams: { ...DEFAULT_CONFIG.riskParams, ...config.riskParams } };

  return {
    name: 'MeanReversion',
    riskParams: cfg.riskParams,
    evaluate(market: MarketState): Signal {
      const bands = bollinger(market.prices, cfg.period, cfg.multiplier);
      if (!bands) return 'HOLD';

      const price = market.price;

      // Price below lower band -> oversold -> buy
      if (price <= bands.lower) return 'LONG';
      // Price above upper band -> overbought -> sell
      if (price >= bands.upper) return 'SHORT';
      // Price near middle -> close position (mean reverted)
      const distFromMiddle = Math.abs(price - bands.middle) / bands.middle;
      if (distFromMiddle < 0.005) return 'CLOSE';

      return 'HOLD';
    },
  };
}
