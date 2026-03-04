import { MarketState } from './market';

export type Signal = 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD';

export interface RiskParams {
  maxLeverage: number;      // e.g., 5 means 5x
  maxPositionPct: number;   // % of capital (0-100)
  stopLossPct: number;      // % from entry
  takeProfitPct: number;    // % from entry
}

export interface ArenaStrategy {
  readonly name: string;
  evaluate(market: MarketState): Signal;
  readonly riskParams: RiskParams;
}
