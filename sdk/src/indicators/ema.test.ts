import { describe, it, expect } from 'vitest';
import { ema, emaSeries } from './ema';

describe('EMA', () => {
  it('returns null with insufficient data', () => {
    expect(ema([1, 2], 3)).toBeNull();
  });

  it('computes EMA with SMA seed', () => {
    const data = [22, 22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24];
    const result = ema(data, 10);
    expect(result).not.toBeNull();
    // With only 10 data points and period=10, it equals SMA
    const smaVal = data.reduce((s, v) => s + v, 0) / 10;
    expect(result).toBeCloseTo(smaVal, 5);
  });

  it('weights recent values more heavily', () => {
    const data = [10, 10, 10, 10, 10, 20]; // spike at end
    const emaVal = ema(data, 5)!;
    // EMA should be higher than SMA of last 5 because of weighting
    expect(emaVal).toBeGreaterThan(10);
    expect(emaVal).toBeLessThan(20);
  });

  it('computes EMA series', () => {
    const result = emaSeries([1, 2, 3, 4, 5], 3);
    expect(result.length).toBe(3); // 3 values for 5 data points with period 3
    expect(result[0]).toBe(2); // SMA of [1,2,3]
  });
});
