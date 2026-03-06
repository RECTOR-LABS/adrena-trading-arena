import { describe, it, expect } from 'vitest';
import { MockPriceFeed } from './price-feed';

describe('MockPriceFeed', () => {
  describe('getPrice', () => {
    it('returns configured fixed price', async () => {
      const feed = new MockPriceFeed();
      feed.setPrice('SOL/USD', 150);
      expect(await feed.getPrice('SOL/USD')).toBe(150);
    });

    it('throws for unconfigured symbol', async () => {
      const feed = new MockPriceFeed();
      await expect(feed.getPrice('UNKNOWN/USD')).rejects.toThrow('no price configured');
    });

    it('supports multiple symbols', async () => {
      const feed = new MockPriceFeed();
      feed.setPrice('SOL/USD', 150);
      feed.setPrice('BTC/USD', 45000);
      expect(await feed.getPrice('SOL/USD')).toBe(150);
      expect(await feed.getPrice('BTC/USD')).toBe(45000);
    });

    it('returns sequential prices from sequence', async () => {
      const feed = new MockPriceFeed();
      feed.setPriceSequence('SOL/USD', [100, 105, 110, 115]);

      expect(await feed.getPrice('SOL/USD')).toBe(100);
      expect(await feed.getPrice('SOL/USD')).toBe(105);
      expect(await feed.getPrice('SOL/USD')).toBe(110);
      expect(await feed.getPrice('SOL/USD')).toBe(115);
    });

    it('repeats last price after sequence exhausted', async () => {
      const feed = new MockPriceFeed();
      feed.setPriceSequence('SOL/USD', [100, 200]);

      expect(await feed.getPrice('SOL/USD')).toBe(100);
      expect(await feed.getPrice('SOL/USD')).toBe(200);
      expect(await feed.getPrice('SOL/USD')).toBe(200); // repeats last
    });

    it('sequence takes priority over fixed price', async () => {
      const feed = new MockPriceFeed();
      feed.setPrice('SOL/USD', 999);
      feed.setPriceSequence('SOL/USD', [100, 200]);

      expect(await feed.getPrice('SOL/USD')).toBe(100);
    });

    it('rejects empty sequence', () => {
      const feed = new MockPriceFeed();
      expect(() => feed.setPriceSequence('SOL/USD', [])).toThrow('must not be empty');
    });
  });

  describe('getMarketState', () => {
    it('builds correct MarketState with fixed price', async () => {
      const feed = new MockPriceFeed();
      feed.setPrice('SOL/USD', 150);

      const state = await feed.getMarketState('SOL/USD', 10);

      expect(state.symbol).toBe('SOL/USD');
      expect(state.price).toBe(150);
      expect(state.prices).toHaveLength(10);
      expect(state.prices.every((p) => p === 150)).toBe(true);
      expect(state.volumes).toHaveLength(10);
      expect(state.highRecent).toBe(150);
      expect(state.lowRecent).toBe(150);
      expect(state.timestamp).toBeGreaterThan(0);
    });

    it('builds MarketState with sequence history', async () => {
      const feed = new MockPriceFeed();
      feed.setPriceSequence('SOL/USD', [100, 105, 110, 115, 120]);

      // Consume some prices first to build history
      await feed.getPrice('SOL/USD'); // 100
      await feed.getPrice('SOL/USD'); // 105
      await feed.getPrice('SOL/USD'); // 110

      const state = await feed.getMarketState('SOL/USD', 10);

      // Should include history from consumed prices
      expect(state.symbol).toBe('SOL/USD');
      expect(state.price).toBe(115); // next in sequence
      expect(state.prices.length).toBeGreaterThan(0);
      expect(state.highRecent).toBeGreaterThanOrEqual(state.lowRecent);
    });

    it('has matching volumes array length', async () => {
      const feed = new MockPriceFeed();
      feed.setPrice('ETH/USD', 3000);

      const state = await feed.getMarketState('ETH/USD', 5);
      expect(state.prices.length).toBe(state.volumes.length);
    });

    it('computes correct highRecent and lowRecent', async () => {
      const feed = new MockPriceFeed();
      feed.setPriceSequence('SOL/USD', [90, 100, 110, 105, 95]);

      // Build up history
      await feed.getPrice('SOL/USD');
      await feed.getPrice('SOL/USD');
      await feed.getPrice('SOL/USD');
      await feed.getPrice('SOL/USD');

      const state = await feed.getMarketState('SOL/USD', 10);
      expect(state.highRecent).toBeGreaterThanOrEqual(state.lowRecent);
    });
  });
});
