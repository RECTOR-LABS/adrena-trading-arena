import { describe, it, expect } from 'vitest';
import { createMeanReversionStrategy } from './mean-reversion';
import { MarketState } from '../types';

function makeMarket(prices: number[], currentPrice?: number): MarketState {
  const p = currentPrice ?? prices[prices.length - 1];
  return {
    symbol: 'SOL/USD',
    price: p,
    prices,
    volumes: prices.map(() => 1000),
    high24h: Math.max(...prices),
    low24h: Math.min(...prices),
    volume24h: 100_000,
    timestamp: Date.now(),
  };
}

describe('MeanReversionStrategy', () => {
  const strategy = createMeanReversionStrategy({ period: 10, multiplier: 2 });

  it('returns HOLD with insufficient data', () => {
    expect(strategy.evaluate(makeMarket([100, 101]))).toBe('HOLD');
  });

  it('returns LONG when price is below lower band', () => {
    // Stable prices then a big drop
    // Use slightly volatile data instead of constant (0 bandwidth)
    const volatilePrices = [98, 102, 99, 101, 100, 99, 101, 100, 98, 102];
    const signal = strategy.evaluate(makeMarket(volatilePrices, 90));
    expect(signal).toBe('LONG');
  });

  it('returns SHORT when price is above upper band', () => {
    const volatilePrices = [98, 102, 99, 101, 100, 99, 101, 100, 98, 102];
    const signal = strategy.evaluate(makeMarket(volatilePrices, 110));
    expect(signal).toBe('SHORT');
  });
});
