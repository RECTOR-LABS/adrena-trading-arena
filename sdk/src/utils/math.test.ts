import { describe, it, expect } from 'vitest';
import { bpsToDecimal, decimalToBps, applySlippage, calcPnlPct, calcLeverage } from './math';

describe('math utilities', () => {
  describe('bpsToDecimal', () => {
    it('converts basis points to decimal', () => {
      expect(bpsToDecimal(10_000)).toBe(1);
      expect(bpsToDecimal(300)).toBe(0.03);
      expect(bpsToDecimal(50)).toBe(0.005);
      expect(bpsToDecimal(0)).toBe(0);
    });
  });

  describe('decimalToBps', () => {
    it('converts decimal to basis points', () => {
      expect(decimalToBps(1)).toBe(10_000);
      expect(decimalToBps(0.03)).toBe(300);
      expect(decimalToBps(0.005)).toBe(50);
    });
  });

  describe('applySlippage', () => {
    it('increases price for buy', () => {
      expect(applySlippage(100, 300, 'buy')).toBe(103);
    });
    it('decreases price for sell', () => {
      expect(applySlippage(100, 300, 'sell')).toBe(97);
    });
    it('returns same price with zero slippage', () => {
      expect(applySlippage(100, 0, 'buy')).toBe(100);
    });
  });

  describe('calcPnlPct', () => {
    it('calculates long P&L correctly', () => {
      expect(calcPnlPct(100, 110, 'long')).toBe(10);
      expect(calcPnlPct(100, 90, 'long')).toBe(-10);
    });
    it('calculates short P&L correctly', () => {
      expect(calcPnlPct(100, 90, 'short')).toBe(10);
      expect(calcPnlPct(100, 110, 'short')).toBe(-10);
    });
    it('returns 0 for zero entryPrice', () => {
      expect(calcPnlPct(0, 100, 'long')).toBe(0);
      expect(calcPnlPct(0, 100, 'short')).toBe(0);
    });
  });

  describe('calcLeverage', () => {
    it('calculates leverage correctly', () => {
      expect(calcLeverage(10_000, 2_000)).toBe(5);
      expect(calcLeverage(5_000, 5_000)).toBe(1);
    });
    it('returns 0 for zero collateral', () => {
      expect(calcLeverage(10_000, 0)).toBe(0);
    });
  });
});
