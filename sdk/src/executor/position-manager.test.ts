import { describe, it, expect, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { PositionManager } from './position-manager';
import { MockAdrenaTrader } from '../client/adrena-wrapper';
import type { PositionInfo } from '../client/adrena-wrapper';
import type { RiskParams, MarketState } from '../types';

const OWNER = PublicKey.unique();
const CUSTODY = PublicKey.unique();

function makeRiskParams(overrides: Partial<RiskParams> = {}): RiskParams {
  return {
    maxLeverage: 5,
    maxPositionPct: 20,
    stopLossPct: 5,
    takeProfitPct: 10,
    ...overrides,
  };
}

function makeMarket(price: number, prices?: number[]): MarketState {
  return {
    symbol: 'SOL/USD',
    price,
    prices: prices ?? [price],
    volumes: [1000],
    high24h: price * 1.05,
    low24h: price * 0.95,
    volume24h: 100_000,
    timestamp: Date.now(),
  };
}

function makeLongPosition(entryPrice: number, overrides: Partial<PositionInfo> = {}): PositionInfo {
  return {
    owner: OWNER,
    custody: CUSTODY,
    side: 'long',
    sizeUsd: 1000,
    collateralUsd: 200,
    entryPrice,
    liquidationPrice: entryPrice * 0.8,
    unrealizedPnl: 0,
    openedAt: Date.now(),
    ...overrides,
  };
}

function makeShortPosition(entryPrice: number, overrides: Partial<PositionInfo> = {}): PositionInfo {
  return {
    owner: OWNER,
    custody: CUSTODY,
    side: 'short',
    sizeUsd: 1000,
    collateralUsd: 200,
    entryPrice,
    liquidationPrice: entryPrice * 1.2,
    unrealizedPnl: 0,
    openedAt: Date.now(),
    ...overrides,
  };
}

describe('PositionManager', () => {
  let trader: MockAdrenaTrader;
  let pm: PositionManager;

  beforeEach(() => {
    trader = new MockAdrenaTrader();
    pm = new PositionManager(trader, makeRiskParams(), 10_000);
  });

  describe('shouldStopLoss', () => {
    it('returns true when long PnL exceeds stop-loss threshold', () => {
      const pos = makeLongPosition(100);
      // Price dropped 6%: PnL = -6%, stopLoss = 5%
      expect(pm.shouldStopLoss(pos, 94)).toBe(true);
    });

    it('returns false when long PnL is within threshold', () => {
      const pos = makeLongPosition(100);
      // Price dropped 3%: PnL = -3%, stopLoss = 5%
      expect(pm.shouldStopLoss(pos, 97)).toBe(false);
    });

    it('returns true when short PnL exceeds stop-loss threshold', () => {
      const pos = makeShortPosition(100);
      // Price rose 6%: short PnL = -6%
      expect(pm.shouldStopLoss(pos, 106)).toBe(true);
    });

    it('returns false when short PnL is within threshold', () => {
      const pos = makeShortPosition(100);
      // Price rose 3%: short PnL = -3%
      expect(pm.shouldStopLoss(pos, 103)).toBe(false);
    });

    it('returns true at exact stop-loss boundary', () => {
      const pos = makeLongPosition(100);
      // PnL = -5% exactly — should trigger
      expect(pm.shouldStopLoss(pos, 95)).toBe(true);
    });
  });

  describe('shouldTakeProfit', () => {
    it('returns true when long PnL exceeds take-profit threshold', () => {
      const pos = makeLongPosition(100);
      // Price rose 12%: PnL = 12%, takeProfit = 10%
      expect(pm.shouldTakeProfit(pos, 112)).toBe(true);
    });

    it('returns false when long PnL is below threshold', () => {
      const pos = makeLongPosition(100);
      expect(pm.shouldTakeProfit(pos, 105)).toBe(false);
    });

    it('returns true when short PnL exceeds take-profit threshold', () => {
      const pos = makeShortPosition(100);
      // Price dropped 12%: short PnL = 12%
      expect(pm.shouldTakeProfit(pos, 88)).toBe(true);
    });

    it('returns false when short PnL is below threshold', () => {
      const pos = makeShortPosition(100);
      expect(pm.shouldTakeProfit(pos, 95)).toBe(false);
    });

    it('returns true at exact take-profit boundary', () => {
      const pos = makeLongPosition(100);
      // PnL = 10% exactly — should trigger
      expect(pm.shouldTakeProfit(pos, 110)).toBe(true);
    });
  });

  describe('calcPositionSize', () => {
    it('respects maxPositionPct', () => {
      // Capital 10,000, maxPositionPct 20% → max 2,000
      const size = pm.calcPositionSize(100);
      expect(size).toBe(2000);
    });

    it('returns 0 for zero capital', () => {
      const zeroPm = new PositionManager(trader, makeRiskParams(), 0);
      expect(zeroPm.calcPositionSize(100)).toBe(0);
    });

    it('returns 0 for zero price', () => {
      expect(pm.calcPositionSize(0)).toBe(0);
    });

    it('scales with different maxPositionPct', () => {
      const pm10 = new PositionManager(trader, makeRiskParams({ maxPositionPct: 10 }), 10_000);
      expect(pm10.calcPositionSize(100)).toBe(1000);
    });
  });

  describe('executeSignal', () => {
    it('returns hold on HOLD signal', async () => {
      const result = await pm.executeSignal('HOLD', makeMarket(100), null);
      expect(result.action).toBe('hold');
      expect(trader.executedTrades).toHaveLength(0);
    });

    it('opens long position on LONG signal', async () => {
      const result = await pm.executeSignal('LONG', makeMarket(100), null, OWNER, CUSTODY);
      expect(result.action).toBe('opened_long');
      expect(result.txSig).toBeDefined();
      expect(trader.executedTrades).toHaveLength(1);
      expect(trader.executedTrades[0].method).toBe('openLong');
    });

    it('opens short position on SHORT signal', async () => {
      const result = await pm.executeSignal('SHORT', makeMarket(100), null, OWNER, CUSTODY);
      expect(result.action).toBe('opened_short');
      expect(result.txSig).toBeDefined();
      expect(trader.executedTrades).toHaveLength(1);
      expect(trader.executedTrades[0].method).toBe('openShort');
    });

    it('closes existing long position on CLOSE signal', async () => {
      const pos = makeLongPosition(100);
      const result = await pm.executeSignal('CLOSE', makeMarket(105), pos);
      expect(result.action).toBe('closed_long');
      expect(result.txSig).toBeDefined();
    });

    it('closes existing short position on CLOSE signal', async () => {
      const pos = makeShortPosition(100);
      const result = await pm.executeSignal('CLOSE', makeMarket(95), pos);
      expect(result.action).toBe('closed_short');
      expect(result.txSig).toBeDefined();
    });

    it('returns hold on CLOSE signal with no position', async () => {
      const result = await pm.executeSignal('CLOSE', makeMarket(100), null);
      expect(result.action).toBe('hold');
      expect(result.reason).toContain('no open position');
    });

    it('holds when already in same direction', async () => {
      const pos = makeLongPosition(100);
      const result = await pm.executeSignal('LONG', makeMarket(105), pos, OWNER, CUSTODY);
      expect(result.action).toBe('hold');
      expect(result.reason).toContain('Already in long');
    });

    it('closes opposite position and opens new on direction reversal', async () => {
      const pos = makeLongPosition(100);
      // Price at 96 → PnL = -4%, within the 5% stop-loss. Signal SHORT should reverse.
      const result = await pm.executeSignal('SHORT', makeMarket(96), pos, OWNER, CUSTODY);
      // Should have closed long then opened short
      expect(result.action).toBe('opened_short');
      expect(trader.executedTrades.length).toBe(2);
      expect(trader.executedTrades[0].method).toBe('closeLong');
      expect(trader.executedTrades[1].method).toBe('openShort');
    });

    it('triggers stop-loss before processing signal', async () => {
      const pos = makeLongPosition(100);
      // Price dropped 7% — exceeds 5% stop-loss
      const result = await pm.executeSignal('HOLD', makeMarket(93), pos);
      expect(result.action).toBe('closed_long');
    });

    it('triggers take-profit before processing signal', async () => {
      const pos = makeLongPosition(100);
      // Price rose 12% — exceeds 10% take-profit
      const result = await pm.executeSignal('HOLD', makeMarket(112), pos);
      expect(result.action).toBe('closed_long');
    });
  });
});
