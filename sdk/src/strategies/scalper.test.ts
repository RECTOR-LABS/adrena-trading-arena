import { describe, it, expect } from 'vitest';
import { createScalperStrategy } from './scalper';
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

describe('ScalperStrategy', () => {
  const strategy = createScalperStrategy({ rsiPeriod: 5 });

  it('returns HOLD with insufficient data', () => {
    expect(strategy.evaluate(makeMarket([100, 101]))).toBe('HOLD');
  });

  it('returns LONG when RSI is oversold', () => {
    // Continuously falling prices -> RSI near 0
    const prices = Array.from({ length: 10 }, (_, i) => 100 - i * 2);
    const signal = strategy.evaluate(makeMarket(prices));
    expect(signal).toBe('LONG');
  });

  it('returns SHORT when RSI is overbought', () => {
    // Continuously rising prices -> RSI near 100
    const prices = Array.from({ length: 10 }, (_, i) => 100 + i * 2);
    const signal = strategy.evaluate(makeMarket(prices));
    expect(signal).toBe('SHORT');
  });
});
