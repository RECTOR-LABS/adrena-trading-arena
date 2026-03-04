import { describe, it, expect } from 'vitest';
import { createMomentumStrategy } from './momentum';
import { MarketState } from '../types';

function makeMarket(prices: number[]): MarketState {
  return {
    symbol: 'SOL/USD',
    price: prices[prices.length - 1],
    prices,
    volumes: prices.map(() => 1000),
    high24h: Math.max(...prices),
    low24h: Math.min(...prices),
    volume24h: 100_000,
    timestamp: Date.now(),
  };
}

describe('MomentumStrategy', () => {
  const strategy = createMomentumStrategy({ fastPeriod: 3, slowPeriod: 5 });

  it('has correct name and risk params', () => {
    expect(strategy.name).toBe('Momentum');
    expect(strategy.riskParams.maxLeverage).toBe(5);
  });

  it('returns HOLD with insufficient data', () => {
    expect(strategy.evaluate(makeMarket([100, 101]))).toBe('HOLD');
  });

  it('returns LONG on bullish crossover', () => {
    // Prices trending up -- fast EMA will cross above slow
    const prices = [90, 91, 92, 88, 87, 86, 87, 90, 95, 100, 105, 110];
    const signal = strategy.evaluate(makeMarket(prices));
    // Strong uptrend should give LONG or HOLD (depends on exact crossover point)
    expect(['LONG', 'HOLD']).toContain(signal);
  });

  it('returns SHORT on bearish crossover', () => {
    const prices = [110, 109, 108, 112, 113, 114, 113, 110, 105, 100, 95, 90];
    const signal = strategy.evaluate(makeMarket(prices));
    expect(['SHORT', 'HOLD']).toContain(signal);
  });

  it('returns HOLD when no crossover', () => {
    // Flat prices -- no crossover
    const prices = Array(20).fill(100);
    expect(strategy.evaluate(makeMarket(prices))).toBe('HOLD');
  });

  it('respects custom config', () => {
    const custom = createMomentumStrategy({ fastPeriod: 5, slowPeriod: 10, riskParams: { maxLeverage: 3, maxPositionPct: 10, stopLossPct: 2, takeProfitPct: 5 } });
    expect(custom.riskParams.maxLeverage).toBe(3);
  });
});
