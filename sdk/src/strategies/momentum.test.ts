import { describe, it, expect } from 'vitest';
import { createMomentumStrategy } from './momentum';
import { MarketState } from '../types';

function makeMarket(prices: number[]): MarketState {
  return {
    symbol: 'SOL/USD',
    price: prices[prices.length - 1],
    prices,
    volumes: prices.map(() => 1000),
    highRecent: Math.max(...prices),
    lowRecent: Math.min(...prices),
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
    // Declining series so fast EMA < slow EMA, then a sharp uptick on the last bar
    // causes fast EMA to cross above slow EMA
    const prices = [
      100, 100, 100, 100, 100,
      98, 96, 94, 92, 90,
      88, 86, 84, 82, 80,
      78, 76, 120,
    ];
    const signal = strategy.evaluate(makeMarket(prices));
    expect(signal).toBe('LONG');
  });

  it('returns SHORT on bearish crossover', () => {
    // Rising series so fast EMA > slow EMA, then a sharp drop on the last bar
    // causes fast EMA to cross below slow EMA
    const prices = [
      100, 100, 100, 100, 100,
      102, 104, 106, 108, 110,
      112, 114, 116, 118, 120,
      122, 124, 40,
    ];
    const signal = strategy.evaluate(makeMarket(prices));
    expect(signal).toBe('SHORT');
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
