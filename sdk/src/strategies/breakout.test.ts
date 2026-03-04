import { describe, it, expect } from 'vitest';
import { createBreakoutStrategy } from './breakout';
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

describe('BreakoutStrategy', () => {
  const strategy = createBreakoutStrategy({ lookbackPeriod: 5 });

  it('returns HOLD with insufficient data', () => {
    expect(strategy.evaluate(makeMarket([100, 101, 102]))).toBe('HOLD');
  });

  it('returns LONG on upward breakout', () => {
    // 5-period range: 95-105, then breakout above
    const prices = [100, 95, 105, 98, 102, 110];
    expect(strategy.evaluate(makeMarket(prices))).toBe('LONG');
  });

  it('returns SHORT on downward breakout', () => {
    const prices = [100, 95, 105, 98, 102, 90];
    expect(strategy.evaluate(makeMarket(prices))).toBe('SHORT');
  });

  it('returns HOLD within range', () => {
    const prices = [100, 95, 105, 98, 102, 100];
    expect(strategy.evaluate(makeMarket(prices))).toBe('HOLD');
  });
});
