import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { AgentExecutor } from './agent-executor';
import { MockAdrenaTrader } from '../client/adrena-wrapper';
import { MockPriceFeed } from '../market/price-feed';
import type { ArenaStrategy, MarketState, Signal } from '../types';

const OWNER = PublicKey.unique();
const MINT = PublicKey.unique();
const CUSTODY = PublicKey.unique();

function makeStrategy(signalOverride?: Signal): ArenaStrategy {
  return {
    name: 'TestStrategy',
    riskParams: {
      maxLeverage: 5,
      maxPositionPct: 20,
      stopLossPct: 5,
      takeProfitPct: 10,
      defaultSlippageBps: 50,
    },
    evaluate(_market: MarketState): Signal {
      return signalOverride ?? 'HOLD';
    },
  };
}

describe('AgentExecutor', () => {
  let trader: MockAdrenaTrader;
  let priceFeed: MockPriceFeed;

  beforeEach(() => {
    trader = new MockAdrenaTrader();
    priceFeed = new MockPriceFeed();
    priceFeed.setPrice('SOL/USD', 100);
  });

  function createExecutor(strategy: ArenaStrategy): AgentExecutor {
    return new AgentExecutor({
      strategy,
      trader,
      priceFeed,
      capital: 10_000,
      tickIntervalMs: 1000,
      owner: OWNER,
      mint: MINT,
      custody: CUSTODY,
      symbol: 'SOL/USD',
      lookback: 20,
    });
  }

  describe('tick()', () => {
    it('executes single tick cycle with mock trader and price feed', async () => {
      const executor = createExecutor(makeStrategy('HOLD'));
      const result = await executor.tick();

      expect(result.signal).toBe('HOLD');
      expect(result.trade.action).toBe('hold');
      expect(result.price).toBe(100);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('does not trade on HOLD signal', async () => {
      const executor = createExecutor(makeStrategy('HOLD'));
      await executor.tick();

      expect(trader.executedTrades).toHaveLength(0);
      const stats = executor.getStats();
      expect(stats.totalTrades).toBe(0);
      expect(stats.holds).toBe(1);
    });

    it('opens long position on LONG signal', async () => {
      const executor = createExecutor(makeStrategy('LONG'));
      const result = await executor.tick();

      expect(result.signal).toBe('LONG');
      expect(result.trade.action).toBe('opened_long');
      expect(result.trade.txSig).toBeDefined();
      expect(trader.executedTrades).toHaveLength(1);
      expect(trader.executedTrades[0].method).toBe('openLong');
    });

    it('opens short position on SHORT signal', async () => {
      const executor = createExecutor(makeStrategy('SHORT'));
      const result = await executor.tick();

      expect(result.signal).toBe('SHORT');
      expect(result.trade.action).toBe('opened_short');
      expect(trader.executedTrades).toHaveLength(1);
      expect(trader.executedTrades[0].method).toBe('openShort');
    });

    it('passes correct price from price feed', async () => {
      priceFeed.setPrice('SOL/USD', 250);
      const executor = createExecutor(makeStrategy('HOLD'));
      const result = await executor.tick();

      expect(result.price).toBe(250);
    });
  });

  describe('stats tracking', () => {
    it('increments totalTicks on each tick', async () => {
      const executor = createExecutor(makeStrategy('HOLD'));
      await executor.tick();
      await executor.tick();
      await executor.tick();

      const stats = executor.getStats();
      expect(stats.totalTicks).toBe(3);
    });

    it('tracks trade counts correctly', async () => {
      // LONG then HOLD — 1 trade, 1 hold
      let signal: Signal = 'LONG';
      const strategy: ArenaStrategy = {
        name: 'Dynamic',
        riskParams: makeStrategy().riskParams,
        evaluate(): Signal { return signal; },
      };

      const executor = createExecutor(strategy);
      await executor.tick(); // LONG — opens position
      signal = 'HOLD';
      await executor.tick(); // HOLD — no action

      const stats = executor.getStats();
      expect(stats.totalTrades).toBe(1);
      expect(stats.longs).toBe(1);
      expect(stats.holds).toBe(1);
      expect(stats.totalTicks).toBe(2);
    });

    it('updates lastTickAt', async () => {
      const executor = createExecutor(makeStrategy('HOLD'));
      expect(executor.getStats().lastTickAt).toBeNull();

      await executor.tick();
      const stats = executor.getStats();
      expect(stats.lastTickAt).not.toBeNull();
      expect(stats.lastTickAt!).toBeGreaterThan(0);
    });

    it('returns a copy of stats (not a reference)', () => {
      const executor = createExecutor(makeStrategy('HOLD'));
      const stats1 = executor.getStats();
      const stats2 = executor.getStats();
      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('start/stop', () => {
    let executor: AgentExecutor;

    beforeEach(() => {
      executor = createExecutor(makeStrategy('HOLD'));
    });

    afterEach(async () => {
      await executor.stop();
    });

    it('starts and stops without error', async () => {
      expect(executor.isRunning()).toBe(false);
      executor.start();
      expect(executor.isRunning()).toBe(true);
      await executor.stop();
      expect(executor.isRunning()).toBe(false);
    });

    it('throws if started twice', () => {
      executor.start();
      expect(() => executor.start()).toThrow('already running');
    });

    it('stop is idempotent', async () => {
      await executor.stop(); // Not running — should not throw
      executor.start();
      await executor.stop();
      await executor.stop(); // Double stop — should not throw
    });

    it('sets startedAt timestamp', () => {
      expect(executor.getStats().startedAt).toBeNull();
      executor.start();
      expect(executor.getStats().startedAt).toBeGreaterThan(0);
    });
  });

  describe('config validation', () => {
    it('throws on non-positive tickIntervalMs', () => {
      expect(() => new AgentExecutor({
        strategy: makeStrategy(),
        trader,
        priceFeed,
        capital: 10_000,
        tickIntervalMs: 0,
        owner: OWNER,
        mint: MINT,
        custody: CUSTODY,
      })).toThrow('tickIntervalMs must be positive');
    });

    it('throws on negative capital', () => {
      expect(() => new AgentExecutor({
        strategy: makeStrategy(),
        trader,
        priceFeed,
        capital: -1,
        tickIntervalMs: 1000,
        owner: OWNER,
        mint: MINT,
        custody: CUSTODY,
      })).toThrow('capital must be non-negative');
    });

    it('throws on non-positive lookback', () => {
      expect(() => new AgentExecutor({
        strategy: makeStrategy(),
        trader,
        priceFeed,
        capital: 10_000,
        tickIntervalMs: 1000,
        owner: OWNER,
        mint: MINT,
        custody: CUSTODY,
        lookback: -5,
      })).toThrow('lookback must be positive');
    });
  });
});
